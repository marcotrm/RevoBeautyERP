/**
 * La bacheca per l'app: promo del giorno e lavori del salone.
 * Solo i post accesi, i più recenti prima. Quindici alla volta:
 * le foto viaggiano dentro la risposta e il rullino non è infinito.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  // ?limit=1 per la Home, che vuole solo l'ultimo; il feed li chiede tutti
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get('limit')) || 15, 1), 15);
  const posts = await prisma.appPost.findMany({
    where: { attivo: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, tipo: true, titolo: true, testo: true, foto: true, createdAt: true },
  });

  return Response.json({ posts });
}
