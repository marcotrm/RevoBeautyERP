'use server';

/**
 * Registro autoclave: le disinfezioni serali degli attrezzi.
 *
 * È un registro da controlli (ASL): si scrive ogni sera, si consulta per
 * periodo, si stampa o si scarica in PDF. Le righe portano il nome
 * dell'operatrice scritto per esteso, così il registro resta leggibile
 * anche a distanza di anni.
 */

import { prisma } from '@/lib/prisma';

export interface Disinfezione {
  id: string;
  date: string;         // giorno YYYY-MM-DD
  operatorId: string;
  operatorName: string;
  pieces: number;
  notes: string | null;
  createdAt: string;    // ISO
}

/** Le disinfezioni nel periodo [dal, al] (giorni inclusi), più recenti prima. */
export async function listaDisinfezioni(dal: string, al: string): Promise<Disinfezione[]> {
  return prisma.autoclaveCycle.findMany({
    where: { date: { gte: dal, lte: al } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function aggiungiDisinfezione(params: {
  date: string;
  operatorId: string;
  operatorName: string;
  pieces: number;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) return { ok: false, error: 'Data non valida.' };
  if (!params.operatorId || !params.operatorName.trim()) return { ok: false, error: 'Scegli l\'operatrice.' };
  const pezzi = Math.floor(params.pieces);
  if (!pezzi || pezzi <= 0) return { ok: false, error: 'Indica quanti pezzi hai inserito nella macchina.' };

  await prisma.autoclaveCycle.create({
    data: {
      date: params.date,
      operatorId: params.operatorId,
      operatorName: params.operatorName.trim(),
      pieces: pezzi,
      notes: params.notes?.trim() || null,
      createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}

/** Cancella una riga (errore di battitura): il registro è del centro, decide lui. */
export async function eliminaDisinfezione(id: string): Promise<{ ok: boolean }> {
  await prisma.autoclaveCycle.delete({ where: { id } }).catch(() => {});
  return { ok: true };
}
