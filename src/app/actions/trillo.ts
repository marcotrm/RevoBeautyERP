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
  /** Quanti trilli di fila: al terzo si alza un po' il volume. */
  colpi: number;
}

/*
  Il trillo non e' rivolto a nessuno.

  Nella prima versione portava con se' il nome dell'operatrice, di quanto stava
  sforando e chi aspettava dopo, e lo scriveva a schermo. Ma quello schermo, in
  cabina, lo vede anche la cliente sdraiata li' accanto: sarebbe un rimprovero
  letto da chi non doveva leggerlo — esattamente la cosa che il trillo serve a
  evitare. Adesso e' solo un suono: chi lavora sa cosa vuol dire.
*/

/**
 * Manda il trillo. `da` e' un identificativo dello schermo che lo manda, non
 * una persona: serve solo a non far suonare il trillo a chi l'ha premuto.
 */
export async function mandaTrillo(p: { da: string }): Promise<{ ok: boolean }> {
  const adesso = Date.now();

  // Trilli ravvicinati si contano: uno e' un promemoria, tre di fila sono
  // un'altra cosa, e al terzo il volume sale un po'.
  const precedente = await leggiTrillo();
  const diSeguito = precedente && adesso - precedente.quando < 10 * 60_000;

  const trillo: Trillo = {
    quando: adesso,
    da: p.da,
    colpi: diSeguito ? (precedente?.colpi || 1) + 1 : 1,
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
