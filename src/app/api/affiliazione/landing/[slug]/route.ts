/**
 * Dati della landing di un QR affiliato: chi ti manda, cosa ti regala, a che
 * condizioni. È pubblica (la apre chi scansiona), quindi espone solo il minimo.
 */

import prisma from '@/lib/prisma';
import { statoEffettivo, CENTRO } from '@/lib/affiliazione';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const qr = await prisma.affiliateQr.findUnique({
    where: { slug },
    include: { affiliate: { select: { businessName: true, isActive: true } } },
  });
  if (!qr || !qr.affiliate.isActive) {
    return Response.json({ ok: false, error: 'Offerta non trovata' }, { status: 404 });
  }

  const stato = await statoEffettivo(qr);
  return Response.json({
    ok: true,
    attivo: stato === 'active',
    stato,
    attivita: qr.affiliate.businessName,
    trattamento: qr.treatment,
    messaggio: qr.message || null,
    condizioni: qr.conditions || null,
    centro: CENTRO,
  });
}
