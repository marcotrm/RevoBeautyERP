'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import { apriSessione, chiudiSessione } from '@/lib/sessione';
import { descriviDispositivo } from '@/lib/dispositivo';
import { sendTelegram } from '@/lib/telegram';
import { DEFAULT_ACCOUNTS } from '@/lib/rolesConfig';

export interface GestionaleAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  /*
    Non esce piu' di qui.

    Prima l'elenco account tornava la password in chiaro e la finestra di
    modifica la mostrava scritta: bastava aprire quella schermata — o guardare
    la risposta della chiamata — per leggere le password di tutti. Adesso in
    archivio c'e' un hash, e da qui esce sempre stringa vuota: per cambiarla si
    scrive quella nuova, non si legge quella vecchia.
  */
  password: string;
  roleId: string;
  active: boolean;
  createdAt: string;
}

/** Un hash bcrypt si riconosce dal prefisso: $2a$, $2b$, $2y$. */
const eHash = (v: string) => /^\$2[aby]\$/.test(String(v || ''));

/** Fuori non esce mai niente che assomigli a una password. */
const senzaPassword = (a: { password: string } & Record<string, unknown>) =>
  ({ ...a, password: '' }) as GestionaleAccount;

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
  return rows.map(senzaPassword);
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
      password: bcrypt.hashSync(data.password, 10),
      roleId: data.roleId,
      active: data.active,
      createdAt: new Date().toISOString().slice(0, 10),
    },
  });
  return senzaPassword(row);
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
  /*
    La password si cambia solo se ne arriva una nuova.

    Il modulo la manda vuota quando non la si tocca: scriverla cosi' com'e'
    vorrebbe dire azzerare la password di qualcuno modificandogli il cognome.
  */
  if ('password' in data) {
    const nuova = String(data.password || '');
    if (!nuova.trim()) { const { password: _p, ...resto } = data; data = resto; }
    else data = { ...data, password: bcrypt.hashSync(nuova, 10) };
  }
  const row = await prisma.appUser.update({ where: { id }, data });
  return senzaPassword(row);
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

  /*
    Le password vecchie sono in chiaro: si accettano una volta sola.

    Cambiarle tutte di colpo vorrebbe dire chiudere fuori il centro nel mezzo
    di una giornata di lavoro. Cosi' invece il primo accesso di ognuno la
    riscrive come hash e da li' in poi in archivio non c'e' piu' niente da
    leggere. Chi non entra mai resta in chiaro finche' non entra: e' il motivo
    per cui va comunque cambiata a mano quella degli account fermi.
  */
  const giusta = !acc ? false
    : eHash(acc.password) ? bcrypt.compareSync(password, acc.password)
      : acc.password === password;

  const esito = !acc ? 'inesistente'
    : !acc.active ? 'account_spento'
      : !giusta ? 'password_errata'
        : 'ok';

  await registraAccesso({ email: pulita, acc: esito === 'ok' ? acc : null, esito });
  if (esito !== 'ok' || !acc) return null;

  if (!eHash(acc.password)) {
    await prisma.appUser.update({
      where: { id: acc.id },
      data: { password: bcrypt.hashSync(password, 10) },
    }).catch(() => {});
  }

  /*
    Da qui in poi la sessione vive anche sul server.

    Il cookie firmato e' quello che permette alle API di sapere chi sta
    chiamando: senza, l'unica prova di essere entrati era una riga nel browser
    — che chiunque abbia il tablet in mano puo' scriversi da solo.
  */
  await apriSessione({
    tipo: 'operatrice',
    accountId: acc.id,
    roleId: acc.roleId,
    nome: `${acc.firstName} ${acc.lastName}`.trim(),
  });

  return senzaPassword(acc);
}

