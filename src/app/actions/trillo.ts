'use server';

/**
 * Il trillo: «stai andando lungo», detto senza dirlo.
 *
 * Quando una seduta sfora, il titolare non puo' entrare in cabina e dire
 * all'operatrice di sbrigarsi: la cliente e' li' che sente tutto, e sentirsi
 * dire che il suo trattamento sta rubando tempo e' il modo piu' veloce di
 * perderla. Cosi' non lo dice nessuno, e l'appuntamento dopo slitta.
 *
 * Il trillo e' il vecchio "trillo" di MSN: si preme un tasto da una parte e
 * dall'altra parte suona. L'operatrice capisce, la cliente sente un suono
 * qualunque del gestionale — come i tre bip di fine trattamento, che in quel
 * centro suonano tutto il giorno.
 *
 * Non e' una notifica push e non serve niente di installato: e' una riga nel
 * database che gli schermi aperti guardano ogni pochi secondi. Il gestionale
 * e' gia' aperto su ogni tablet del centro, ed e' l'unica cosa che serve.
 */

import { prisma } from '@/lib/prisma';

const RIGA = 'trillo:ultimo';

export interface Trillo {
  /** Millisecondi: e' anche l'identita' del trillo, per non risuonarlo due volte. */
  quando: number;
  /** Chi l'ha mandato, per non farlo suonare sul suo stesso schermo. */
  da: string;
  /** A chi e' diretto: il nome si vede solo sullo schermo, non si sente. */
  operatrice?: string;
  /** Di quanto sta sforando, quando si sa. */
  minutiRitardo?: number;
  /** Chi aspetta dopo: e' l'informazione che rende utile il trillo. */
  prossima?: string;
  /** Quanti trilli di fila: al terzo si capisce che e' urgente. */
  colpi: number;
}

/**
 * Manda il trillo. `da` e' un identificativo dello schermo che lo manda, non
 * una persona: serve solo a non far suonare il trillo a chi l'ha premuto.
 */
export async function mandaTrillo(p: {
  da: string;
  operatrice?: string;
  minutiRitardo?: number;
  prossima?: string;
}): Promise<{ ok: boolean }> {
  const adesso = Date.now();

  // Trilli ravvicinati alla stessa operatrice si contano: uno e' un promemoria,
  // tre di fila sono un problema, e chi guarda lo schermo deve vedere quale dei
  // due sta succedendo.
  const precedente = await leggiTrillo();
  const stessaCorsa = precedente
    && precedente.operatrice === p.operatrice
    && adesso - precedente.quando < 10 * 60_000;

  const trillo: Trillo = {
    quando: adesso,
    da: p.da,
    operatrice: p.operatrice,
    minutiRitardo: p.minutiRitardo,
    prossima: p.prossima,
    colpi: stessaCorsa ? (precedente?.colpi || 1) + 1 : 1,
  };

  await prisma.adminEntry.upsert({
    where: { rowId: RIGA },
    update: { data: trillo as unknown as object },
    create: {
      rowId: RIGA, kind: 'trillo', entityId: 'ultimo',
      data: trillo as unknown as object, createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}

/** L'ultimo trillo, se e' fresco. Quelli vecchi non si risuonano mai. */
export async function leggiTrillo(): Promise<Trillo | null> {
  try {
    const r = await prisma.adminEntry.findUnique({ where: { rowId: RIGA } });
    const d = r?.data as unknown as Trillo | null;
    if (!d || typeof d.quando !== 'number') return null;
    /*
      Due minuti di validita'.

      Uno schermo riaperto dopo un'ora non deve suonare un trillo di un'ora
      fa: quel momento e' passato, l'appuntamento e' finito, e un suono senza
      motivo insegna a ignorare i suoni.
    */
    if (Date.now() - d.quando > 120_000) return null;
    return d;
  } catch {
    return null;
  }
}
