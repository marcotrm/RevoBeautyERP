'use server';

import { prisma } from '@/lib/prisma';
import type { GiftCard, GiftCardTransaction } from '@/stores/useGiftCardStore';

function toGiftCard(gc: {
  id: string; code: string; purchasedBy: string; recipientName: string; recipientPhone: string | null;
  amount: number; remainingBalance: number; purchaseDate: string; expiryDate: string; paymentMethod: string;
  purchaseOperator: string; status: string; message: string | null; transactions: unknown;
}): GiftCard {
  return {
    ...gc,
    recipientPhone: gc.recipientPhone ?? undefined,
    message: gc.message ?? undefined,
    paymentMethod: gc.paymentMethod as GiftCard['paymentMethod'],
    status: gc.status as GiftCard['status'],
    transactions: (gc.transactions as unknown as GiftCardTransaction[]) ?? [],
  };
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `RB-${new Date().getFullYear()}-${code}`;
}

export async function getGiftCards() {
  const giftCards = await prisma.giftCard.findMany({ orderBy: { purchaseDate: 'desc' } });
  return giftCards.map(toGiftCard);
}

export async function createGiftCard(data: {
  purchasedBy: string;
  recipientName: string;
  recipientPhone?: string;
  amount: number;
  paymentMethod: GiftCard['paymentMethod'];
  operator: string;
  validityMonths: number;
  message?: string;
}) {
  const now = new Date();
  const exp = new Date(now);
  exp.setMonth(exp.getMonth() + data.validityMonths);

  const created = await prisma.giftCard.create({
    data: {
      code: generateCode(),
      purchasedBy: data.purchasedBy,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone ?? null,
      amount: data.amount,
      remainingBalance: data.amount,
      purchaseDate: now.toISOString().split('T')[0],
      expiryDate: exp.toISOString().split('T')[0],
      paymentMethod: data.paymentMethod,
      purchaseOperator: data.operator,
      status: 'active',
      message: data.message ?? null,
      transactions: [],
    },
  });

  return toGiftCard(created);
}

export async function redeemGiftCard(gcId: string, amount: number, service: string, operator: string) {
  const gc = await prisma.giftCard.findUniqueOrThrow({ where: { id: gcId } });
  const today = new Date().toISOString().split('T')[0];
  const newBalance = Math.max(0, gc.remainingBalance - amount);
  const transactions = (gc.transactions as unknown as GiftCardTransaction[]) ?? [];

  const updated = await prisma.giftCard.update({
    where: { id: gcId },
    data: {
      remainingBalance: newBalance,
      status: newBalance <= 0 ? 'used' : 'partial',
      transactions: JSON.parse(JSON.stringify([...transactions, { id: `gct-${Date.now()}`, date: today, amount, service, operator }])),
    },
  });

  return toGiftCard(updated);
}

export async function deleteGiftCard(gcId: string) {
  await prisma.giftCard.delete({ where: { id: gcId } });
  return true;
}
