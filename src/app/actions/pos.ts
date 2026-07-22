'use server';

import { prisma } from '@/lib/prisma';
import { notifyIncasso } from '@/lib/telegram';
import { todayRome } from '@/lib/date';
import { emitC95Receipt, voidC95Receipt, getC95Config } from '@/lib/c95';

export interface ProductLine { productId: string; qty: number }

export interface TransactionRecord {
  id: string;
  client: string;
  items: string;
  total: number;
  method: string;
  time: string;
  operator: string;
  productLines?: ProductLine[]; // prodotti venduti (per scaricare/ricaricare il magazzino)
  cabinMinutes?: number; // minuti trascorsi in cabina (check-in → check-out), solo per la notifica
}

function toTransactionRecord(tx: {
  id: string; clientName: string | null; items: unknown; total: number; paymentMethod: string; time: string; operator: string;
}): TransactionRecord {
  const itemsArr = Array.isArray(tx.items) ? (tx.items as string[]) : [String(tx.items ?? '')];
  return {
    id: tx.id,
    client: tx.clientName ?? '',
    items: itemsArr.join(', '),
    total: tx.total,
    method: tx.paymentMethod,
    time: tx.time,
    operator: tx.operator,
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

export async function createTransaction(data: Omit<TransactionRecord, 'id'>) {
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
    },
  });
  // Scarico magazzino: scala la giacenza dei prodotti venduti
  for (const l of lines) {
    if (l?.productId && l.qty > 0) {
      await prisma.product.update({ where: { id: l.productId }, data: { stock: { decrement: l.qty } } }).catch(() => {});
    }
  }
  // Notifica Telegram su ogni incasso (non blocca la vendita se fallisce)
  if (created.total > 0) {
    notifyIncasso({ amount: created.total, client: created.clientName, items: data.items, method: created.paymentMethod, operator: created.operator, cabinMinutes: data.cabinMinutes }).catch(() => {});
  }
  // Emissione scontrino fiscale elettronico C95 (solo incassi, non resi/storni). Non blocca
  // la vendita se C95 non è configurato o fallisce: lo stato resta tracciato sulla transazione.
  if (created.total > 0 && !created.isRefund) {
    try {
      const c95Cfg = await getC95Config();
      if (!c95Cfg.enabled) return toTransactionRecord(created);
      const result = await emitC95Receipt({
        amount: created.total,
        paymentMethod: created.paymentMethod,
        lines: [{ descrizione: data.items.slice(0, 100) || 'Servizi/prodotti', prezzoUnitario: created.total, quantita: 1 }],
      });
      await prisma.posTransaction.update({
        where: { id: created.id },
        data: {
          c95Status: result.status,
          c95Emitted: result.status === 'emitted',
          c95IdScontrino: result.idScontrino,
          c95Gid: result.gid,
          c95Idtrx: result.idtrx,
          c95Progressivo: result.progressivo,
          c95Error: result.error,
        },
      });
    } catch {
      // integrazione non configurata o errore imprevisto: la vendita resta valida comunque
    }
  }
  return toTransactionRecord(created);
}
