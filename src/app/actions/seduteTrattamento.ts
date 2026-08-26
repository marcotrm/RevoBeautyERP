'use server';

/**
 * Tutte le volte che un trattamento è stato fatto davvero.
 *
 * Nelle statistiche si legge "Epilazione laser Total Body — 260 €, 2 volte" e
 * la domanda che viene subito dopo è: quando? a chi? con chi? Finora bisognava
 * andare a cercarle in agenda una per una, sapendo già dove guardare — cioè
 * non si faceva.
 *
 * Il nome è la chiave, perché è così che le statistiche contano: un
 * appuntamento con più trattamenti li tiene dentro `services`, e ogni riga di
 * lì vale come una seduta a sé.
 */

import { prisma } from '@/lib/prisma';

export interface SedutaTrattamento {
  appointmentId: string;
  data: string;
  ora: string;
  cliente: string;
  clientId: string | null;
  operatrice: string;
  prezzo: number;
  durata: number;
  /** Vero se quella riga era coperta da un pacchetto (prezzo a zero). */
  daPacchetto: boolean;
  stato: string;
}

export interface ConteggioPeriodo {
  /** L'etichetta già pronta: "12/08", "sett. del 10/08", "ago 26". */
  etichetta: string;
  chiave: string;
  volte: number;
  incasso: number;
}

export interface Ritorno {
  /**
   * Sedute dopo le quali la cliente ha preso un altro appuntamento LO STESSO
   * GIORNO: è la riprenotazione al banco, quella che tiene in piedi l'agenda.
   */
  riprenotateSubito: number;
  /** Sedute dopo le quali la cliente è tornata, prima o poi. */
  tornate: number;
  /** Sedute dopo le quali non risulta più nessun appuntamento. */
  nonTornate: number;
  /** Giorni medi fra la seduta e la visita successiva, quando c'è stata. */
  giorniMedi: number;
  percentualeRiprenotate: number;
  percentualeTornate: number;
}

export interface StoricoTrattamento {
  nome: string;
  sedute: SedutaTrattamento[];
  /** Quante volte è stato fatto, raggruppato come chiesto. */
  perPeriodo: ConteggioPeriodo[];
  ritorno: Ritorno;
  volte: number;
  incasso: number;
  prezzoMedio: number;
  clientiDiverse: number;
  perOperatrice: { nome: string; volte: number; incasso: number }[];
  perMese: { mese: string; volte: number; incasso: number }[];
  /** Chi lo fa più spesso: le clienti affezionate a quel trattamento. */
  topClienti: { nome: string; volte: number; spesa: number }[];
  primaVolta: string | null;
  ultimaVolta: string | null;
}

const norm = (s: string) => (s || '').trim().toLowerCase();

export type Raggruppa = 'giorno' | 'settimana' | 'mese';

