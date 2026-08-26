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

export interface StoricoTrattamento {
  nome: string;
  sedute: SedutaTrattamento[];
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

export async function storicoTrattamento(nome: string, mesi = 12): Promise<StoricoTrattamento> {
  const da = new Date();
  da.setMonth(da.getMonth() - mesi);
  const dal = da.toISOString().slice(0, 10);

  const appuntamenti = await prisma.appointment.findMany({
    where: { date: { gte: dal }, status: 'completed' },
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
  });

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
