/**
 * Il centro azzera la password dell'app di una cliente che l'ha dimenticata.
 * Al prossimo accesso ne creerà una nuova (entrando col numero, come la
 * prima volta). L'identità la verifica lo staff, di persona o al telefono.
 */

import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const secret = process.env.JOBS_SECRET || process.env.VOICE_API_SECRET;
  const header = request.headers.get('authorization') || '';
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const clientId = String(body?.clientId || '');
  const account = await prisma.mobileAccount.findUnique({ where: { clientId } });
  if (!account) return Response.json({ error: 'Account app non trovato' }, { status: 404 });

  await prisma.mobileAccount.update({
    where: { id: account.id },
    data: { passwordHash: null, sessionToken: null }, // fuori anche dalle sessioni aperte
  });
  return Response.json({ ok: true });
}