export async function storicoTrattamento(
  nome: string,
  opzioni: { dal?: string; al?: string; mesi?: number; raggruppa?: Raggruppa } = {},
): Promise<StoricoTrattamento> {
  const raggruppa = opzioni.raggruppa || 'mese';
  const da = new Date();
  da.setMonth(da.getMonth() - (opzioni.mesi ?? 12));
  const dal = opzioni.dal || da.toISOString().slice(0, 10);
  const al = opzioni.al || '9999-12-31';

  const [appuntamenti, tuttiDellaCliente] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: { gte: dal, lte: al }, status: 'completed' },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    }),
    /*
      Serve tutto lo storico degli appuntamenti, non solo quelli nel periodo:
      per sapere se dopo una seduta la cliente è tornata bisogna guardare
      avanti, anche fuori dall'intervallo scelto.
    */
    prisma.appointment.findMany({
      select: { clientId: true, date: true, status: true, createdAt: true },
    }),
  ]);

  const cercato = norm(nome);
  const sedute: SedutaTrattamento[] = [];

  for (const a of appuntamenti) {
    const servizi = Array.isArray(a.services) ? (a.services as unknown as {
      treatmentName?: string; price?: number; duration?: number; operatorName?: string; startTime?: string;
    }[]) : [];

    /*
      Due strade, come nelle statistiche: se l'appuntamento ha l'elenco dei
      trattamenti si guarda riga per riga (una seduta può contenere il
      trattamento cercato insieme ad altri due); se non ce l'ha — i più
      vecchi — vale il nome scritto sull'appuntamento.
    */
    const righe = servizi.length > 0
      ? servizi.filter(s => norm(s.treatmentName || '') === cercato)
        .map(s => ({
          prezzo: s.price ?? 0,
          durata: s.duration ?? a.duration,
          operatrice: s.operatorName || a.operatorName,
          ora: s.startTime || a.startTime,
        }))
      : (norm(a.treatmentName) === cercato
        ? [{ prezzo: a.price, durata: a.duration, operatrice: a.operatorName, ora: a.startTime }]
        : []);

    for (const r of righe) {
      sedute.push({
        appointmentId: a.id,
        data: a.date,
        ora: r.ora,
        cliente: a.clientName,
        clientId: a.clientId,
        operatrice: r.operatrice,
        prezzo: Math.round((r.prezzo || 0) * 100) / 100,
        durata: r.durata || 0,
        // Prezzo a zero su una seduta completata vuol dire quasi sempre
        // pacchetto o omaggio: si segnala, se no sembra un errore di listino.
        daPacchetto: (r.prezzo || 0) === 0,
        stato: a.status,
      });
    }
  }

  /*
    Ritorno e riprenotazione.

    Per ogni seduta si guarda cosa è successo dopo, per quella cliente:

    - se ha preso un altro appuntamento LO STESSO GIORNO della seduta (la data
      di creazione dell'appuntamento coincide col giorno in cui era qui),
      allora ha riprenotato al banco prima di uscire — è il gesto che tiene in
      piedi l'agenda, e vale molto più di una che "poi richiama";
    - se comunque è tornata più avanti, si conta come ritorno e si misura
      quanti giorni ci ha messo;
    - se dopo quella seduta non risulta più niente, non è tornata.

    L'ultima seduta di ognuna è esclusa dal conto delle non tornate solo se è
    recente: se è di ieri, dire "non è tornata" non vuol dire niente.
  */
  const perCliente = new Map<string, { date: string; creato: string; stato: string }[]>();
  for (const a of tuttiDellaCliente) {
    if (!a.clientId) continue;
    const lista = perCliente.get(a.clientId) || [];
    lista.push({ date: a.date, creato: (a.createdAt || '').slice(0, 10), stato: a.status });
    perCliente.set(a.clientId, lista);
  }

  const oggi = new Date().toISOString().slice(0, 10);
  const giorniFra = (a: string, b: string) =>
    Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

  let riprenotateSubito = 0, tornate = 0, nonTornate = 0;
  const attese: number[] = [];
  for (const s of sedute) {
    const suoi = s.clientId ? (perCliente.get(s.clientId) || []) : [];
    const dopo = suoi.filter(x => x.date > s.data && x.stato !== 'cancelled' && x.stato !== 'no_show');

    // Preso mentre era qui: l'appuntamento è nato lo stesso giorno della seduta.
    if (dopo.some(x => x.creato === s.data)) riprenotateSubito += 1;

    if (dopo.length > 0) {
      tornate += 1;
      const prossima = dopo.map(x => x.date).sort()[0];
      attese.push(giorniFra(s.data, prossima));
    } else if (giorniFra(s.data, oggi) > 30) {
      // Sotto il mese non si può ancora dire che non è tornata.
      nonTornate += 1;
    }
  }

  const ritorno: Ritorno = {
    riprenotateSubito, tornate, nonTornate,
    giorniMedi: attese.length ? Math.round(attese.reduce((a, b) => a + b, 0) / attese.length) : 0,
    percentualeRiprenotate: sedute.length ? Math.round((riprenotateSubito / sedute.length) * 100) : 0,
    percentualeTornate: sedute.length ? Math.round((tornate / sedute.length) * 100) : 0,
  };

  /* Quante volte è stato fatto, raggruppato per giorno, settimana o mese. */
  const lunediDi = (ymd: string) => {
    const d = new Date(`${ymd}T12:00:00Z`);
    const g = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() + (g === 0 ? -6 : 1 - g));
    return d.toISOString().slice(0, 10);
  };
  const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const etichettaDi = (chiave: string): string => {
    if (raggruppa === 'mese') {
      const [a, m] = chiave.split('-');
      return `${MESI_BREVI[Number(m) - 1]} ${a.slice(2)}`;
    }
    const [a, m, g] = chiave.split('-');
    return raggruppa === 'settimana' ? `sett. del ${g}/${m}` : `${g}/${m}/${a.slice(2)}`;
  };
  const perPeriodoMappa = new Map<string, { volte: number; incasso: number }>();
  for (const s of sedute) {
    const chiave = raggruppa === 'mese' ? s.data.slice(0, 7)
      : raggruppa === 'settimana' ? lunediDi(s.data)
      : s.data;
    const c = perPeriodoMappa.get(chiave) || { volte: 0, incasso: 0 };
    c.volte += 1; c.incasso += s.prezzo;
    perPeriodoMappa.set(chiave, c);
  }
  const perPeriodo: ConteggioPeriodo[] = [...perPeriodoMappa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([chiave, v]) => ({
      chiave, etichetta: etichettaDi(chiave),
      volte: v.volte, incasso: Math.round(v.incasso * 100) / 100,
    }));

  const incasso = Math.round(sedute.reduce((s, x) => s + x.prezzo, 0) * 100) / 100;
  const pagate = sedute.filter(s => s.prezzo > 0);

  const conta = <T>(chiave: (s: SedutaTrattamento) => string, extra: (s: SedutaTrattamento) => number) => {
    const m = new Map<string, { volte: number; somma: number }>();
    for (const s of sedute) {
      const k = chiave(s);
      const c = m.get(k) || { volte: 0, somma: 0 };
      c.volte += 1; c.somma += extra(s);
      m.set(k, c);
    }
    return [...m.entries()].sort((a, b) => b[1].volte - a[1].volte) as [string, { volte: number; somma: number }][];
  };

  return {
    nome,
    sedute,
    perPeriodo,
    ritorno,
    volte: sedute.length,
    incasso,
    prezzoMedio: pagate.length > 0 ? Math.round((pagate.reduce((s, x) => s + x.prezzo, 0) / pagate.length) * 100) / 100 : 0,
    clientiDiverse: new Set(sedute.map(s => s.clientId || s.cliente)).size,
    perOperatrice: conta(s => s.operatrice, s => s.prezzo)
      .map(([nome, v]) => ({ nome, volte: v.volte, incasso: Math.round(v.somma * 100) / 100 })),
    perMese: conta(s => s.data.slice(0, 7), s => s.prezzo)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mese, v]) => ({ mese, volte: v.volte, incasso: Math.round(v.somma * 100) / 100 })),
    topClienti: conta(s => s.cliente, s => s.prezzo)
      .slice(0, 8)
      .map(([nome, v]) => ({ nome, volte: v.volte, spesa: Math.round(v.somma * 100) / 100 })),
    primaVolta: sedute.length ? sedute[sedute.length - 1].data : null,
    ultimaVolta: sedute.length ? sedute[0].data : null,
  };
}

