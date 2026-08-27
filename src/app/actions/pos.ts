'use server';

import { prisma } from '@/lib/prisma';
import { notifyIncasso } from '@/lib/telegram';
import { todayRome } from '@/lib/date';
import { voidC95Receipt, resoParzialeC95Receipt, recoverC95Idtrx, getC95Config } from '@/lib/c95';
import { emettiScontrinoElettronico } from '@/lib/scontrino';
import { maturaDaIncasso } from '@/lib/fedelta';

export interface ProductLine { productId: string; qty: number }

export interface TransactionRecord {
  id: string;
  date?: string; // giorno della vendita (YYYY-MM-DD): serve quando si guardano periodi passati
  client: string;
  items: string;
  total: number;
  method: string;
  time: string;
  operator: string;
  productLines?: ProductLine[]; // prodotti venduti (per scaricare/ricaricare il magazzino)
  cabinMinutes?: number; // minuti trascorsi in cabina (check-in → check-out), solo per la notifica
  /**
   * L'appuntamento che questa vendita sta incassando, quando la vendita nasce
   * dal check-out in agenda. È il legame che permette di dire "questa seduta è
   * stata pagata" senza indovinare per nome e importo.
   */
  appointmentId?: string;
  c95Status?: string | null; // stato scontrino fiscale: emitted | failed | uncertain | reso_* | null
  c95Error?: string | null;
  c95Progressivo?: string | null; // numero documento commerciale AdE (es. DCW2026/1565-0455)
  c95Idtrx?: string | null; // codice transazione C95/AdE
  c95IdScontrino?: string | null; // id interno C95, serve per annullo/reso/ristampa
}

function toTransactionRecord(tx: {
  id: string; date?: string; clientName: string | null; items: unknown; total: number; paymentMethod: string; time: string; operator: string;
  c95Status?: string | null; c95Error?: string | null;
  c95Progressivo?: string | null; c95Idtrx?: string | null; c95IdScontrino?: string | null;
}): TransactionRecord {
  const itemsArr = Array.isArray(tx.items) ? (tx.items as string[]) : [String(tx.items ?? '')];
  return {
    id: tx.id,
    date: tx.date,
    client: tx.clientName ?? '',
    items: itemsArr.join(', '),
    total: tx.total,
    method: tx.paymentMethod,
    time: tx.time,
    operator: tx.operator,
    c95Status: tx.c95Status ?? null,
    c95Error: tx.c95Error ?? null,
    c95Progressivo: tx.c95Progressivo ?? null,
    c95Idtrx: tx.c95Idtrx ?? null,
    c95IdScontrino: tx.c95IdScontrino ?? null,
  };
}

export async function getTodayTransactions() {
  const today = todayRome();
  const transactions = await prisma.posTransaction.findMany({
    where: { date: today },
    orderBy: { id: 'desc' },
  });
  return transactions.map(toTransactionRecord);
}

// ============================================================
// RIEPILOGO INCASSI PER PERIODO
// ============================================================

export interface DayIncome {
  date: string;      // YYYY-MM-DD
  contanti: number;  // entrati nel cassetto
  carta: number;     // battuti sul POS
  altro: number;     // Satispay, bonifici, buoni regalo
  totale: number;
  vendite: number;   // righe con importo positivo
}

export interface IncomeSummary {
  days: DayIncome[];
  contanti: number;
  carta: number;
  altro: number;
  totale: number;
  vendite: number;
}

/**
 * Divide una transazione fra contante e POS.
 *
 * Il pagamento misto è salvato come "Misto (Contanti €30, Carta €20)": qui si
 * rileggono i due importi, altrimenti l'intera vendita finirebbe da una parte
 * sola e la chiusura di cassa non tornerebbe.
 */
