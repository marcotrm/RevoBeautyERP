'use server';

import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
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

/**
 * Autenticazione lato server contro il DB. Ritorna l'account o null.
 *
 * Ogni tentativo lascia una riga, riuscito o no. Non e' un controllo sulle
 * persone: e' l'unica cosa che permette di rispondere a «chi e' entrato»
 * quando la domanda arriva — e arriva sempre dopo, quando il passato non si
 * ricostruisce piu'.
 */
export async function authenticate(email: string, password: string): Promise<GestionaleAccount | null> {
  await ensureSeeded();
  const pulita = email.trim().toLowerCase();
  const acc = await prisma.appUser.findUnique({ where: { email: pulita } });

  const esito = !acc ? 'inesistente'
    : !acc.active ? 'account_spento'
      : acc.password !== password ? 'password_errata'
        : 'ok';

  await registraAccesso({ email: pulita, acc: esito === 'ok' ? acc : null, esito });

  return esito === 'ok' ? (acc as GestionaleAccount) : null;
}

/**
 * La riga dell'accesso, con da dove arriva.
 *
 * L'indirizzo IP e il dispositivo non identificano una persona con certezza —
 * su una rete mobile cambiano, in centro sono tutti sullo stesso wifi — ma
 * distinguono benissimo «da qui dentro» da «da fuori», che e' la domanda vera.
 *
 * Non blocca mai l'accesso: se la scrittura fallisce, si entra lo stesso.
 */
async function registraAccesso(p: {
  email: string;
  acc: { id: string; firstName: string; lastName: string; roleId: string } | null;
  esito: string;
}): Promise<void> {
  try {
    const h = await headers();
    // Dietro un proxy (Railway) l'IP vero sta nella catena x-forwarded-for: il
    // primo della lista e' il client, gli altri sono i passaggi intermedi.
    const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || null;
    await prisma.loginLog.create({
      data: {
        email: p.email,
        userId: p.acc?.id ?? null,
        nome: p.acc ? `${p.acc.firstName} ${p.acc.lastName}`.trim() : null,
        ruolo: p.acc?.roleId ?? null,
        esito: p.esito,
        ip,
        userAgent: (h.get('user-agent') || '').slice(0, 300) || null,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('[accessi] riga non scritta:', e);
  }
}

export interface AccessoRegistrato {
  id: string;
  email: string;
  nome: string | null;
  ruolo: string | null;
  esito: string;
  ip: string | null;
  dispositivo: string | null;
  quando: string;
}

/** Da che dispositivo, in parole. L'user agent per esteso non lo legge nessuno. */
function descriviDispositivo(ua?: string | null): string | null {
  const s = String(ua || '');
  if (!s) return null;
  const sistema = /iPhone|iPad/i.test(s) ? 'iPhone/iPad'
    : /Android/i.test(s) ? 'Android'
      : /Macintosh|Mac OS/i.test(s) ? 'Mac'
        : /Windows/i.test(s) ? 'Windows'
          : /Linux/i.test(s) ? 'Linux' : 'sconosciuto';
  const browser = /Edg\//i.test(s) ? 'Edge'
    : /OPR\//i.test(s) ? 'Opera'
      : /Chrome\//i.test(s) ? 'Chrome'
        : /Safari\//i.test(s) ? 'Safari'
          : /Firefox\//i.test(s) ? 'Firefox' : '';
  return browser ? `${sistema} · ${browser}` : sistema;
}

/** Gli accessi, dal piu' recente. Filtrabili per email quando si sospetta di qualcuno. */
export async function elencoAccessi(opts: { email?: string; limite?: number } = {}): Promise<AccessoRegistrato[]> {
  const righe = await prisma.loginLog.findMany({
    where: opts.email ? { email: opts.email.trim().toLowerCase() } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(opts.limite ?? 200, 1), 500),
  });
  return righe.map(r => ({
    id: r.id,
    email: r.email,
    nome: r.nome,
    ruolo: r.ruolo,
    esito: r.esito,
    ip: r.ip,
    dispositivo: descriviDispositivo(r.userAgent),
    quando: r.createdAt,
  }));
}

/** Ritorna un account per id (per aggiornare ruolo/stato della sessione corrente). */
export async function getAccountById(id: string): Promise<GestionaleAccount | null> {
  const acc = await prisma.appUser.findUnique({ where: { id } });
  return (acc as GestionaleAccount) ?? null;
}
