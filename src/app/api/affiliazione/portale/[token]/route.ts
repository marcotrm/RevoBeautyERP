/**
 * Dati del portale affiliato ("Il mio QR code").
 *
 * L'accesso è il token segreto nell'URL, come per la conferma inaugurazione:
 * niente password da ricordare, il link glielo diamo noi. Espone solo i numeri
 * dell'affiliato stesso, mai i dati personali dei clienti.
 */

import prisma from '@/lib/prisma';
import { statoEffettivo, statsPerQrIds, landingUrl, QR_STATUS_LABELS } from '@/lib/affiliazione';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const affiliato = await prisma.affiliate.findUnique({
    where: { portalToken: token },
    include: { qrs: { orderBy: { createdAt: 'asc' } } },
  });
  if (!affiliato || !affiliato.isActive) {
    return Response.json({ ok: false, error: 'Portale non trovato' }, { status: 404 });
  }

  const qrs = await Promise.all(affiliato.qrs.map(async qr => ({
    slug: qr.slug,
    nome: qr.name,
    canale: qr.channel,
    trattamento: qr.treatment,
    stato: await statoEffettivo(qr),
    url: landingUrl(qr.slug, request.url),
    stats: await statsPerQrIds([qr.id], affiliato.commissionPercent),
  })));

  const totali = await statsPerQrIds(affiliato.qrs.map(q => q.id), affiliato.commissionPercent);

  return Response.json({
    ok: true,
    attivita: affiliato.businessName,
    codice: affiliato.code,
    commissione: affiliato.commissionPercent,
    statiEtichette: QR_STATUS_LABELS,
    qrs,
    totali,
  });
}
