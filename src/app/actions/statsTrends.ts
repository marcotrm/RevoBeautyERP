'use server';

/**
 * Serie storiche per la sezione Statistiche.
 *
 * I KPI di `businessStats` dicono "come sta andando adesso"; qui c'è il pezzo
 * che mancava: come sta andando *nel tempo*. Mese per mese, giorno per giorno,
 * per trattamento, per operatrice. È la parte che serve per decidere — capire
 * se il mese storto è un caso o una tendenza, quali servizi tirano davvero,
 * quali clienti stanno sparendo.
 *
 * Tutto in una sola chiamata: le tabelle sono piccole (un centro estetico) e
 * caricarle una volta sola costa meno di dieci query separate.
 */

import { prisma } from '@/lib/prisma';
import { filtroInterni } from '@/lib/clientiInterni';

const norm = (s: string | null | undefined) =>
  (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400000;

export interface MonthPoint {
  month: string;        // YYYY-MM
  label: string;        // "ago 26"
  incasso: number;
  vendite: number;
  scontrinoMedio: number;
  nuoveClienti: number;
  appuntamenti: number;  // completati
  disdette: number;      // disdette + no show
}

export interface NamedValue { nome: string; valore: number; extra?: number }

export interface OperatorPerf {
  nome: string;
  trattamenti: number;
  ore: number;
  incasso: number;       // valore dei trattamenti svolti
  ticketMedio: number;
  clientiSeguite: number;
}

export interface Trends {
  months: MonthPoint[];
  /** Media incassata per giorno della settimana (solo giorni con incasso). */
  perGiornoSettimana: NamedValue[];
  /** Trattamenti svolti per fascia oraria di inizio. */
  perFasciaOraria: NamedValue[];
  topTrattamentiFatturato: NamedValue[];
  topTrattamentiNumero: NamedValue[];
  topCategorie: NamedValue[];
  topProdotti: NamedValue[];
  /** Pacchetti più venduti: valore incassato, extra = quanti ne sono stati venduti. */
  topPacchetti: NamedValue[];
  topClienti: NamedValue[];
  operatrici: OperatorPerf[];
  /** Quante clienti hanno fatto 1, 2-3, 4-9, 10+ visite. */
  frequenzaVisite: NamedValue[];
  /** Clienti per "quanto tempo è che non si vedono". */
  rischioAbbandono: NamedValue[];
  metodiPagamento: NamedValue[];
  /** Proiezione dell'incasso di fine mese sulla media giornaliera corrente. */
  proiezioneMese: { incassoAdOggi: number; proiezione: number; meseScorso: number; giorniPassati: number; giorniMese: number };
  /** Nuove clienti vs clienti di ritorno, mese per mese. */
  nuoveVsRitorno: { label: string; nuove: number; ritorno: number }[];
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const DOW = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

function mesePrecedente(anno: number, mese: number, indietro: number): { key: string; label: string } {
  const d = new Date(anno, mese - indietro, 1);
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    label: `${MESI[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
  };
}

/** Classifica i primi `n` elementi di una mappa nome -> valore. */
function classifica(m: Map<string, { valore: number; extra: number }>, n: number): NamedValue[] {
  return [...m.entries()]
    .map(([nome, v]) => ({ nome, valore: round2(v.valore), extra: round2(v.extra) }))
    .sort((a, b) => b.valore - a.valore)
    .slice(0, n);
}

export async function getTrends(mesiIndietro = 12): Promise<Trends> {
  const oggi = new Date();
  const today = oggi.toISOString().slice(0, 10);
  const anno = oggi.getFullYear();
  const meseCorrente = oggi.getMonth();

  // Primo giorno del periodo osservato: serve per filtrare le query
  const inizioPeriodo = new Date(anno, meseCorrente - (mesiIndietro - 1), 1).toISOString().slice(0, 10);

  // Le query girano una per volta, non in parallelo: il pool di connessioni
  // Prisma è piccolo e questa sezione lancia più statistiche insieme — a
  // raffica satura il pool e le pagine muoiono con "connection pool timeout".
  const clients = await prisma.client.findMany({ select: { id: true, firstName: true, lastName: true, createdAt: true } });
  const appts = await prisma.appointment.findMany({
      where: { date: { gte: inizioPeriodo } },
      select: {
        clientId: true, date: true, startTime: true, price: true, status: true,
        operatorName: true, treatmentName: true, treatmentCategory: true, duration: true,
      },
    });
  const txs = await prisma.posTransaction.findMany({
      where: { date: { gte: inizioPeriodo } },
      select: { clientName: true, total: true, date: true, paymentMethod: true, isRefund: true, productLines: true },
    });
  const products = await prisma.product.findMany({ select: { id: true, name: true, price: true } });

  /*
    Fuori le schede di prova.

    Un appuntamento creato per vedere se una funzione andava non è lavoro
    fatto, e un incasso battuto per provare lo scontrino non è fatturato: se
    restano dentro, il trattamento più caro del centro risulta quello che una
    scheda finta ha "fatto" tre volte.
  */
  const prova = await filtroInterni(prisma);
  const pacchettiVenduti = (await prisma.clientPackage.findMany({
    where: { purchaseDate: { gte: inizioPeriodo } },
    select: { packageName: true, totalPaid: true, pricePaid: true, clientId: true, clientName: true },
  }));

  const income = txs.filter(t => !t.isRefund && t.total > 0 && !prova.daEscludere(t));
  const completati = appts.filter(a => a.status === 'completed' && !prova.daEscludere(a));

  // ---------- Mese per mese ----------
  const mesi = Array.from({ length: mesiIndietro }, (_, i) => mesePrecedente(anno, meseCorrente, mesiIndietro - 1 - i));
  const perMese = new Map(mesi.map(m => [m.key, {
    month: m.key, label: m.label, incasso: 0, vendite: 0, scontrinoMedio: 0,
    nuoveClienti: 0, appuntamenti: 0, disdette: 0,
  } as MonthPoint]));

  for (const t of income) {
    const p = perMese.get(t.date.slice(0, 7));
    if (!p) continue;
    p.incasso += t.total;
    p.vendite += 1;
  }
  for (const a of appts) {
    const p = perMese.get(a.date.slice(0, 7));
    if (!p) continue;
    if (a.status === 'completed') p.appuntamenti += 1;
    else if (a.status === 'cancelled' || a.status === 'no_show') p.disdette += 1;
  }
  for (const c of clients) {
    // Le schede di prova non sono clienti nuove.
    if (prova.ids.has(c.id)) continue;
    const p = perMese.get((c.createdAt || '').slice(0, 7));
    if (p) p.nuoveClienti += 1;
  }
  const months = mesi.map(m => {
    const p = perMese.get(m.key)!;
    return { ...p, incasso: round2(p.incasso), scontrinoMedio: p.vendite ? round2(p.incasso / p.vendite) : 0 };
  });

  // ---------- Giorno della settimana: media, non totale ----------
  // Il totale premierebbe solo i giorni capitati più volte nel periodo: quello
  // che serve sapere è "quanto rende un martedì", non "quanti martedì ci sono".
  const perDataIncasso = new Map<string, number>();
  income.forEach(t => perDataIncasso.set(t.date, (perDataIncasso.get(t.date) || 0) + t.total));
  const dowTot = new Map<number, { somma: number; giorni: number }>();
  for (const [data, tot] of perDataIncasso) {
    const g = new Date(data + 'T12:00:00').getDay();
    const v = dowTot.get(g) || { somma: 0, giorni: 0 };
    v.somma += tot; v.giorni += 1;
    dowTot.set(g, v);
  }
  const perGiornoSettimana = [1, 2, 3, 4, 5, 6, 0].map(g => {
    const v = dowTot.get(g);
    return { nome: DOW[g], valore: v && v.giorni ? round2(v.somma / v.giorni) : 0, extra: v?.giorni || 0 };
  });

  // ---------- Fascia oraria ----------
  const perOra = new Map<string, number>();
  for (const a of completati) {
    const h = (a.startTime || '').slice(0, 2);
    if (!/^\d\d$/.test(h)) continue;
    perOra.set(h, (perOra.get(h) || 0) + 1);
  }
  const perFasciaOraria = [...perOra.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([h, n]) => ({ nome: `${h}:00`, valore: n }));

  // ---------- Trattamenti, categorie ----------
  const perTratt = new Map<string, { valore: number; extra: number }>();
  const perCat = new Map<string, { valore: number; extra: number }>();
  for (const a of completati) {
    const t = perTratt.get(a.treatmentName) || { valore: 0, extra: 0 };
    t.valore += a.price || 0; t.extra += 1;
    perTratt.set(a.treatmentName, t);

    const c = perCat.get(a.treatmentCategory || 'Senza categoria') || { valore: 0, extra: 0 };
    c.valore += a.price || 0; c.extra += 1;
    perCat.set(a.treatmentCategory || 'Senza categoria', c);
  }
  const topTrattamentiFatturato = classifica(perTratt, 10);
  const topTrattamentiNumero = [...perTratt.entries()]
    .map(([nome, v]) => ({ nome, valore: v.extra, extra: round2(v.valore) }))
    .sort((a, b) => b.valore - a.valore).slice(0, 10);
  const topCategorie = classifica(perCat, 8);

  // ---------- Prodotti venduti in cassa ----------
  const nomeProdotto = new Map(products.map(p => [p.id, { nome: p.name, prezzo: p.price }]));
  const perProdotto = new Map<string, { valore: number; extra: number }>();
  for (const t of txs) {
    if (t.isRefund) continue;
    const lines = Array.isArray(t.productLines) ? (t.productLines as { productId?: string; qty?: number }[]) : [];
    for (const l of lines) {
      const p = l?.productId ? nomeProdotto.get(l.productId) : null;
      const qty = Number(l?.qty) || 0;
      if (!p || qty <= 0) continue;
      const v = perProdotto.get(p.nome) || { valore: 0, extra: 0 };
      v.valore += qty * (p.prezzo || 0); // fatturato
      v.extra += qty;                    // pezzi
      perProdotto.set(p.nome, v);
    }
  }
  const topProdotti = classifica(perProdotto, 10);

  /*
    Pacchetti più venduti: si contano i pacchetti delle clienti, non quelli a
    catalogo. Il valore è quello davvero incassato, che con le rate non è il
    prezzo pieno — e sui pacchetti la differenza è proprio il punto.
  */
  const perPacchetto = new Map<string, { valore: number; extra: number }>();
  for (const cp of pacchettiVenduti) {
    if (prova.daEscludere(cp)) continue;
    const nome = (cp.packageName || '').trim();
    if (!nome) continue;
    const v = perPacchetto.get(nome) || { valore: 0, extra: 0 };
    v.valore += cp.totalPaid ?? cp.pricePaid ?? 0;
    v.extra += 1;
    perPacchetto.set(nome, v);
  }
  const topPacchetti = classifica(perPacchetto, 12);

  // ---------- Clienti che spendono di più ----------
  const perCliente = new Map<string, { valore: number; extra: number }>();
  for (const t of income) {
    const n = norm(t.clientName);
    if (!n) continue;
    const v = perCliente.get(n) || { valore: 0, extra: 0 };
    v.valore += t.total; v.extra += 1;
    perCliente.set(n, v);
  }
  // Rimette le maiuscole giuste pescando dall'anagrafica
  const bello = new Map(clients.map(c => [norm(`${c.firstName} ${c.lastName}`), `${c.firstName} ${c.lastName}`.trim()]));
  const topClienti = classifica(perCliente, 10).map(r => ({ ...r, nome: bello.get(r.nome) || r.nome }));

  // ---------- Operatrici ----------
  const perOp = new Map<string, { trattamenti: number; minuti: number; incasso: number; clienti: Set<string> }>();
  for (const a of completati) {
    const nome = a.operatorName || '—';
    const v = perOp.get(nome) || { trattamenti: 0, minuti: 0, incasso: 0, clienti: new Set<string>() };
    v.trattamenti += 1;
    v.minuti += a.duration || 0;
    v.incasso += a.price || 0;
    if (a.clientId) v.clienti.add(a.clientId);
    perOp.set(nome, v);
  }
  const operatrici: OperatorPerf[] = [...perOp.entries()]
    .map(([nome, v]) => ({
      nome,
      trattamenti: v.trattamenti,
      ore: round2(v.minuti / 60),
      incasso: round2(v.incasso),
      ticketMedio: v.trattamenti ? round2(v.incasso / v.trattamenti) : 0,
      clientiSeguite: v.clienti.size,
    }))
    .sort((a, b) => b.incasso - a.incasso);

  // ---------- Fedeltà: quante volte torna una cliente ----------
  const visitePerCliente = new Map<string, Set<string>>();
  for (const a of completati) {
    if (!a.clientId) continue;
    const s = visitePerCliente.get(a.clientId) || new Set<string>();
    s.add(a.date);
    visitePerCliente.set(a.clientId, s);
  }
  const bucket = { una: 0, due: 0, quattro: 0, dieci: 0 };
  for (const s of visitePerCliente.values()) {
    if (s.size === 1) bucket.una++;
    else if (s.size <= 3) bucket.due++;
    else if (s.size <= 9) bucket.quattro++;
    else bucket.dieci++;
  }
  const frequenzaVisite: NamedValue[] = [
    { nome: '1 visita', valore: bucket.una },
    { nome: '2-3 visite', valore: bucket.due },
    { nome: '4-9 visite', valore: bucket.quattro },
    { nome: '10+ visite', valore: bucket.dieci },
  ];

  // ---------- Rischio abbandono ----------
  const ora = Date.parse(today);
  const rischio = { attive: 0, tiepide: 0, fredde: 0, perse: 0 };
  for (const s of visitePerCliente.values()) {
    const ultima = Math.max(...[...s].map(d => Date.parse(d)));
    const gg = (ora - ultima) / DAY;
    if (gg <= 30) rischio.attive++;
    else if (gg <= 60) rischio.tiepide++;
    else if (gg <= 120) rischio.fredde++;
    else rischio.perse++;
  }
  const rischioAbbandono: NamedValue[] = [
    { nome: 'Attive (≤30 gg)', valore: rischio.attive },
    { nome: 'Tiepide (31-60 gg)', valore: rischio.tiepide },
    { nome: 'Fredde (61-120 gg)', valore: rischio.fredde },
    { nome: 'Perse (120+ gg)', valore: rischio.perse },
  ];

  // ---------- Metodi di pagamento ----------
  const perMetodo = new Map<string, number>();
  for (const t of income) {
    const m = String(t.paymentMethod || '');
    const etichetta = /misto/i.test(m) ? 'Misto'
      : /contant|cash/i.test(m) ? 'Contanti'
      : /carta|pos|bancomat/i.test(m) ? 'POS / Carta'
      : /satispay/i.test(m) ? 'Satispay'
      : /bonifico/i.test(m) ? 'Bonifico'
      : /regalo|gift/i.test(m) ? 'Buono regalo'
      : m || 'Altro';
    perMetodo.set(etichetta, (perMetodo.get(etichetta) || 0) + t.total);
  }
  const metodiPagamento = [...perMetodo.entries()]
    .map(([nome, valore]) => ({ nome, valore: round2(valore) }))
    .sort((a, b) => b.valore - a.valore);

  // ---------- Proiezione fine mese ----------
  const meseKey = today.slice(0, 7);
  const meseScorsoKey = mesePrecedente(anno, meseCorrente, 1).key;
  const incassoAdOggi = income.filter(t => t.date.startsWith(meseKey)).reduce((s, t) => s + t.total, 0);
  const meseScorso = income.filter(t => t.date.startsWith(meseScorsoKey)).reduce((s, t) => s + t.total, 0);
  const giorniPassati = oggi.getDate();
  const giorniMese = new Date(anno, meseCorrente + 1, 0).getDate();
  const proiezioneMese = {
    incassoAdOggi: round2(incassoAdOggi),
    proiezione: round2((incassoAdOggi / Math.max(1, giorniPassati)) * giorniMese),
    meseScorso: round2(meseScorso),
    giorniPassati,
    giorniMese,
  };

  // ---------- Nuove vs ritorno, mese per mese ----------
  // Una cliente è "nuova" nel mese della sua prima visita completata.
  const primaVisita = new Map<string, string>();
  for (const a of completati) {
    if (!a.clientId) continue;
    const p = primaVisita.get(a.clientId);
    if (!p || a.date < p) primaVisita.set(a.clientId, a.date);
  }
  const nvr = new Map(mesi.map(m => [m.key, { label: m.label, nuove: new Set<string>(), ritorno: new Set<string>() }]));
  for (const a of completati) {
    if (!a.clientId) continue;
    const slot = nvr.get(a.date.slice(0, 7));
    if (!slot) continue;
    if (primaVisita.get(a.clientId) === a.date) slot.nuove.add(a.clientId);
    else slot.ritorno.add(a.clientId);
  }
  const nuoveVsRitorno = mesi.map(m => {
    const s = nvr.get(m.key)!;
    // Una cliente venuta più volte nel mese conta una volta sola, e se è la sua
    // prima volta resta "nuova" anche se torna nello stesso mese.
    const ritorno = [...s.ritorno].filter(id => !s.nuove.has(id)).length;
    return { label: m.label, nuove: s.nuove.size, ritorno };
  });

  return {
    months,
    perGiornoSettimana,
    perFasciaOraria,
    topTrattamentiFatturato,
    topTrattamentiNumero,
    topCategorie,
    topProdotti,
    topPacchetti,
    topClienti,
    operatrici,
    frequenzaVisite,
    rischioAbbandono,
    metodiPagamento,
    proiezioneMese,
    nuoveVsRitorno,
  };
}
