'use server';

/**
 * Dashboard Clienti, sui dati veri del centro.
 *
 * Prima questa sezione girava su un elenco di clienti inventate scritto a mano
 * (`lib/client-analytics.ts`): numeri belli da vedere e completamente falsi.
 * Qui gli stessi campi vengono ricostruiti dal database — anagrafica, agenda,
 * cassa e pacchetti — così classifica, affidabilità, RFM e alert parlano delle
 * persone reali.
 *
 * Le regole importanti:
 * - il fatturato di una cliente è quello che ha pagato in cassa più le rate dei
 *   pacchetti; gli appuntamenti hanno un prezzo di listino che NON è un incasso;
 * - la cassa registra il nome scritto, non l'id: si riaggancia per nome;
 * - "visita" = appuntamento completato, non appuntamento prenotato.
 */

import { prisma } from '@/lib/prisma';
import type { ClientAnalytics } from '@/lib/client-analytics';

const norm = (s: string | null | undefined) =>
  (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
const DAY = 86400000;
const round = (n: number) => Math.round(n);

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export interface ClientAnalyticsData {
  clients: ClientAnalytics[];
  /** Ultimi 12 mesi: incasso, clienti diverse servite, nuove. */
  monthlyRevenueTrend: { month: string; revenue: number; clients: number; newClients: number }[];
  /** Nuove clienti per mese e quante di quelle hanno poi speso qualcosa. */
  monthlyNewClients: { month: string; count: number; converted: number }[];
  /** Trattamenti reali: quante volte svolti e quanto valgono. */
  treatmentStats: { name: string; count: number; revenue: number; avgReturn: number }[];
}

function livelloFedelta(revenue: number, visite: number): ClientAnalytics['loyaltyLevel'] {
  if (revenue > 4000 || visite > 40) return 'VIP';
  if (revenue > 2500 || visite > 25) return 'Platinum';
  if (revenue > 1500 || visite > 15) return 'Gold';
  if (revenue > 700 || visite > 8) return 'Silver';
  return 'Bronze';
}

/**
 * Punteggi RFM da 1 a 5 calcolati sui quintili del centro, non su soglie fisse:
 * in un centro appena aperto "aver speso 300 €" può già essere il massimo, e
 * una soglia scritta a mano direbbe che sono tutte clienti scarse.
 */
function quintile(valore: number, ordinati: number[], invertito = false): number {
  if (!ordinati.length) return 1;
  const posizione = ordinati.filter(v => v < valore).length / ordinati.length;
  const punteggio = Math.min(5, Math.max(1, Math.ceil(posizione * 5) || 1));
  return invertito ? 6 - punteggio : punteggio;
}

function segmentoRFM(r: number, f: number, m: number): ClientAnalytics['rfmSegment'] {
  const score = r + f + m;
  if (score >= 13) return 'VIP';
  if (score >= 11) return 'Fedeli';
  if (score >= 8) return 'Regolari';
  if (score >= 5) return 'Occasionali';
  if (score >= 3) return 'Da recuperare';
  return 'Persi';
}

/**
 * Probabilità di abbandono: quanto è in ritardo rispetto al suo ritmo abituale.
 * Una che viene ogni 15 giorni e manca da 40 è un allarme; una che viene ogni
 * 90 e manca da 40 è perfettamente normale.
 */
function rischioAbbandono(giorniDaUltima: number, cadenza: number, visite: number): number {
  if (!visite) return 50;
  const attesa = cadenza > 0 ? cadenza : 45;
  const ritardo = giorniDaUltima / attesa;
  let p = ritardo <= 1 ? ritardo * 20 : 20 + Math.min(75, (ritardo - 1) * 45);
  if (visite >= 5) p -= 8;  // chi torna da tanto tempo è più difficile che sparisca
  if (visite === 1) p += 12; // chi è venuta una volta sola non è ancora una cliente
  return Math.max(2, Math.min(98, round(p)));
}

export async function getClientAnalyticsData(): Promise<ClientAnalyticsData> {
  const oggi = new Date();
  const today = oggi.toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const yearStart = today.slice(0, 4) + '-01-01';
  const dodiciMesiFa = new Date(oggi.getFullYear(), oggi.getMonth() - 11, 1).toISOString().slice(0, 10);

  const [clients, appts, txs, packages] = await Promise.all([
    prisma.client.findMany({
      select: {
        id: true, firstName: true, lastName: true, phone: true, email: true,
        birthDate: true, tags: true, createdAt: true,
      },
    }),
    prisma.appointment.findMany({
      select: { clientId: true, date: true, status: true, price: true, treatmentName: true, operatorName: true },
    }),
    prisma.posTransaction.findMany({
      where: { isRefund: false, total: { gt: 0 } },
      select: { clientName: true, total: true, date: true },
    }),
    prisma.clientPackage.findMany({ select: { clientId: true, status: true, payments: true } }),
  ]);

  // ---------- Incassi per cliente, riagganciati per nome ----------
  const idPerNome = new Map<string, string>();
  for (const c of clients) idPerNome.set(norm(`${c.firstName} ${c.lastName}`), c.id);

  type Incassi = { totale: number; anno: number; mese: number; dodici: number; scontrini: number };
  const incassi = new Map<string, Incassi>();
  for (const t of txs) {
    const id = idPerNome.get(norm(t.clientName));
    if (!id) continue;
    const v = incassi.get(id) || { totale: 0, anno: 0, mese: 0, dodici: 0, scontrini: 0 };
    v.totale += t.total;
    v.scontrini += 1;
    if (t.date >= yearStart) v.anno += t.total;
    if (t.date >= monthStart) v.mese += t.total;
    if (t.date >= dodiciMesiFa) v.dodici += t.total;
    incassi.set(id, v);
  }

  // Rate dei pacchetti: sono incassi a tutti gli effetti
  const pacchettiAttivi = new Set<string>();
  for (const p of packages) {
    if (!p.clientId) continue;
    if (p.status === 'active') pacchettiAttivi.add(p.clientId);
    const pagamenti = Array.isArray(p.payments) ? (p.payments as { amount?: number; date?: string }[]) : [];
    for (const pg of pagamenti) {
      const importo = Number(pg?.amount) || 0;
      if (importo <= 0) continue;
      const v = incassi.get(p.clientId) || { totale: 0, anno: 0, mese: 0, dodici: 0, scontrini: 0 };
      const data = String(pg?.date || '').slice(0, 10);
      v.totale += importo;
      if (data >= yearStart) v.anno += importo;
      if (data >= monthStart) v.mese += importo;
      if (data >= dodiciMesiFa) v.dodici += importo;
      incassi.set(p.clientId, v);
    }
  }

  // ---------- Agenda per cliente ----------
  type Agenda = {
    prenotati: number; completati: number; disdette: number; noShow: number;
    date: string[]; dodici: number; mese: number;
    trattamenti: Map<string, number>; operatrici: Map<string, number>;
    ultimoTrattamento: { data: string; nome: string } | null;
  };
  const agende = new Map<string, Agenda>();
  for (const a of appts) {
    if (!a.clientId) continue;
    const v = agende.get(a.clientId) || {
      prenotati: 0, completati: 0, disdette: 0, noShow: 0, date: [], dodici: 0, mese: 0,
      trattamenti: new Map<string, number>(), operatrici: new Map<string, number>(), ultimoTrattamento: null,
    };
    v.prenotati += 1;
    if (a.status === 'completed') {
      v.completati += 1;
      v.date.push(a.date);
      if (a.date >= dodiciMesiFa) v.dodici += 1;
      if (a.date >= monthStart) v.mese += 1;
      v.trattamenti.set(a.treatmentName, (v.trattamenti.get(a.treatmentName) || 0) + 1);
      if (a.operatorName) v.operatrici.set(a.operatorName, (v.operatrici.get(a.operatorName) || 0) + 1);
      if (!v.ultimoTrattamento || a.date > v.ultimoTrattamento.data) v.ultimoTrattamento = { data: a.date, nome: a.treatmentName };
    } else if (a.status === 'cancelled') v.disdette += 1;
    else if (a.status === 'no_show') v.noShow += 1;
    agende.set(a.clientId, v);
  }

  const piuFrequente = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // ---------- Riga per cliente ----------
  const grezzi = clients.map(c => {
    const inc = incassi.get(c.id) || { totale: 0, anno: 0, mese: 0, dodici: 0, scontrini: 0 };
    const ag = agende.get(c.id);
    const date = [...new Set(ag?.date || [])].sort();
    const ultima = date[date.length - 1] || null;

    let cadenza = 0;
    if (date.length >= 2) {
      let somma = 0;
      for (let i = 1; i < date.length; i++) somma += (Date.parse(date[i]) - Date.parse(date[i - 1])) / DAY;
      cadenza = round(somma / (date.length - 1));
    }

    const giorniDaUltima = ultima ? Math.floor((Date.parse(today) - Date.parse(ultima)) / DAY) : 9999;
    const prenotati = ag?.prenotati || 0;
    const completati = date.length;

    return {
      c, inc, ag, date, ultima, cadenza, giorniDaUltima, prenotati, completati,
      // La provenienza vera che abbiamo è l'etichetta messa in anagrafica
      source: (c.tags || []).find(Boolean) || 'Non indicata',
    };
  });

  // Quintili calcolati sulle clienti che hanno almeno una visita o una spesa
  const attive = grezzi.filter(g => g.completati > 0 || g.inc.totale > 0);
  const spese = attive.map(g => g.inc.totale).sort((a, b) => a - b);
  const frequenze = attive.map(g => g.completati).sort((a, b) => a - b);
  const recenze = attive.map(g => g.giorniDaUltima).sort((a, b) => a - b);

  const risultato: ClientAnalytics[] = grezzi.map(g => {
    const { c, inc, ag, ultima, cadenza, giorniDaUltima, prenotati, completati } = g;
    const persi = (ag?.disdette || 0) + (ag?.noShow || 0);

    const r = quintile(giorniDaUltima, recenze, true); // meno giorni = punteggio più alto
    const f = quintile(completati, frequenze);
    const m = quintile(inc.totale, spese);

    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone || '',
      email: c.email || '',
      joinDate: (c.createdAt || '').slice(0, 10),
      lastVisitDate: ultima || '',
      totalRevenue: round(inc.totale),
      revenue12Months: round(inc.dodici),
      revenueThisMonth: round(inc.mese),
      revenueThisYear: round(inc.anno),
      totalAppointments: completati,
      appointments12Months: ag?.dodici || 0,
      appointmentsThisMonth: ag?.mese || 0,
      avgTicket: inc.scontrini ? round(inc.totale / inc.scontrini) : (completati ? round(inc.totale / completati) : 0),
      daysSinceLastVisit: ultima ? giorniDaUltima : 9999,
      avgDaysBetweenVisits: cadenza,
      preferredTreatment: ag ? piuFrequente(ag.trattamenti) : '—',
      lastTreatment: ag?.ultimoTrattamento?.nome || '—',
      preferredOperator: ag ? piuFrequente(ag.operatrici) : '—',
      source: g.source,
      birthDate: c.birthDate || '',
      loyaltyLevel: livelloFedelta(inc.totale, completati),
      rfmSegment: completati === 0 && inc.totale === 0 ? 'Persi' : segmentoRFM(r, f, m),
      recencyScore: r,
      frequencyScore: f,
      monetaryScore: m,
      churnProbability: rischioAbbandono(giorniDaUltima === 9999 ? 365 : giorniDaUltima, cadenza, completati),
      hasPackage: pacchettiAttivi.has(c.id),
      isNew: (c.createdAt || '') >= monthStart,
      noShowCount: ag?.noShow || 0,
      cancelledCount: ag?.disdette || 0,
      totalBooked: prenotati,
      reliabilityScore: prenotati ? round((completati / prenotati) * 100) : 100,
    };
  });

  // ---------- Serie mensili ----------
  const mesi = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(oggi.getFullYear(), oggi.getMonth() - 11 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MESI[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` };
  });

  const perMese = new Map(mesi.map(m => [m.key, { month: m.label, revenue: 0, clienti: new Set<string>(), newClients: 0 }]));
  for (const t of txs) {
    const slot = perMese.get(t.date.slice(0, 7));
    if (slot) slot.revenue += t.total;
  }
  for (const a of appts) {
    if (a.status !== 'completed' || !a.clientId) continue;
    perMese.get(a.date.slice(0, 7))?.clienti.add(a.clientId);
  }
  for (const c of clients) {
    const slot = perMese.get((c.createdAt || '').slice(0, 7));
    if (slot) slot.newClients += 1;
  }
  const monthlyRevenueTrend = mesi.map(m => {
    const s = perMese.get(m.key)!;
    return { month: s.month, revenue: round(s.revenue), clients: s.clienti.size, newClients: s.newClients };
  });

  // Nuove del mese e quante hanno poi speso davvero qualcosa
  const haSpeso = new Set(risultato.filter(x => x.totalRevenue > 0).map(x => x.id));
  const monthlyNewClients = mesi.map(m => {
    const nate = clients.filter(c => (c.createdAt || '').slice(0, 7) === m.key);
    return { month: m.label, count: nate.length, converted: nate.filter(c => haSpeso.has(c.id)).length };
  });

  // ---------- Trattamenti veri ----------
  const perTratt = new Map<string, { count: number; revenue: number }>();
  for (const a of appts) {
    if (a.status !== 'completed') continue;
    const v = perTratt.get(a.treatmentName) || { count: 0, revenue: 0 };
    v.count += 1;
    v.revenue += a.price || 0;
    perTratt.set(a.treatmentName, v);
  }
  const treatmentStats = [...perTratt.entries()]
    .map(([name, v]) => ({ name, count: v.count, revenue: round(v.revenue), avgReturn: v.count ? round(v.revenue / v.count) : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  return { clients: risultato, monthlyRevenueTrend, monthlyNewClients, treatmentStats };
}