/* ============================================================
   PRODOTTI E PACCHETTI: stesso principio, altre due domande.
   ============================================================ */

export interface VenditaProdotto {
  data: string;
  ora: string;
  cliente: string;
  quantita: number;
  incasso: number;
  metodo: string;
  operatrice: string;
}

export interface StoricoProdotto {
  nome: string;
  vendite: VenditaProdotto[];
  pezzi: number;
  incasso: number;
  clientiDiverse: number;
  giacenza: number | null;
  prezzo: number | null;
  perMese: { mese: string; pezzi: number; incasso: number }[];
  primaVolta: string | null;
  ultimaVolta: string | null;
}

/**
 * Quando è stato venduto un prodotto, e a chi.
 *
 * Le righe dei prodotti stanno dentro la transazione di cassa
 * (`productLines`), con l'id e la quantità: il prezzo del singolo pezzo non
 * c'è, quindi si prende quello a listino di adesso. È un'approssimazione
 * onesta — se il prezzo è cambiato nel frattempo lo dice il listino, non lo
 * scontrino — e serve a capire quanto gira un prodotto, non a rifare la
 * contabilità.
 */
export async function storicoProdotto(nome: string, mesi = 12): Promise<StoricoProdotto> {
  const pulito = nome.replace(/^🧴\s*/, '').trim();
  const da = new Date();
  da.setMonth(da.getMonth() - mesi);
  const dal = da.toISOString().slice(0, 10);

  const [prodotto, transazioni] = await Promise.all([
    prisma.product.findFirst({ where: { name: pulito } }),
    prisma.posTransaction.findMany({ where: { date: { gte: dal } }, orderBy: [{ date: 'desc' }, { time: 'desc' }] }),
  ]);

  const vendite: VenditaProdotto[] = [];
  for (const t of transazioni) {
    const righe = Array.isArray(t.productLines) ? (t.productLines as unknown as { productId?: string; qty?: number }[]) : [];
    const mie = righe.filter(r => prodotto && r.productId === prodotto.id);
    const quantita = mie.reduce((s, r) => s + (r.qty || 0), 0);
    // Il prodotto può essere finito in cassa anche senza riga di magazzino:
    // in quel caso resta il nome scritto sullo scontrino.
    const perNome = quantita === 0 && (t.items as string[] | null)?.some(i => i.replace(/^🧴\s*/, '').includes(pulito));
    if (quantita === 0 && !perNome) continue;

    const pezzi = quantita || 1;
    vendite.push({
      data: t.date,
      ora: t.time,
      cliente: t.clientName || 'Cliente occasionale',
      quantita: pezzi,
      incasso: prodotto ? Math.round(prodotto.price * pezzi * 100) / 100 : 0,
      metodo: t.paymentMethod,
      operatrice: t.operator || '—',
    });
  }

  const perMeseMappa = new Map<string, { pezzi: number; incasso: number }>();
  for (const v of vendite) {
    const k = v.data.slice(0, 7);
    const c = perMeseMappa.get(k) || { pezzi: 0, incasso: 0 };
    c.pezzi += v.quantita; c.incasso += v.incasso;
    perMeseMappa.set(k, c);
  }

  return {
    nome: pulito,
    vendite,
    pezzi: vendite.reduce((s, v) => s + v.quantita, 0),
    incasso: Math.round(vendite.reduce((s, v) => s + v.incasso, 0) * 100) / 100,
    clientiDiverse: new Set(vendite.map(v => v.cliente)).size,
    giacenza: prodotto?.stock ?? null,
    prezzo: prodotto?.price ?? null,
    perMese: [...perMeseMappa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mese, v]) => ({ mese, pezzi: v.pezzi, incasso: Math.round(v.incasso * 100) / 100 })),
    primaVolta: vendite.length ? vendite[vendite.length - 1].data : null,
    ultimaVolta: vendite.length ? vendite[0].data : null,
  };
}

