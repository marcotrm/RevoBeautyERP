/**
 * Quanti messaggi dell'operatrice la cliente non ha ancora letto.
 *
 * Serve al pallino rosso sulla scheda Chat: si chiama spesso e non deve
 * pesare — un conteggio e basta, senza toccare lo stato di lettura
 * (quello lo cambia solo l'apertura vera della chat).
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const nonLetti = await prisma.chatMessage.count({
    where: { clientId: cliente.id, sender: 'operator', readByClient: false },
  });

  return Response.json({ nonLetti });
}
