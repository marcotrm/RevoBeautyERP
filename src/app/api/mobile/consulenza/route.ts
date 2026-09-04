/**
 * La consulenza digitale: la cliente racconta cosa vorrebbe migliorare e
 * la richiesta arriva al centro. Il software non prescrive niente: chiude
 * sempre con «ne parliamo insieme», mai con un trattamento deciso da solo.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { AREE_CONSULENZA } from '@/lib/estetica';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const richieste = await prisma.consulenzaApp.findMany({
    where: { clientId: cliente.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, aree: true, desiderio: true, stato: true, percorsoId: true, createdAt: true },
  });

  return Response.json({ aree: AREE_CONSULENZA, richieste });
}

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const aree = (Array.isArray(body?.aree) ? body.aree : [])
    .map((a: unknown) => String(a).trim())
    .filter((a: string) => AREE_CONSULENZA.includes(a));
  const desiderio = String(body?.desiderio ?? '').trim().slice(0, 1500);

  if (aree.length === 0) {
    return Response.json({ error: 'Scegli almeno un\'area.' }, { status: 400 });
  }

  // Una richiesta aperta alla volta: la seconda in coda confonderebbe tutte.
  const aperta = await prisma.consulenzaApp.findFirst({
    where: { clientId: cliente.id, stato: { in: ['nuova', 'in_carico'] } },
  });
  if (aperta) {
    return Response.json(
      { error: 'Hai già una richiesta in lavorazione: ti risponderemo a breve!' },
      { status: 409 }
    );
  }

  const ora = new Date().toISOString();
  const richiesta = await prisma.consulenzaApp.create({
    data: {
      clientId: cliente.id,
      clientName: `${cliente.firstName} ${cliente.lastName}`.trim(),
      aree: aree as unknown as object,
      desiderio,
      stato: 'nuova',
      createdAt: ora,
      updatedAt: ora,
    },
  });

  return Response.json({ ok: true, id: richiesta.id });
}
