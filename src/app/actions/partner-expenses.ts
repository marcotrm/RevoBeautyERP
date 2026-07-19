'use server';

import { prisma } from '@/lib/prisma';

export interface PartnerExpenseData {
  id: string;
  partner: string;
  amount: number;
  description: string;
  date: string;
}

export async function getPartnerExpenses(): Promise<PartnerExpenseData[]> {
  const rows = await prisma.partnerExpense.findMany({ orderBy: { date: 'desc' } });
  return rows.map(r => ({ id: r.id, partner: r.partner, amount: r.amount, description: r.description, date: r.date }));
}

export async function createPartnerExpense(data: { partner: string; amount: number; description: string; date: string }): Promise<PartnerExpenseData> {
  const r = await prisma.partnerExpense.create({
    data: { partner: data.partner, amount: data.amount, description: data.description, date: data.date, createdAt: new Date().toISOString() },
  });
  return { id: r.id, partner: r.partner, amount: r.amount, description: r.description, date: r.date };
}

export async function deletePartnerExpense(id: string) {
  await prisma.partnerExpense.delete({ where: { id } });
  return true;
}

export async function clearPartnerExpenses() {
  await prisma.partnerExpense.deleteMany({});
  return true;
}

// Migrazione una-tantum dei dati che erano salvati nel browser (localStorage) verso il DB condiviso.
// Inserisce solo le voci non ancora presenti (dedup per socio+importo+descrizione+data).
export async function migratePartnerExpenses(list: { partner: string; amount: number; description: string; date: string }[]) {
  const existing = await prisma.partnerExpense.findMany();
  const key = (e: { partner: string; amount: number; description: string; date: string }) => `${e.partner}|${e.amount}|${e.description}|${e.date}`;
  const seen = new Set(existing.map(key));
  const SEED = new Set(['Prodotti pulizia', 'Caffè e acqua per clienti']);
  let inserted = 0;
  for (const e of list) {
    if (SEED.has(e.description)) continue; // salta i dati demo iniziali
    if (seen.has(key(e))) continue;
    await prisma.partnerExpense.create({
      data: { partner: e.partner, amount: e.amount, description: e.description, date: e.date, createdAt: new Date().toISOString() },
    });
    seen.add(key(e));
    inserted++;
  }
  return inserted;
}
