/**
 * Le preferenze notifiche, in mano alla cliente: promo, auguri e occasioni
 * si spengono e si riaccendono da qui. I promemoria dei suoi appuntamenti
 * e la chat restano sempre attivi: sono servizio, non pubblicità.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';

const FAMIGLIE = ['promo', 'auguri', 'occasioni'] as const;

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const account = await prisma.mobileAccount.findUnique({
    where: { clientId: cliente.id },
    select: { notifichePreferenze: true },
  });
  const pref = (account?.notifichePreferenze ?? {}) as Record<string, boolean>;

  return Response.json({
    preferenze: {
      promo: pref.promo !== false,
      auguri: pref.auguri !== false,
      occasioni: pref.occasioni !== false,
    },
  });
}

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const nuove: Record<string, boolean> = {};
  for (const f of FAMIGLIE) {
    if (typeof body?.[f] === 'boolean') nuove[f] = body[f];
  }
  if (Object.keys(nuove).length === 0) {
    return Response.json({ error: 'Niente da salvare.' }, { status: 400 });
  }

  const account = await prisma.mobileAccount.findUnique({
    where: { clientId: cliente.id },
    select: { id: true, notifichePreferenze: true },
  });
  if (!account) {
    return Response.json({ error: 'Account non trovato.', code: 'NOT_FOUND' }, { status: 404 });
  }

  const unite = { ...((account.notifichePreferenze ?? {}) as Record<string, boolean>), ...nuove };
  await prisma.mobileAccount.update({
    where: { id: account.id },
    data: { notifichePreferenze: unite },
  });

  return Response.json({ ok: true, preferenze: unite });
}
