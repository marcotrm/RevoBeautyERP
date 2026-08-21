/**
 * Il regalo di compleanno, che qualcuno deve pur ricordarsi.
 *
 * Il messaggio degli auguri promette uno sconto valido fino a una data. Finora
 * la promessa viveva solo dentro a quel messaggio WhatsApp: se la cliente
 * arrivava tre settimane dopo, l'unica speranza era che se lo ricordasse lei —
 * e che chi era al banco le credesse. Un regalo che dipende dalla memoria di
 * chi lo riceve non è un regalo, è un dispetto.
 *
 * Quindi ogni volta che partono gli auguri si scrive un buono: quanto sconto,
 * da quando, fino a quando. Compare nella scheda della cliente, in agenda
 * quando la si prenota, e si scala da solo in cassa la prima volta che viene.
 * Poi si chiude: vale una volta sola, come dice il messaggio.
 */

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';

export const KIND_BUONO = 'buono:compleanno';

export interface BuonoCompleanno {
  clientId: string;
  /** Percentuale di sconto, es. 20. */
  percento: number;
  /** Il primo giorno buono: quello degli auguri. */
  dal: string;
  /** L'ultimo giorno buono, compreso. */
  scadenza: string;
  /** Quando è stato usato, se è stato usato. */
  usatoIl?: string;
  /** L'incasso in cui è stato scalato: serve a ritrovarlo se qualcosa non torna. */
  transazioneId?: string;
}

function rowId(clientId: string, anno: string): string {
  return `${KIND_BUONO}:${clientId}:${anno}`;
}

function leggi(data: unknown): BuonoCompleanno | null {
  const d = (data || {}) as Partial<BuonoCompleanno>;
  if (!d.clientId || !d.percento || !d.scadenza) return null;
  return {
    clientId: d.clientId,
    percento: d.percento,
    dal: d.dal || '',
    scadenza: d.scadenza,
    usatoIl: d.usatoIl,
    transazioneId: d.transazioneId,
  };
}

/**
 * Estrae la percentuale dal testo scritto nelle impostazioni ("il 20%").
 * Se non si capisce, niente buono: meglio nessuno sconto che uno sbagliato.
 */
export function percentoDa(testo: string | null | undefined): number | null {
  const m = /(\d{1,2})\s*%/.exec(testo || '');
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n <= 90 ? n : null;
}

/** Scrive il buono quando partono gli auguri. Non sovrascrive quello già usato. */
export async function creaBuonoCompleanno(params: {
  clientId: string; percento: number; dal: string; scadenza: string;
}): Promise<void> {
  const anno = params.dal.slice(0, 4);
  const id = rowId(params.clientId, anno);
  const esistente = await prisma.adminEntry.findUnique({ where: { rowId: id } });
  if (esistente && leggi(esistente.data)?.usatoIl) return;

  const buono: BuonoCompleanno = {
    clientId: params.clientId,
    percento: params.percento,
    dal: params.dal,
    scadenza: params.scadenza,
  };
  await prisma.adminEntry.upsert({
    where: { rowId: id },
    update: { data: buono as unknown as object },
    create: {
      rowId: id, kind: KIND_BUONO, entityId: params.clientId,
      data: buono as unknown as object, createdAt: new Date().toISOString(),
    },
  });
}

/** Il buono ancora spendibile di una cliente, se ce n'è uno. */
export async function buonoAttivo(clientId: string | null | undefined): Promise<BuonoCompleanno | null> {
  if (!clientId) return null;
  const righe = await prisma.adminEntry.findMany({ where: { kind: KIND_BUONO, entityId: clientId } });
  const oggi = todayRome();
  for (const r of righe) {
    const b = leggi(r.data);
    if (b && !b.usatoIl && b.scadenza >= oggi) return b;
  }
  return null;
}

/** Tutti i buoni ancora spendibili, per fare un solo giro di database. */
export async function buoniAttivi(clientIds: string[]): Promise<Map<string, BuonoCompleanno>> {
  const ids = [...new Set(clientIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const righe = await prisma.adminEntry.findMany({
    where: { kind: KIND_BUONO, entityId: { in: ids } },
  });
  const oggi = todayRome();
  const mappa = new Map<string, BuonoCompleanno>();
  for (const r of righe) {
    const b = leggi(r.data);
    if (b && !b.usatoIl && b.scadenza >= oggi) mappa.set(b.clientId, b);
  }
  return mappa;
}

/** Lo chiude: da qui in poi non si scala più. */
export async function consumaBuono(clientId: string, transazioneId?: string): Promise<void> {
  const righe = await prisma.adminEntry.findMany({ where: { kind: KIND_BUONO, entityId: clientId } });
  const oggi = todayRome();
  for (const r of righe) {
    const b = leggi(r.data);
    if (!b || b.usatoIl || b.scadenza < oggi) continue;
    await prisma.adminEntry.update({
      where: { rowId: r.rowId },
      data: { data: { ...b, usatoIl: new Date().toISOString(), transazioneId } as unknown as object },
    });
    return;
  }
}