/** Esce davvero: il cookie non scade, si cancella. */
export async function esci(): Promise<void> {
  await chiudiSessione();
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
    const dispositivo = descriviDispositivo(h.get('user-agent'));
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

    /*
      L'avviso su Telegram, per gli account che si tengono d'occhio.

      Un registro lo si guarda quando si sospetta gia' qualcosa; un messaggio
      arriva mentre sta succedendo. E serve soprattutto per un account che NON
      deve piu' entrare: li' la notizia e' il tentativo respinto, non
      l'ingresso.
    */
    if (await sorvegliato(p.email)) {
      const esiti: Record<string, string> = {
        ok: '\u{1F534} <b>E\' ENTRATO nel gestionale</b>',
        password_errata: '\u26A0\uFE0F <b>Tentativo con password sbagliata</b>',
        account_spento: '\u26A0\uFE0F <b>Ha provato a entrare</b> (account spento, respinto)',
        inesistente: '\u26A0\uFE0F <b>Tentativo con una email che non esiste</b>',
      };
      const ora = new Date().toLocaleString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
        timeZone: 'Europe/Rome',
      });
      sendTelegram(
        `${esiti[p.esito] || p.esito}\n`
        + `Account: ${p.email}\n`
        + `Quando: ${ora}\n`
        + `Da: ${ip || 'indirizzo sconosciuto'}${dispositivo ? ` \u00B7 ${dispositivo}` : ''}`
      ).catch(() => {});
    }
  } catch (e) {
    console.error('[accessi] riga non scritta:', e);
  }
}

// ============================================================
// Gli account da tenere d'occhio
// ============================================================

const RIGA_SORVEGLIATI = 'accessi:sorvegliati';

/** Le email per cui, a ogni tentativo, parte un avviso su Telegram. */
export async function accountSorvegliati(): Promise<string[]> {
  try {
    const r = await prisma.adminEntry.findUnique({ where: { rowId: RIGA_SORVEGLIATI } });
    const e = (r?.data as { email?: unknown } | null)?.email;
    return Array.isArray(e) ? e.map(String) : [];
  } catch {
    return [];
  }
}

async function sorvegliato(email: string): Promise<boolean> {
  const elenco = await accountSorvegliati();
  return elenco.includes(email.trim().toLowerCase());
}

export async function impostaSorveglianza(email: string, attiva: boolean): Promise<{ ok: boolean }> {
  const e = email.trim().toLowerCase();
  if (!e) return { ok: false };
  const attuali = await accountSorvegliati();
  const nuovi = attiva ? [...new Set([...attuali, e])] : attuali.filter(x => x !== e);
  await prisma.adminEntry.upsert({
    where: { rowId: RIGA_SORVEGLIATI },
    update: { data: { email: nuovi } },
    create: {
      rowId: RIGA_SORVEGLIATI, kind: 'accessi', entityId: 'sorvegliati',
      data: { email: nuovi }, createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
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
  /** Quanti minuti ci e' rimasto davvero. */
  minuti: number;
  /** L'ultima volta che ha toccato qualcosa: se e' adesso, e' ancora dentro. */
  ultimaAttivita: string | null;
}

/*
  Quanto tempo ci resta dentro.

  Il login dice quando entra, non quanto ci sta: chi chiude la finestra non
  fa il logout, quindi la fine non arriva mai. Allora e' il browser a farsi
  vivo ogni due minuti finche' la pagina e' aperta e qualcuno la sta usando;
  la somma di quei battiti e' il tempo vero. Se resta aperta in un angolo
  senza che nessuno la tocchi smette di contare, altrimenti chi lascia il
  gestionale acceso tutto il giorno risulterebbe al lavoro otto ore.
*/
const BATTITO_MINUTI = 2;

export async function segnalaPresenza(userId: string): Promise<{ ok: boolean }> {
  if (!userId) return { ok: false };
  try {
    const riga = await prisma.loginLog.findFirst({
      where: { userId, esito: 'ok' },
      orderBy: { createdAt: 'desc' },
    });
    if (!riga) return { ok: false };
    const adesso = Date.now();
    const prima = Date.parse(riga.ultimaAttivita || riga.createdAt);
    // Un buco piu' lungo di un battito e mezzo e' una pausa, non lavoro:
    // di quel tempo si conta solo il battito, non l'assenza.
    const passati = Number.isNaN(prima) ? 0 : (adesso - prima) / 60000;
    const aggiunta = Math.max(0, Math.min(Math.round(passati), BATTITO_MINUTI + 1));
    await prisma.loginLog.update({
      where: { id: riga.id },
      data: { ultimaAttivita: new Date(adesso).toISOString(), minuti: riga.minuti + aggiunta },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
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
    minuti: r.minuti,
    ultimaAttivita: r.ultimaAttivita,
  }));
}

/** Ritorna un account per id (per aggiornare ruolo/stato della sessione corrente). */
export async function getAccountById(id: string): Promise<GestionaleAccount | null> {
  const acc = await prisma.appUser.findUnique({ where: { id } });
  return acc ? senzaPassword(acc) : null;
}