export interface VenditaPacchetto {
  clientId: string | null;
  cliente: string;
  acquistato: string;
  scadenza: string;
  pagato: number;
  incassato: number;
  daIncassare: number;
  fatte: number;
  totali: number;
  stato: string;
}

export interface StoricoPacchetto {
  nome: string;
  vendite: VenditaPacchetto[];
  venduti: number;
  incassato: number;
  daIncassare: number;
  seduteDaFare: number;
  usoPercento: number;
  perMese: { mese: string; venduti: number; incassato: number }[];
  primaVolta: string | null;
  ultimaVolta: string | null;
}

/**
 * Chi ha comprato un pacchetto, quando, e a che punto è.
 *
 * È la lista che serve per due telefonate diverse: chi ha sedute da fare e
 * non si vede (il pacchetto scade e resta il reclamo) e chi deve ancora
 * pagare delle rate.
 */
export async function storicoPacchetto(nome: string): Promise<StoricoPacchetto> {
  const righe = await prisma.clientPackage.findMany({
    where: { packageName: nome },
    orderBy: { purchaseDate: 'desc' },
  });

  const vendite: VenditaPacchetto[] = righe.map(r => ({
    clientId: r.clientId,
    cliente: r.clientName,
    acquistato: r.purchaseDate,
    scadenza: r.expiryDate,
    pagato: r.pricePaid,
    incassato: r.totalPaid ?? r.pricePaid,
    daIncassare: r.remainingBalance ?? 0,
    fatte: r.usedSessions,
    totali: r.totalSessions,
    stato: r.status,
  }));

  const perMeseMappa = new Map<string, { venduti: number; incassato: number }>();
  for (const v of vendite) {
    const k = (v.acquistato || '').slice(0, 7);
    if (!k) continue;
    const c = perMeseMappa.get(k) || { venduti: 0, incassato: 0 };
    c.venduti += 1; c.incassato += v.incassato;
    perMeseMappa.set(k, c);
  }

  const seduteTotali = vendite.reduce((s, v) => s + v.totali, 0);
  const seduteFatte = vendite.reduce((s, v) => s + v.fatte, 0);

  return {
    nome,
    vendite,
    venduti: vendite.length,
    incassato: Math.round(vendite.reduce((s, v) => s + v.incassato, 0) * 100) / 100,
    daIncassare: Math.round(vendite.reduce((s, v) => s + v.daIncassare, 0) * 100) / 100,
    seduteDaFare: seduteTotali - seduteFatte,
    usoPercento: seduteTotali > 0 ? Math.round((seduteFatte / seduteTotali) * 100) : 0,
    perMese: [...perMeseMappa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mese, v]) => ({ mese, venduti: v.venduti, incassato: Math.round(v.incassato * 100) / 100 })),
    primaVolta: vendite.length ? vendite[vendite.length - 1].acquistato : null,
    ultimaVolta: vendite.length ? vendite[0].acquistato : null,
  };
}

