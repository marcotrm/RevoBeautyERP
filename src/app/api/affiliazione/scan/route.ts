/**
 * Registra una scansione di un QR affiliato. La landing la chiama una volta
 * quando si apre: da qui nascono i contatori "scansioni" e "scansioni uniche"
 * (il visitorId è un id anonimo che il telefono si tiene in localStorage).
 */

import prisma from '@/lib/prisma';
import { descriviDevice } from '@/lib/affiliazione';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug || '');
  const visitorId = body?.visitorId ? String(body.visitorId).slice(0, 64) : null;
  if (!slug) return Response.json({ ok: false }, { status: 400 });

  const qr = await prisma.affiliateQr.findUnique({ where: { slug }, select: { id: true } });
  if (!qr) return Response.json({ ok: false }, { status: 404 });

  await prisma.affiliateScan.create({
    data: {
      qrId: qr.id,
      visitorId,
      device: descriviDevice(request.headers.get('user-agent')),
      at: new Date().toISOString(),
    },
  });
  return Response.json({ ok: true });
}
