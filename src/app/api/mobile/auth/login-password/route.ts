/**
 * Accesso con numero + password: la porta normale dopo la prima volta.
 * La risposta ha la stessa forma dell'accesso diretto: token + utente.
 */

import { prisma } from '@/lib/prisma';
import { entraConPassword } from '@/lib/mobileAuth';
import { utenteApp } from '@/lib/mobileUser';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const esito = await entraConPassword(String(body?.telefono || ''), String(body?.password || ''));
  if (!esito.ok) {
    const status = esito.code === 'USER_NOT_FOUND' ? 404 : 401;
    return Response.json({ error: esito.error, code: 'INVALID_CREDENTIALS' }, { status });
  }

  const cliente = await prisma.client.findUnique({ where: { id: esito.clientId } });
  if (!cliente) {
    return Response.json({ error: 'Scheda cliente non trovata.', code: 'USER_NOT_FOUND' }, { status: 404 });
  }
  console.log(`[app clienti] accesso con password · ${esito.clientId} · ${esito.nome}`);
  return Response.json({ ok: true, token: esito.token, user: utenteApp(cliente), passwordDaImpostare: false });
}