/* ============================================================
   IL CONTO DI UNA CLIENTE: come si arriva a quella cifra.
   ============================================================ */

export interface VoceConto {
  data: string;
  ora: string;
  descrizione: string;
  metodo: string;
  operatrice: string;
  importo: number;
  /** La somma dalla prima riga fino a questa: si legge come un estratto conto. */
  progressivo: number;
}

export interface ContoCliente {
  nome: string;
  telefono: string | null;
  voci: VoceConto[];
  totale: number;
  scontrini: number;
  scontrinoMedio: number;
  primaVolta: string | null;
  ultimaVolta: string | null;
  /** Visite fatte davvero (appuntamenti completati), che sono un'altra cosa dagli scontrini. */
  visite: number;
  /** Quello che ha ancora da pagare sui pacchetti. */
  daIncassare: number;
  /** Sedute già pagate e non ancora fatte: lavoro che le dobbiamo. */
  seduteDaFare: number;
  perTrattamento: { nome: string; volte: number; spesa: number }[];
}

/**
 * Come una cliente è arrivata a quella cifra.
 *
 * Nella classifica si legge "100 €" e non si sa da dove vengano: tre visite da
 * trenta o una da cento cambiano tutto — la prima è un'abitudine, la seconda
 * un episodio. Qui c'è l'estratto conto: ogni passaggio in cassa con la data,
 * cosa ha preso, come ha pagato, e la somma che cresce riga dopo riga fino al
 * totale che si vede in classifica.
 *
 * Si cerca per nome perché è così che le righe di cassa sono scritte: la
 * transazione non porta l'id della cliente.
 */
