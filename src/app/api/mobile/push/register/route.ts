/**
 * L'app registra qui il token push del telefono, dopo il permesso iOS/Android.
 *
 * Il token è unico per dispositivo: se cambia proprietario (logout e accesso
 * di un'altra persona sullo stesso telefono) la riga passa alla nuova cliente,
 * così gli avvisi non arrivano mai all'account sbagliato.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token || '').trim();
  const platform = String(body?.platform || 'unknown');
  if (!token.startsWith('ExponentPushToken')) {
    return Response.json({ error: 'Token push non valido.', code: 'VALIDATION' }, { status: 400 });
  }

  const adesso = new Date().toISOString();
  await prisma.deviceToken.upsert({
    where: { token },
    update: { clientId: cliente.id, platform, lastSeenAt: adesso },
    create: { clientId: cliente.id, token, platform, createdAt: adesso, lastSeenAt: adesso },
  });

  return Response.json({ ok: true });
}
