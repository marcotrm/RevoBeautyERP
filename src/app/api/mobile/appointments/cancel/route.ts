/**
 * Disdetta di un appuntamento dall'app.
 *
 * Non si cancella la riga: si mette lo stato 'cancelled' con la motivazione,
 * così in agenda resta traccia di chi ha disdetto e quando — serve sia per le
 * statistiche di affidabilità, sia per capire se un buco è stato liberato in
 * tempo per rivenderlo.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { disdettabile } from '@/lib/mobileAppuntamenti';

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.appointmentId || '');
  if (!id) {
    return Response.json({ error: 'Appuntamento non indicato.', code: 'VALIDATION' }, { status: 400 });
  }

  const appuntamento = await prisma.appointment.findUnique({ where: { id } });
  // Stesso messaggio se non esiste o se è di un'altra cliente: rispondere in
  // due modi diversi direbbe a un curioso quali id esistono davvero.
  if (!appuntamento || appuntamento.clientId !== cliente.id) {
    return Response.json({ error: 'Appuntamento non trovato.', code: 'NOT_FOUND' }, { status: 404 });
  }

  const esito = disdettabile(appuntamento);
  if (!esito.ok) {
    return Response.json({ error: esito.error, code: esito.code }, { status: 409 });
  }

  const adesso = new Date().toISOString();
  await prisma.appointment.update({
    where: { id },
    data: {
      status: 'cancelled',
      cancelReason: 'Disdetta dalla cliente dall\'app',
      cancelledAt: adesso,
      updatedAt: adesso,
    },
  });

  return Response.json({ success: true });
}
