/**
 * Il QR del listino: si fa inquadrare al banco.
 *
 * È la risposta migliore a "quanto viene?" quando la cliente è davanti e su
 * WhatsApp non si può scrivere (fuori dalle 24 ore) o non è nemmeno in
 * rubrica: inquadra, apre il listino, se lo tiene sul telefono.
 *
 * /api/listino/qr          → PNG
 * /api/listino/qr?f=svg    → SVG, per stamparlo grande in vetrina
 */

import QRCode from 'qrcode';
import { publicOrigin } from '@/lib/affiliazione';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const svg = url.searchParams.get('f') === 'svg';
  // Il QR può portare a tutto il listino o solo a una parte: ?v=pacchetti
  const vista = url.searchParams.get('v');
  const coda = vista === 'pacchetti' || vista === 'trattamenti' ? `?v=${vista}` : '';
  const target = `${publicOrigin(request.url)}/listino${coda}`;

  const opzioni = {
    errorCorrectionLevel: 'M' as const,
    margin: 2,
    color: { dark: '#5b2a67', light: '#ffffff' },
  };

  if (svg) {
    const testo = await QRCode.toString(target, { ...opzioni, type: 'svg' });
    return new Response(testo, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  const png = await QRCode.toBuffer(target, { ...opzioni, width: 1024 });
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  });
}
