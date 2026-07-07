'use server';

import { prisma } from '@/lib/prisma';

export interface TransactionRecord {
  id: string;
  client: string;
  items: string;
  total: number;
  method: string;
  time: string;
  operator: string;
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

export async function createTransaction(data: Omit<TransactionRecord, 'id'>) {
  const today = new Date().toISOString().split('T')[0];
  const created = await prisma.posTransaction.create({
    data: {
      date: today,
      time: data.time,
      clientName: data.client,
      items: [data.items],
      total: data.total,
      paymentMethod: data.method,
      operator: data.operator,
      isRefund: data.total < 0,
    },
  });
  return toTransactionRecord(created);
}
