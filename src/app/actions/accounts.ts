'use server';

import { prisma } from '@/lib/prisma';
import { DEFAULT_ACCOUNTS } from '@/lib/rolesConfig';

export interface GestionaleAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
  active: boolean;
  createdAt: string;
}

/** Semina gli account di default se la tabella è vuota. Idempotente. */
async function ensureSeeded() {
  const count = await prisma.appUser.count();
  if (count > 0) return;
  await prisma.appUser.createMany({
    data: DEFAULT_ACCOUNTS.map((a) => ({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      password: a.password,
      roleId: a.roleId,
      active: a.active,
      createdAt: '2024-01-01',
    })),
    skipDuplicates: true,
  });
}

export async function getAccounts(): Promise<GestionaleAccount[]> {
  await ensureSeeded();
  const rows = await prisma.appUser.findMany({ orderBy: { createdAt: 'asc' } });
  return rows as GestionaleAccount[];
}

export async function createAccount(data: Omit<GestionaleAccount, 'id' | 'createdAt'>): Promise<GestionaleAccount> {
  const email = data.email.trim().toLowerCase();
  const existing = await prisma.appUser.findUnique({ where: { email } });
  if (existing) throw new Error('Esiste già un account con questa email.');
  const row = await prisma.appUser.create({
    data: {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email,
      password: data.password,
      roleId: data.roleId,
      active: data.active,
      createdAt: new Date().toISOString().slice(0, 10),
    },
  });
  return row as GestionaleAccount;
}

export async function updateAccount(
  id: string,
  data: Partial<Omit<GestionaleAccount, 'id' | 'createdAt'>>,
): Promise<GestionaleAccount> {
  if (data.email) {
    const email = data.email.trim().toLowerCase();
    const other = await prisma.appUser.findUnique({ where: { email } });
    if (other && other.id !== id) throw new Error('Esiste già un account con questa email.');
    data = { ...data, email };
  }
  const row = await prisma.appUser.update({ where: { id }, data });
  return row as GestionaleAccount;
}

export async function deleteAccount(id: string): Promise<boolean> {
  await prisma.appUser.delete({ where: { id } });
  return true;
}

export async function toggleAccountActive(id: string): Promise<GestionaleAccount> {
  const acc = await prisma.appUser.findUnique({ where: { id } });
  if (!acc) throw new Error('Account non trovato.');
  const row = await prisma.appUser.update({ where: { id }, data: { active: !acc.active } });
  return row as GestionaleAccount;
}

/** Autenticazione lato server contro il DB. Ritorna l'account o null. */
export async function authenticate(email: string, password: string): Promise<GestionaleAccount | null> {
  await ensureSeeded();
  const acc = await prisma.appUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!acc || !acc.active || acc.password !== password) return null;
  return acc as GestionaleAccount;
}
