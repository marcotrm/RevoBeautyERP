/**
 * Il QR per collegare il tablet della firma.
 *
 * Si inquadra una volta e il tablet resta collegato: e' l'unico modo che non
 * richieda di digitare un indirizzo lungo su una tastiera a schermo.
 */

import QRCode from 'qrcode';
import { publicOrigin } from '@/lib/affiliazione';
import { chiaveTablet } from '@/app/actions/tablet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chiesta = url.searchParams.get('k');
  const vera = await chiaveTablet();
  // Il QR si fa solo per la chiave vera: altrimenti basterebbe inventarne una
  // per farsi disegnare un codice che poi non apre niente.
  if (!vera || chiesta !== vera) {
    return new Response('Codice non valido', { status: 404 });
  }

  const png = await QRCode.toBuffer(`${publicOrigin(request.url)}/tablet/${vera}`, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 640,
    color: { dark: '#5b2a67', light: '#ffffff' },
  });
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}
