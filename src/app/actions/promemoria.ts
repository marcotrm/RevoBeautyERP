'use server';

/**
 * Promemoria sulla cliente: le cose da chiederle quando è qui.
 *
 * Nasce da un problema concreto: "il 18 devo ricordarmi di chiedere una cosa a
 * questa cliente". Scritto in un foglietto si perde, scritto nelle note della
 * scheda lo legge solo chi apre la scheda — e al banco nessuno la apre. Qui il
 * promemoria va a cercarlo lui: salta fuori al check-in, quando la persona è
 * davanti e la domanda si può fare davvero.
 */

import { prisma } from '@/lib/prisma';

export interface Promemoria {
  id: string;
  clientId: string;
  testo: string;
  creatoDa?: string;
  createdAt: string;
  fattoIl?: string;
  fattoDa?: string;
}

/** Quelli ancora aperti di una cliente, dal più vecchio (è il più atteso). */
export async function promemoriaAperti(clientId: string): Promise<Promemoria[]> {
  if (!clientId) return [];
  const righe = await prisma.clientReminder.findMany({
    where: { clientId, fattoIl: null },
    orderBy: { createdAt: 'asc' },
  });
  return righe.map(r => ({
    id: r.id, clientId: r.clientId, testo: r.testo,
    creatoDa: r.creatoDa || undefined, createdAt: r.createdAt,
  }));
}

/** Tutti, anche quelli già fatti: serve alla scheda per vedere lo storico. */
export async function promemoriaDi(clientId: string, conFatti = false): Promise<Promemoria[]> {
  if (!clientId) return [];
  const righe = await prisma.clientReminder.findMany({
    where: { clientId, ...(conFatti ? {} : { fattoIl: null }) },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return righe.map(r => ({
    id: r.id, clientId: r.clientId, testo: r.testo,
    creatoDa: r.creatoDa || undefined, createdAt: r.createdAt,
    fattoIl: r.fattoIl || undefined, fattoDa: r.fattoDa || undefined,
  }));
}

/**
 * Quali clienti hanno qualcosa in sospeso.
 *
 * Serve all'agenda per mettere il segnale sul blocco: si chiede una volta per
 * tutta la giornata invece di una interrogazione per appuntamento.
 */
export async function clientiConPromemoria(): Promise<string[]> {
  const righe = await prisma.clientReminder.findMany({
    where: { fattoIl: null },
    select: { clientId: true },
    distinct: ['clientId'],
    take: 500,
  });
  return righe.map(r => r.clientId);
}

export async function aggiungiPromemoria(params: {
  clientId: string;
  testo: string;
  creatoDa?: string;
}): Promise<{ ok: boolean; errore?: string }> {
  const testo = params.testo.trim();
  if (!params.clientId) return { ok: false, errore: 'Manca la cliente' };
  if (!testo) return { ok: false, errore: 'Scrivi cosa devi ricordare' };

  await prisma.clientReminder.create({
    data: {
      clientId: params.clientId,
      testo,
      creatoDa: params.creatoDa?.trim() || null,
      createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}

/**
 * Segnato fatto: da qui non compare più al check-in.
 *
 * Non si cancella: resta la traccia di cosa è stato chiesto e da chi, che è
 * proprio quello che serve quando fra un mese qualcuno chiede "ma gliel'avete
 * detto?".
 */
export async function segnaPromemoriaFatto(id: string, chi?: string): Promise<{ ok: boolean }> {
  await prisma.clientReminder.update({
    where: { id },
    data: { fattoIl: new Date().toISOString(), fattoDa: chi?.trim() || null },
  }).catch(() => {});
  return { ok: true };
}

/** Solo per quelli scritti per sbaglio: sparisce davvero. */
export async function eliminaPromemoria(id: string): Promise<{ ok: boolean }> {
  await prisma.clientReminder.delete({ where: { id } }).catch(() => {});
  return { ok: true };
}
