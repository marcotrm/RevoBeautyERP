/**
 * Il Revo Score della cliente: punteggio, componenti spiegati, evoluzione.
 * Il calcolo è sempre fresco; lo storico viene dagli snapshot notturni.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { calcolaScore } from '@/lib/engines/score';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const [score, storico] = await Promise.all([
    calcolaScore(cliente.id),
    prisma.scoreSnapshot.findMany({
      where: { clientId: cliente.id },
      orderBy: { data: 'desc' },
      take: 60,
      select: { data: true, totale: true },
    }),
  ]);

  // «+7 questo mese»: il confronto con lo snapshot più vecchio degli ultimi 30 giorni
  const mesefa = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const base = [...storico].reverse().find((s) => s.data >= mesefa);
  const delta30 = base ? score.totale - base.totale : 0;

  return Response.json({
    totale: score.totale,
    livello: score.livello,
    componenti: score.componenti,
    delta30,
    storico: storico.reverse(),
  });
}
