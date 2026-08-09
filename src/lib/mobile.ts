/**
 * Riconoscere la cliente collegata all'app, dal token di sessione.
 *
 * Il token arriva in `Authorization: Bearer <token>` oppure in
 * `x-session-token`. Nel database non finisce mai in chiaro: si salva il suo
 * hash, così chi legge la tabella non può usarlo per entrare negli account. La
 * conversione la fa `lib/mobileAuth`, che è anche il posto dove il token nasce:
 * tenere insieme creazione e verifica evita di ritrovarsi, come è già successo,
 * con una parte che scrive l'hash e un'altra che cerca il valore in chiaro.
 */

import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/mobileAuth';

export async function getAccountFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const sessionToken = bearerToken || request.headers.get('x-session-token');

  if (!sessionToken) return null;

  const account = await prisma.mobileAccount.findUnique({
    where: { sessionToken: hashToken(sessionToken) },
    include: { client: true },
  });

  return account;
}

export function unauthorized() {
  return Response.json({ error: 'Non autorizzato.', code: 'UNAUTHORIZED' }, { status: 401 });
}
