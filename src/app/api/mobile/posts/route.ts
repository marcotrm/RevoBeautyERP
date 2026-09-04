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

  const posts = await prisma.appPost.findMany({
    where: { attivo: true },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { id: true, tipo: true, titolo: true, testo: true, foto: true, createdAt: true },
  });

  return Response.json({ posts });
}
