/**
 * Immagine del QR code di un affiliato, pronta da stampare o condividere.
 *
 * /api/affiliazione/qr/abc123          → PNG 1024px
 * /api/affiliazione/qr/abc123?f=svg    → SVG vettoriale (per tipografia)
 * /api/affiliazione/qr/abc123?dl=1     → scarica come file invece di mostrarlo
 *
 * Il QR punta alla landing /q/[slug]: sostituendo il QR cambia lo slug, così
 * il vecchio smette di funzionare ma il suo storico resta.
 */

import QRCode from 'qrcode';
import prisma from '@/lib/prisma';
import { landingUrl } from '@/lib/affiliazione';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const url = new URL(request.url);
  const formato = url.searchParams.get('f') === 'svg' ? 'svg' : 'png';
  const scarica = url.searchParams.get('dl') === '1';

  const qr = await prisma.affiliateQr.findUnique({
    where: { slug },
    include: { affiliate: { select: { code: true } } },
  });
  if (!qr) return Response.json({ error: 'QR non trovato' }, { status: 404 });

  const target = landingUrl(slug, request.url);
  const nomeFile = `qr-${qr.affiliate.code.toLowerCase()}-${slug}.${formato}`;
  const opzioni = {
    errorCorrectionLevel: 'M' as const, // regge anche stampato piccolo o un po' rovinato
    margin: 2,
    color: { dark: '#1f1230', light: '#ffffff' },
  };

  if (formato === 'svg') {
    const svg = await QRCode.toString(target, { ...opzioni, type: 'svg' });
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'private, max-age=3600',
        ...(scarica ? { 'Content-Disposition': `attachment; filename="${nomeFile}"` } : {}),
      },
    });
  }

  const png = await QRCode.toBuffer(target, { ...opzioni, type: 'png', width: 1024 });
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=3600',
      ...(scarica ? { 'Content-Disposition': `attachment; filename="${nomeFile}"` } : {}),
    },
  });
}
