/**
 * Annulla (o riattiva) un desiderio della lista d'attesa.
 * Riattivare serve dopo un avviso andato a vuoto: il posto è sfumato
 * ma la voglia resta — un tocco e si torna in ascolto.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id || '');
  const azione = body?.azione === 'riattiva' ? 'riattiva' : 'annulla';

  const desiderio = await prisma.waitlistWish.findUnique({ where: { id } });
  if (!desiderio || desiderio.clientId !== cliente.id) {
    return Response.json({ error: 'Avviso non trovato.', code: 'NOT_FOUND' }, { status: 404 });
  }

  await prisma.waitlistWish.update({
    where: { id },
    data: { stato: azione === 'riattiva' ? 'attiva' : 'annullata' },
  });

  return Response.json({ ok: true });
}
