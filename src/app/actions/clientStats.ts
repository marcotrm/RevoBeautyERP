'use server';

/**
 * Classifica clienti e numeri di marketing, su un periodo scelto.
 *
 * A differenza dei KPI generali, qui si guarda **una cliente alla volta**: chi
 * ha speso di più, chi è venuta più volte, chi prenota tanto ma poi disdice.
 * Tutto filtrato per date, perché "la migliore cliente" di sempre e quella di
 * questo trimestre sono spesso due persone diverse.
 */

import { prisma } from '@/lib/prisma';
import { dataApertura } from '@/lib/apertura';
import { soloClientiVeri, TAG_INTERNO } from '@/lib/clientiInterni';

const norm = (s: string | null | undefined) =>
  (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400000;

export interface ClientRow {
  id: string;
  nome: string;
  telefono: string;
  spesa: number;            // incassato in cassa nel periodo
  scontrini: number;        // passaggi in cassa
  scontrinoMedio: number;
  prenotati: number;        // appuntamenti presi (qualunque esito)
  visite: number;           // appuntamenti completati
  disdette: number;         // disdette + no show
  affidabilita: number;     // % completati sugli appuntamenti già conclusi
  trattamentoTop: string;
  ultimaVisita: string | null;
  primaVisita: string | null;
  giorniDaUltima: number | null;
  ogniQuantiGiorni: number | null; // cadenza media fra due visite nel periodo
  nuova: boolean;           // prima visita in assoluto dentro il periodo
}

export interface ClientRankingResult {
  righe: ClientRow[];
  totali: { clienti: number; spesa: number; visite: number; disdette: number };
  /** Nomi delle schede di casa tenute fuori: si dice, non si nasconde. */
  escluse: string[];
}

/**
 * Righe cliente per il periodo `from`–`to` (inclusi, YYYY-MM-DD).
 * L'ordinamento lo fa la pagina: qui si restituisce tutto, così cambiare
 * criterio o cercare un nome non costa un'altra query.
 */
export async function getClientRanking(from: string, to: string): Promise<ClientRankingResult> {
  const [start, end] = from <= to ? [from, to] : [to, from];

  // Le query girano una per volta, non in parallelo: il pool di connessioni
  // Prisma è piccolo e questa sezione lancia più statistiche insieme — a
  // raffica satura il pool e le pagine muoiono con "connection pool timeout".
  // Fuori le schede di casa (titolari, prove): un titolare che si prenota per
  // provare l'agenda finiva primo in classifica e sballava incasso e medie.
  const tutteLeSchede = await prisma.client.findMany({
    select: { id: true, firstName: true, lastName: true, phone: true, tags: true },
  });
  const clients = soloClientiVeri(tutteLeSchede);
  const escluse = tutteLeSchede
    .filter(c => !clients.includes(c))
    .map(c => `${c.firstName} ${c.lastName}`.trim());
  /*
    Anche il periodo parte dall'apertura: prima il centro era chiuso e quelle
    righe sono prove del gestionale, non clienti.
  */
  const apertura = await dataApertura();
  const daQuando = start > apertura ? start : apertura;

  const apptsPeriodo = await prisma.appointment.findMany({
    where: { date: { gte: daQuando, lte: end } },
    select: { clientId: true, date: true, status: true, treatmentName: true },
  });
  const txs = await prisma.posTransaction.findMany({
    where: { date: { gte: daQuando, lte: end }, isRefund: false, total: { gt: 0 } },
    select: { clientName: true, total: true, date: true },
  });
  // Serve solo per sapere se, nel periodo, la cliente era alla sua prima volta
  const primeVisite = await prisma.appointment.findMany({
    where: { status: 'completed', date: { gte: apertura } },
    select: { clientId: true, date: true },
  });

  const primaAssoluta = new Map<string, string>();
  for (const a of primeVisite) {
    const p = primaAssoluta.get(a.clientId);
    if (!p || a.date < p) primaAssoluta.set(a.clientId, a.date);
  }

  const perNome = new Map<string, { id: string; nome: string; telefono: string }>();
  for (const c of clients) {
    perNome.set(norm(`${c.firstName} ${c.lastName}`), {
      id: c.id, nome: `${c.firstName} ${c.lastName}`.trim(), telefono: c.phone || '',
    });
  }

  type Acc = {
    spesa: number; scontrini: number; prenotati: number; disdette: number;
    visite: Set<string>; trattamenti: Map<string, number>;
  };
  const vuoto = (): Acc => ({ spesa: 0, scontrini: 0, prenotati: 0, disdette: 0, visite: new Set(), trattamenti: new Map() });
  const acc = new Map<string, Acc>();
  const prendi = (id: string) => { const a = acc.get(id) || vuoto(); acc.set(id, a); return a; };

  // Solo schede vere: gli appuntamenti di prova dei titolari restano nel
  // database (servono a provare) ma non fanno numero qui.
  const idsVeri = new Set(clients.map(c => c.id));

  for (const a of apptsPeriodo) {
    if (!a.clientId || !idsVeri.has(a.clientId)) continue;
    const x = prendi(a.clientId);
    x.prenotati += 1;
    if (a.status === 'completed') {
      x.visite.add(a.date);
      x.trattamenti.set(a.treatmentName, (x.trattamenti.get(a.treatmentName) || 0) + 1);
    } else if (a.status === 'cancelled' || a.status === 'no_show') {
      x.disdette += 1;
    }
  }

  // La cassa registra il nome scritto, non l'id: si riaggancia per nome normalizzato
  for (const t of txs) {
    const c = perNome.get(norm(t.clientName));
    if (!c) continue;
    const x = prendi(c.id);
    x.spesa += t.total;
    x.scontrini += 1;
  }

  const anagrafica = new Map(clients.map(c => [c.id, c]));
  const oggi = Date.now();

  const righe: ClientRow[] = [...acc.entries()].map(([id, x]) => {
    const c = anagrafica.get(id);
    const date = [...x.visite].sort();
    const prima = date[0] || null;
    const ultima = date[date.length - 1] || null;

    let cadenza: number | null = null;
    if (date.length >= 2) {
      let somma = 0;
      for (let i = 1; i < date.length; i++) somma += (Date.parse(date[i]) - Date.parse(date[i - 1])) / DAY;
      cadenza = Math.round(somma / (date.length - 1));
    }

    const top = [...x.trattamenti.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      id,
      nome: c ? `${c.firstName} ${c.lastName}`.trim() : '—',
      telefono: c?.phone || '',
      spesa: round2(x.spesa),
      scontrini: x.scontrini,
      scontrinoMedio: x.scontrini ? round2(x.spesa / x.scontrini) : 0,
      prenotati: x.prenotati,
      visite: date.length,
      disdette: x.disdette,
      // Solo appuntamenti già conclusi: quelli ancora da fare non dicono nulla
      affidabilita: (() => {
        const conclusi = date.length + x.disdette;
        return conclusi ? Math.round((date.length / conclusi) * 100) : 100;
      })(),
      trattamentoTop: top ? top[0] : '—',
      ultimaVisita: ultima,
      primaVisita: prima,
      giorniDaUltima: ultima ? Math.floor((oggi - Date.parse(ultima)) / DAY) : null,
      ogniQuantiGiorni: cadenza,
      nuova: !!prima && primaAssoluta.get(id) === prima,
    };
  });

  return {
    righe,
    totali: {
      clienti: righe.length,
      spesa: round2(righe.reduce((s, r) => s + r.spesa, 0)),
      visite: righe.reduce((s, r) => s + r.visite, 0),
      disdette: righe.reduce((s, r) => s + r.disdette, 0),
    },
    escluse,
  };
}

/**
 * Mette (o toglie) l'etichetta "interno" a una scheda.
 *
 * Serve per non dover ricordare come si scrive l'etichetta: dalle statistiche
 * si toglie una riga con un clic e si rimette allo stesso modo.
 */
export async function segnaComeInterno(clientId: string, interno: boolean): Promise<{ ok: boolean }> {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { tags: true } });
  if (!c) return { ok: false };
  const senza = (c.tags || []).filter(t => String(t).trim().toLowerCase() !== TAG_INTERNO);
  await prisma.client.update({
    where: { id: clientId },
    data: { tags: interno ? [...senza, TAG_INTERNO] : senza },
  });
  return { ok: true };
}

