/**
 * Secondo passo dell'accesso: la cliente digita il codice, qui nasce la sessione.
 *
 * In risposta torna anche la scheda cliente, così l'app ha già tutto e non deve
 * fare subito una seconda chiamata solo per sapere come si chiama chi è entrata.
 */

import { verificaCodice } from '@/lib/mobileAuth';
import { prisma } from '@/lib/prisma';
import { utenteApp } from '@/lib/mobileUser';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const telefono = String(body?.telefono || body?.phone || '');
  const codice = String(body?.codice || body?.code || '');

  const esito = await verificaCodice(telefono, codice);
  if (!esito.ok) {
    const status = esito.code === 'USER_NOT_FOUND' ? 404 : esito.code === 'TOO_MANY' ? 429 : 401;
    return Response.json({ error: esito.error, code: esito.code }, { status });
  }

  const cliente = await prisma.client.findUnique({ where: { id: esito.clientId } });
  if (!cliente) {
    return Response.json({ error: 'Scheda cliente non trovata.', code: 'USER_NOT_FOUND' }, { status: 404 });
  }

  return Response.json({ token: esito.token, user: utenteApp(cliente) });
}