function splitByMethod(method: string, total: number): { contanti: number; carta: number; altro: number } {
  const m = String(method || '');
  if (/misto/i.test(m)) {
    const numeri = [...m.matchAll(/€\s*([\d.,]+)/g)].map(x => Number(x[1].replace(/\./g, '').replace(',', '.')) || 0);
    const [contanti = 0, carta = 0] = numeri;
    const somma = contanti + carta;
    // Se il testo non si legge (formati vecchi) si tiene tutto sul contante,
    // come faceva già la chiusura di cassa.
    if (somma <= 0) return { contanti: total, carta: 0, altro: 0 };
    // Riproporziona sui centesimi realmente incassati (resi compresi)
    const k = total / somma;
    return { contanti: contanti * k, carta: carta * k, altro: 0 };
  }
  if (/contant|cash/i.test(m)) return { contanti: total, carta: 0, altro: 0 };
  if (/carta|pos|bancomat|credit/i.test(m)) return { contanti: 0, carta: total, altro: 0 };
  return { contanti: 0, carta: 0, altro: total };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Incassi giorno per giorno nel periodo scelto, divisi fra contanti, POS e altro. */
export async function getIncomeSummary(from: string, to: string): Promise<IncomeSummary> {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const txs = await prisma.posTransaction.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true, total: true, paymentMethod: true },
  });

  const perDay = new Map<string, DayIncome>();
  for (const t of txs) {
    const q = splitByMethod(t.paymentMethod, t.total);
    const d = perDay.get(t.date) ?? { date: t.date, contanti: 0, carta: 0, altro: 0, totale: 0, vendite: 0 };
    d.contanti += q.contanti;
    d.carta += q.carta;
    d.altro += q.altro;
    d.totale += t.total;
    if (t.total > 0) d.vendite += 1;
    perDay.set(t.date, d);
  }

  const days = [...perDay.values()]
    .map(d => ({ ...d, contanti: round2(d.contanti), carta: round2(d.carta), altro: round2(d.altro), totale: round2(d.totale) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    days,
    contanti: round2(days.reduce((s, d) => s + d.contanti, 0)),
    carta: round2(days.reduce((s, d) => s + d.carta, 0)),
    altro: round2(days.reduce((s, d) => s + d.altro, 0)),
    totale: round2(days.reduce((s, d) => s + d.totale, 0)),
    vendite: days.reduce((s, d) => s + d.vendite, 0),
  };
}

/** Tutte le vendite di una singola data, in ordine di orario: il dettaglio dietro al riepilogo. */
export async function getTransactionsByDate(date: string): Promise<TransactionRecord[]> {
  const transactions = await prisma.posTransaction.findMany({
    where: { date },
    orderBy: { time: 'asc' },
  });
  return transactions.map(toTransactionRecord);
}

/** Vendite di un intervallo di date, dalla più recente: alimenta l'elenco sotto al riepilogo. */
export async function getTransactionsByRange(from: string, to: string): Promise<TransactionRecord[]> {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const transactions = await prisma.posTransaction.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: [{ date: 'desc' }, { time: 'desc' }],
  });
  return transactions.map(toTransactionRecord);
}

export async function deleteTransaction(id: string) {
  // Ricarica le giacenze dei prodotti prima di cancellare la transazione
  const tx = await prisma.posTransaction.findUnique({ where: { id } });
  const lines = Array.isArray(tx?.productLines) ? (tx!.productLines as unknown as ProductLine[]) : [];
  for (const l of lines) {
    if (l?.productId && l.qty > 0) {
      await prisma.product.update({ where: { id: l.productId }, data: { stock: { increment: l.qty } } }).catch(() => {});
    }
  }
  // Se è stato emesso uno scontrino fiscale C95, va annullato prima di cancellare la transazione
  // locale — altrimenti resta un documento fiscale AdE senza corrispondenza.
  if (tx?.c95Emitted && tx.c95IdScontrino) {
    const voided = await voidC95Receipt({ idScontrino: tx.c95IdScontrino, idtrx: tx.c95Idtrx || undefined });
    if (!voided.ok) {
      throw new Error(`Impossibile cancellare: annullo scontrino fiscale fallito (${voided.error}). Verifica su C95 prima di riprovare.`);
    }
  }
  await prisma.posTransaction.delete({ where: { id } });
  return true;
}

/**
 * Vendita in cassa.
 *
 * `scontrinoDopo` serve ai contanti: l'incasso si registra subito, il
 * documento fiscale no. Al banco capita di dover decidere sul momento se lo
 * scontrino si fa o no, e una volta partito verso l'Agenzia delle Entrate
 * l'unico modo di tornare indietro e' un annullo. Chi paga con la carta non ha
 * questo dubbio: quello lo scontrino ce l'ha sempre, e parte da solo.
 */
