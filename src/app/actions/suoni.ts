'use server';

/**
 * Il suono del trillo, quando il centro ne vuole uno suo.
 *
 * Quello che il gestionale genera da solo e' una ricostruzione: il trillo
 * vero di MSN e' un file di Microsoft, e un file di qualcun altro non si
 * incolla dentro il prodotto di qualcun altro ancora. Chi quel file ce l'ha —
 * o ne vuole un altro qualunque — lo carica qui e da quel momento il tasto
 * suona il suo.
 *
 * Sta nel database e non fra i file del sito perche' e' una preferenza del
 * centro, come il logo o gli orari: cambia senza che nessuno rilasci niente.
 */

import { prisma } from '@/lib/prisma';

const RIGA = 'integration:suono-trillo';

/** Mezzo megabyte scarso: un trillo dura un secondo, non e' una canzone. */
const MASSIMO = 400_000;

export async function leggiSuonoTrillo(): Promise<{ dataUrl: string; nome: string } | null> {
  try {
    const r = await prisma.adminEntry.findUnique({ where: { rowId: RIGA } });
    const d = r?.data as { dataUrl?: string; nome?: string } | null;
    if (!d?.dataUrl) return null;
    return { dataUrl: d.dataUrl, nome: d.nome || 'suono personalizzato' };
  } catch {
    return null;
  }
}

export async function salvaSuonoTrillo(dataUrl: string, nome: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^data:audio\/(mpeg|mp3|wav|x-wav|ogg|webm)/i.test(dataUrl)) {
    return { ok: false, error: 'Serve un file audio (mp3, wav o ogg).' };
  }
  if (dataUrl.length > MASSIMO) {
    return { ok: false, error: 'Il file è troppo pesante: serve un suono corto, sotto i 300 KB.' };
  }
  await prisma.adminEntry.upsert({
    where: { rowId: RIGA },
    update: { data: { dataUrl, nome } },
    create: {
      rowId: RIGA, kind: 'integration', entityId: 'suono-trillo',
      data: { dataUrl, nome }, createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}

/** Torna a quello costruito dal gestionale. */
export async function togliSuonoTrillo(): Promise<{ ok: boolean }> {
  await prisma.adminEntry.deleteMany({ where: { rowId: RIGA } });
  return { ok: true };
}