export async function contoCliente(clientId: string): Promise<ContoCliente> {
  const cliente = await prisma.client.findUnique({ where: { id: clientId } });
  if (!cliente) {
    return {
      nome: '', telefono: null, voci: [], totale: 0, scontrini: 0, scontrinoMedio: 0,
      primaVolta: null, ultimaVolta: null, visite: 0, daIncassare: 0, seduteDaFare: 0, perTrattamento: [],
    };
  }

  const nomeCompleto = `${cliente.firstName} ${cliente.lastName}`.trim();
  const [transazioni, appuntamenti, pacchetti] = await Promise.all([
    prisma.posTransaction.findMany({
      where: { clientName: nomeCompleto, isRefund: false },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    }),
    prisma.appointment.findMany({ where: { clientId }, orderBy: [{ date: 'asc' }] }),
    prisma.clientPackage.findMany({ where: { clientId } }),
  ]);

  let progressivo = 0;
  const voci: VoceConto[] = transazioni.map(t => {
    progressivo = Math.round((progressivo + t.total) * 100) / 100;
    const righe = Array.isArray(t.items) ? (t.items as string[]) : [];
    return {
      data: t.date,
      ora: t.time,
      descrizione: righe.join(', ') || 'Incasso',
      metodo: t.paymentMethod,
      operatrice: t.operator || '—',
      importo: Math.round(t.total * 100) / 100,
      progressivo,
    };
  });

  const completati = appuntamenti.filter(a => a.status === 'completed');
  const perTratt = new Map<string, { volte: number; spesa: number }>();
  for (const a of completati) {
    const servizi = Array.isArray(a.services) ? (a.services as unknown as { treatmentName?: string; price?: number }[]) : [];
    const righe = servizi.length > 0
      ? servizi.map(s => ({ nome: s.treatmentName || a.treatmentName, prezzo: s.price ?? 0 }))
      : [{ nome: a.treatmentName, prezzo: a.price }];
    for (const r of righe) {
      const c = perTratt.get(r.nome) || { volte: 0, spesa: 0 };
      c.volte += 1; c.spesa += r.prezzo || 0;
      perTratt.set(r.nome, c);
    }
  }

  const totale = Math.round(transazioni.reduce((s, t) => s + t.total, 0) * 100) / 100;

  return {
    nome: nomeCompleto,
    telefono: cliente.phone,
    voci: voci.reverse(), // in tabella si legge dalla più recente
    totale,
    scontrini: transazioni.length,
    scontrinoMedio: transazioni.length ? Math.round((totale / transazioni.length) * 100) / 100 : 0,
    primaVolta: transazioni.length ? transazioni[0].date : (completati[0]?.date ?? null),
    ultimaVolta: transazioni.length ? transazioni[transazioni.length - 1].date : (completati[completati.length - 1]?.date ?? null),
    visite: new Set(completati.map(a => a.date)).size,
    daIncassare: Math.round(pacchetti.reduce((s, p) => s + (p.remainingBalance || 0), 0) * 100) / 100,
    seduteDaFare: pacchetti
      .filter(p => p.status === 'active' || p.status === 'expiring')
      .reduce((s, p) => s + Math.max(0, p.totalSessions - p.usedSessions), 0),
    perTrattamento: [...perTratt.entries()]
      .sort((a, b) => b[1].spesa - a[1].spesa)
      .map(([nome, v]) => ({ nome, volte: v.volte, spesa: Math.round(v.spesa * 100) / 100 })),
  };
}
