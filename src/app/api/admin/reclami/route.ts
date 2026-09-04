/**
 * I reclami anonimi, per il pannello: si leggono e si segnano letti.
 * Non c'è nessuna identità da mostrare: è il punto.
 */

import { prisma } from '@/lib/prisma';

export async function GET() {
  const reclami = await prisma.reclamo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const nonLetti = reclami.filter((r) => !r.letto).length;
  return Response.json({ reclami, nonLetti });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const id = String(body?.id || '');
  await prisma.reclamo.update({ where: { id }, data: { letto: true } }).catch(() => null);
  return Response.json({ ok: true });
}
