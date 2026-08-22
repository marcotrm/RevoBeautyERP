'use server';

import { prisma } from '@/lib/prisma';
import { emettiScontrinoElettronico } from '@/lib/scontrino';
import { notifyIncasso } from '@/lib/telegram';
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

  /*
    Il buono è un incasso vero, e va in cassa adesso.

    Chi compra un buono regalo paga in quel momento: i soldi entrano nel
    cassetto la sera stessa. Finora la vendita non lasciava traccia in cassa, e
    alla chiusura ci si ritrovava con più contanti di quelli registrati —
    niente da riconciliare, solo un buco. Anche lo scontrino fiscale va emesso
    qui: il pagamento avviene alla vendita del buono, non il giorno in cui
    qualcun altro lo spende.
  */
  await registraVenditaInCassa(created);

  return toGiftCard(created);
}

/** L'incasso della vendita del buono: riga in cassa, scontrino, avviso Telegram. */
async function registraVenditaInCassa(gc: {
  id: string; code: string; amount: number; paymentMethod: string;
  purchasedBy: string; recipientName: string; purchaseOperator: string;
}): Promise<void> {
  if (!gc.amount || gc.amount <= 0) return;
  const now = new Date();
  const etichetta = `Buono regalo ${gc.code} per ${gc.recipientName}`.trim();
  // I metodi si scrivono come in cassa ("Contanti", "Carta"): la chiusura di
  // giornata li riconosce da lì, e un "contanti" minuscolo finirebbe fra gli
  // "altri metodi" senza entrare nel versamento in cassaforte.
  const metodo = gc.paymentMethod.charAt(0).toUpperCase() + gc.paymentMethod.slice(1).toLowerCase();

  const riga = await prisma.posTransaction.create({
    data: {
      date: now.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }),
      time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }),
      clientName: gc.purchasedBy || 'Cliente Occasionale',
      items: [etichetta],
      total: gc.amount,
      paymentMethod: metodo,
      operator: gc.purchaseOperator,
      isRefund: false,
    },
  });

  await emettiScontrinoElettronico(riga, etichetta);
  notifyIncasso({
    amount: gc.amount, client: gc.purchasedBy, items: etichetta,
    method: metodo, operator: gc.purchaseOperator,
  }).catch(() => {});
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
