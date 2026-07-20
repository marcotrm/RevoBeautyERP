'use server';

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';

export interface CassaMovementRecord {
  id: string;
  type: 'deposit' | 'withdraw';
  date: string;
  cash: number;
  card: number;
  satispay: number;
  bonifico: number;
  total: number;
  txCount: number;
  note: string | null;
  createdAt: string;
}

function toRecord(m: {
  id: string; type: string; date: string; cash: number; card: number; satispay: number;
  bonifico: number; total: number; txCount: number; note: string | null; createdAt: string;
}): CassaMovementRecord {
  return { ...m, type: m.type === 'withdraw' ? 'withdraw' : 'deposit' };
}

export async function getCassaforte(): Promise<{ balance: number; movements: CassaMovementRecord[] }> {
  const movements = await prisma.cassaMovement.findMany({ orderBy: { id: 'desc' } });
  const balance = movements.reduce((s, m) => s + (m.type === 'withdraw' ? -m.cash : m.cash), 0);
  return { balance, movements: movements.map(toRecord) };
}

// Chiude la cassa del giorno: versa in cassaforte i contanti incassati oggi.
// Una sola chiusura al giorno, per non contare due volte gli stessi contanti.
export async function closeCassa(): Promise<{ ok: boolean; error?: 'already_closed'; movement?: CassaMovementRecord }> {
  const today = todayRome();
  const existing = await prisma.cassaMovement.findFirst({ where: { type: 'deposit', date: today } });
  if (existing) return { ok: false, error: 'already_closed' };

  const txs = await prisma.posTransaction.findMany({ where: { date: today } });
  const sumBy = (method: string) => txs.filter(t => t.paymentMethod === method && t.total > 0).reduce((s, t) => s + t.total, 0);
  const cash = sumBy('Contanti');
  const card = sumBy('Carta');
  const satispay = sumBy('Satispay');
  const bonifico = sumBy('Bonifico');
  const total = txs.reduce((s, t) => s + t.total, 0);

  const mv = await prisma.cassaMovement.create({
    data: {
      type: 'deposit', date: today, cash, card, satispay, bonifico, total,
      txCount: txs.length, createdAt: new Date().toISOString(),
    },
  });
  return { ok: true, movement: toRecord(mv) };
}

// Preleva contanti dalla cassaforte (es. ritiro settimanale). Resta in storico.
export async function withdrawCassa(amount: number, note?: string): Promise<{ ok: boolean; error?: 'invalid' | 'insufficient'; movement?: CassaMovementRecord }> {
  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (!amt || amt <= 0) return { ok: false, error: 'invalid' };
  const { balance } = await getCassaforte();
  if (amt > balance + 0.001) return { ok: false, error: 'insufficient' };

  const mv = await prisma.cassaMovement.create({
    data: {
      type: 'withdraw', date: todayRome(), cash: amt, total: amt,
      note: note?.trim() || null, createdAt: new Date().toISOString(),
    },
  });
  return { ok: true, movement: toRecord(mv) };
}
