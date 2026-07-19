'use server';

import { prisma } from '@/lib/prisma';
import { notifyIncasso } from '@/lib/telegram';

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
  const today = new Date().toISOString().split('T')[0];
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
  await prisma.posTransaction.delete({ where: { id } });
  return true;
}

export async function createTransaction(data: Omit<TransactionRecord, 'id'>) {
  const today = new Date().toISOString().split('T')[0];
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
  return toTransactionRecord(created);
}