// ============================================================
// MARKETING
// ============================================================

export interface MarketingStats {
  /** Nuove clienti per canale di provenienza (etichette dell'anagrafica). */
  provenienza: { nome: string; valore: number }[];
  nuoveClienti: number;
  consensoMarketing: number;
  senzaConsenso: number;
  conTelefono: number;
  conEmail: number;
  compleanniMese: number;
  /** Chi non si vede da un po': la lista da richiamare, in ordine di valore. */
  daRiattivare: { nome: string; telefono: string; giorni: number; spesaStorica: number }[];
  buoni: { venduti: number; valoreVenduto: number; usati: number; valoreResiduo: number };
  affiliazione: { registrazioni: number; verificate: number; omaggiUsati: number; diventateClienti: number; perAffiliato: { nome: string; valore: number }[] };
  /** Quante delle nuove clienti del periodo sono poi tornate a pagare. */
  ritornoNuove: { nuove: number; tornate: number; percentuale: number };
}

export async function getMarketingStats(from: string, to: string): Promise<MarketingStats> {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const oggi = new Date().toISOString().slice(0, 10);

  // Una query per volta: vedi la nota in getClientRanking sul pool Prisma.
  // Anche qui fuori le schede di casa: conteggi, consensi e compleanni devono
  // parlare di clienti veri.
  const clients = soloClientiVeri(await prisma.client.findMany({
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, tags: true, birthDate: true, marketingConsent: true, createdAt: true },
  }));
  const giftCards = await prisma.giftCard.findMany({ select: { amount: true, remainingBalance: true, status: true, purchaseDate: true } });
  const leads = await prisma.affiliateLead.findMany({ select: { affiliateId: true, status: true, voucherUsedAt: true, clientId: true, createdAt: true } });
  const affiliati = await prisma.affiliate.findMany({ select: { id: true, businessName: true } });
  const appts = await prisma.appointment.findMany({ where: { status: 'completed' }, select: { clientId: true, date: true } });
  const txs = await prisma.posTransaction.findMany({ where: { isRefund: false, total: { gt: 0 } }, select: { clientName: true, total: true, date: true } });

  const nelPeriodo = (d: string | null | undefined) => !!d && d.slice(0, 10) >= start && d.slice(0, 10) <= end;

  // --- Provenienza: si legge dalle etichette, che è dove il canale viene segnato
  const perTag = new Map<string, number>();
  const nuove = clients.filter(c => nelPeriodo(c.createdAt));
  for (const c of nuove) {
    const tags = (c.tags || []).filter(Boolean);
    if (!tags.length) perTag.set('Senza etichetta', (perTag.get('Senza etichetta') || 0) + 1);
    else for (const t of tags) perTag.set(t, (perTag.get(t) || 0) + 1);
  }
  const provenienza = [...perTag.entries()].map(([nome, valore]) => ({ nome, valore })).sort((a, b) => b.valore - a.valore);

  // --- Da riattivare: ultima visita completata più vecchia di 60 giorni
  const ultimaVisita = new Map<string, string>();
  for (const a of appts) {
    const p = ultimaVisita.get(a.clientId);
    if (!p || a.date > p) ultimaVisita.set(a.clientId, a.date);
  }
  const spesaPerNome = new Map<string, number>();
  for (const t of txs) {
    const n = norm(t.clientName);
    if (n) spesaPerNome.set(n, (spesaPerNome.get(n) || 0) + t.total);
  }
  const daRiattivare = clients
    .map(c => {
      const ultima = ultimaVisita.get(c.id);
      if (!ultima) return null;
      const giorni = Math.floor((Date.now() - Date.parse(ultima)) / DAY);
      if (giorni < 60) return null;
      return {
        nome: `${c.firstName} ${c.lastName}`.trim(),
        telefono: c.phone || '',
        giorni,
        spesaStorica: round2(spesaPerNome.get(norm(`${c.firstName} ${c.lastName}`)) || 0),
      };
    })
    .filter(Boolean) as MarketingStats['daRiattivare'];
  daRiattivare.sort((a, b) => b.spesaStorica - a.spesaStorica || a.giorni - b.giorni);

  // --- Buoni regalo del periodo
  const buoniPeriodo = giftCards.filter(g => nelPeriodo(g.purchaseDate));
  const buoni = {
    venduti: buoniPeriodo.length,
    valoreVenduto: round2(buoniPeriodo.reduce((s, g) => s + (g.amount || 0), 0)),
    usati: buoniPeriodo.filter(g => (g.remainingBalance || 0) < (g.amount || 0)).length,
    valoreResiduo: round2(giftCards.filter(g => g.status === 'active').reduce((s, g) => s + (g.remainingBalance || 0), 0)),
  };

  // --- Affiliazione
  const leadsPeriodo = leads.filter(l => nelPeriodo(l.createdAt));
  const nomeAff = new Map(affiliati.map(a => [a.id, a.businessName]));
  const perAff = new Map<string, number>();
  for (const l of leadsPeriodo) {
    if (l.status !== 'verified') continue;
    const nome = nomeAff.get(l.affiliateId) || 'Sconosciuto';
    perAff.set(nome, (perAff.get(nome) || 0) + 1);
  }
  const affiliazione = {
    registrazioni: leadsPeriodo.length,
    verificate: leadsPeriodo.filter(l => l.status === 'verified').length,
    omaggiUsati: leadsPeriodo.filter(l => l.voucherUsedAt).length,
    diventateClienti: leadsPeriodo.filter(l => l.clientId).length,
    perAffiliato: [...perAff.entries()].map(([nome, valore]) => ({ nome, valore })).sort((a, b) => b.valore - a.valore),
  };

  // --- Le nuove del periodo sono tornate a pagare?
  const nomiNuove = new Set(nuove.map(c => norm(`${c.firstName} ${c.lastName}`)));
  const primaVisitaNuove = new Map<string, string>();
  for (const c of nuove) {
    const u = appts.filter(a => a.clientId === c.id).map(a => a.date).sort()[0];
    if (u) primaVisitaNuove.set(norm(`${c.firstName} ${c.lastName}`), u);
  }
  const tornate = new Set<string>();
  for (const t of txs) {
    const n = norm(t.clientName);
    if (!nomiNuove.has(n)) continue;
    const prima = primaVisitaNuove.get(n);
    // Conta come "tornata a pagare" solo la spesa dal giorno della prima visita in poi
    if (prima && t.date >= prima) tornate.add(n);
  }

  return {
    provenienza,
    nuoveClienti: nuove.length,
    consensoMarketing: clients.filter(c => c.marketingConsent).length,
    senzaConsenso: clients.filter(c => !c.marketingConsent).length,
    conTelefono: clients.filter(c => (c.phone || '').length > 5).length,
    conEmail: clients.filter(c => (c.email || '').includes('@')).length,
    compleanniMese: clients.filter(c => (c.birthDate || '').slice(5, 7) === oggi.slice(5, 7)).length,
    daRiattivare: daRiattivare.slice(0, 30),
    buoni,
    affiliazione,
    ritornoNuove: {
      nuove: nuove.length,
      tornate: tornate.size,
      percentuale: nuove.length ? Math.round((tornate.size / nuove.length) * 100) : 0,
    },
  };
}
