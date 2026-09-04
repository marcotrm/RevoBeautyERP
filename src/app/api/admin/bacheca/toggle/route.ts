/**
 * Spegnere (o riaccendere) un post della bacheca, o eliminarlo del tutto.
 * Spegnere è la via normale: la promo di ieri non si cancella, esce di scena.
 */

import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const id = String(body?.id || '');
  const azione = String(body?.azione || 'spegni');

  const post = await prisma.appPost.findUnique({ where: { id } });
  if (!post) return Response.json({ error: 'Post non trovato' }, { status: 404 });

  if (azione === 'elimina') {
    await prisma.appPost.delete({ where: { id } });
    return Response.json({ ok: true });
  }

  await prisma.appPost.update({
    where: { id },
    data: { attivo: azione === 'accendi' },
  });
  return Response.json({ ok: true });
}