export async function createTransaction(data: Omit<TransactionRecord, 'id'> & { scontrinoDopo?: boolean }, originalTxId?: string) {
  const today = todayRome();
  const lines = data.productLines || [];
  const created = await prisma.posTransaction.create({
    data: {
      date: today,
      time: data.time,
      clientName: data.client,
      items: [data.items],
      productLines: lines.length ? JSON.parse(JSON.stringify(lines)) : undefined,
      total: data.total,
      paymentMethod: data.method,
      operator: data.operator,
      isRefund: data.total < 0,
      appointmentId: data.appointmentId || null,
    },
  });
  // Scarico magazzino: scala la giacenza dei prodotti venduti
  for (const l of lines) {
    if (l?.productId && l.qty > 0) {
      await prisma.product.update({ where: { id: l.productId }, data: { stock: { decrement: l.qty } } }).catch(() => {});
    }
  }
  // Punti, cashback e premi referral: maturano qui, sull'incasso vero, e mai
  // altrove. Un errore non deve fermare la cassa, quindi non si attende.
  if (created.total > 0 && !created.isRefund) {
    maturaDaIncasso({
      clientName: created.clientName,
      importo: created.total,
      metodo: created.paymentMethod,
      sourceId: created.id,
      descrizione: data.items,
    }).catch(e => console.error('[fedelta] non maturata:', e));
  }
  // Notifica Telegram su ogni incasso (non blocca la vendita se fallisce)
  if (created.total > 0) {
    notifyIncasso({ amount: created.total, client: created.clientName, items: data.items, method: created.paymentMethod, operator: created.operator, cabinMinutes: data.cabinMinutes }).catch(() => {});
  }
  // Emissione scontrino fiscale elettronico C95 (solo incassi, non resi/storni). Non blocca
  // la vendita se C95 non è configurato o fallisce: lo stato resta tracciato sulla transazione.
  // Record restituito al client: viene sostituito con la versione aggiornata dopo l'esito C95,
  // così il POS può avvisare subito l'operatore se lo scontrino fiscale non è stato emesso.
  let outcome = created;
  /*
    Chi paga col buono regalo non sta pagando adesso: ha pagato il giorno in
    cui il buono è stato comprato, e lo scontrino è uscito lì. Emetterne un
    altro qui vorrebbe dire dichiarare due volte gli stessi soldi.
  */
  const colBuono = /buono/i.test(created.paymentMethod || '');
  if (created.total > 0 && !created.isRefund && !colBuono && !data.scontrinoDopo) {
    // Stessa emissione usata dai pacchetti (lib/scontrino): un punto solo.
    const aggiornata = await emettiScontrinoElettronico(created, data.items);
    if (aggiornata) outcome = aggiornata;
  }
  // Rimborso: se lo scontrino originale era stato emesso su C95, registra il RESO verso AdE
  // (reso totale se l'importo coincide col documento originale, altrimenti reso parziale).
  // Best-effort come l'emissione: un errore fiscale non blocca il rimborso, resta tracciato.
  if (created.total < 0 && originalTxId) {
    try {
      const c95Cfg = await getC95Config();
      if (!c95Cfg.enabled) return toTransactionRecord(created);
      const original = await prisma.posTransaction.findUnique({ where: { id: originalTxId } });
      if (original?.c95Emitted && original.c95IdScontrino) {
        const idtrx = original.c95Idtrx || (await recoverC95Idtrx(original.c95IdScontrino)) || undefined;
        const refundAmount = Math.abs(created.total);
        const isTotal = Math.abs(refundAmount - original.total) < 0.01;
        const result = isTotal
          ? await voidC95Receipt({ idScontrino: original.c95IdScontrino, idtrx, tipo: 'R' })
          : await resoParzialeC95Receipt({
              idScontrino: original.c95IdScontrino,
              idtrx,
              lines: [{ descrizione: data.items.slice(0, 100) || 'Reso', prezzoUnitario: refundAmount, quantita: 1 }],
            });
        outcome = await prisma.posTransaction.update({
          where: { id: created.id },
          data: result.ok
            ? { c95Status: isTotal ? 'reso_totale' : 'reso_parziale', c95IdScontrino: original.c95IdScontrino, c95Idtrx: idtrx }
            : { c95Status: 'failed', c95Error: result.error },
        });
      }
    } catch {
      // il rimborso locale resta valido; il reso fiscale andrà gestito a mano su C95
    }
  }
  return toTransactionRecord(outcome);
}

/**
 * Fa lo scontrino adesso, su un incasso gia' in cassa.
 *
 * E' il tasto dei contanti: la vendita esiste dal momento in cui si e'
 * incassato, il documento fiscale nasce solo quando qualcuno lo chiede. Torna
 * la riga aggiornata perche' il tagliando di carta deve poterci stampare
 * sopra il numero del documento commerciale, che prima non c'era.
 */
export async function emettiScontrinoOra(txId: string): Promise<{ ok: boolean; error?: string; tx?: TransactionRecord }> {
  const tx = await prisma.posTransaction.findUnique({ where: { id: txId } });
  if (!tx) return { ok: false, error: 'Incasso non trovato' };
  if (tx.c95Emitted) return { ok: true, tx: toTransactionRecord(tx) };
  if (tx.total <= 0) return { ok: false, error: 'I rimborsi si gestiscono con il reso' };
  // Esito incerto: il documento potrebbe essere gia' partito. Riprovare qui
  // vorrebbe dire rischiare di dichiarare due volte gli stessi soldi.
  if (tx.c95Status === 'uncertain') {
    return { ok: false, error: 'Esito incerto sul primo tentativo: controlla su C95 se il documento esiste gia\', prima di rifarlo' };
  }
  const cfg = await getC95Config();
  if (!cfg.enabled) return { ok: false, error: 'Scontrino elettronico non configurato: Impostazioni → C95' };

  const itemsArr = Array.isArray(tx.items) ? (tx.items as string[]) : [String(tx.items ?? '')];
  const aggiornata = await emettiScontrinoElettronico(tx, itemsArr.join(', '));
  if (!aggiornata) return { ok: false, error: 'Emissione non riuscita: riprova o emetti a mano su C95' };
  if (!aggiornata.c95Emitted) {
    return { ok: false, error: aggiornata.c95Error || 'Emissione non riuscita', tx: toTransactionRecord(aggiornata) };
  }
  return { ok: true, tx: toTransactionRecord(aggiornata) };
}
