/**
 * Il QR della prenotazione online.
 *
 * Va sul biglietto da visita, sullo specchio della cabina, sulla vetrina: chi
 * lo inquadra si prenota da solo alle undici di sera, quando il centro e'
 * chiuso e nessuno risponderebbe al telefono. E' il modo piu' economico che
 * esiste di aggiungere una linea telefonica che non dorme mai.
 *
 * /api/prenota/qr           → PNG
 * /api/prenota/qr?f=svg     → SVG, per stamparlo grande
 * /api/prenota/qr?to=link   → il QR della pagina "link in bio"
 */

import QRCode from 'qrcode';
import { publicOrigin } from '@/lib/affiliazione';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const svg = url.searchParams.get('f') === 'svg';
  const dove = url.searchParams.get('to') === 'link' ? '/link' : '/prenota';
  const target = `${publicOrigin(request.url)}${dove}`;

  const opzioni = {
    errorCorrectionLevel: 'M' as const,
    margin: 2,
    color: { dark: '#5b2a67', light: '#ffffff' },
  };

  if (svg) {
    const disegno = await QRCode.toString(target, { ...opzioni, type: 'svg', width: 1024 });
    return new Response(disegno, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  const png = await QRCode.toBuffer(target, { ...opzioni, width: 720 });
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  });
}
