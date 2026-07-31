/**
 * Allegati WhatsApp in ingresso (vocali, foto, sticker, video, documenti).
 *
 * Il browser non può scaricarli da solo: l'URL di Meta è temporaneo e richiede
 * la chiave del canale, che non deve uscire dal server. Questa rotta fa da
 * ponte — riceve l'id del media, lo scarica da 360dialog e restituisce il
 * binario, così in chat basta un <audio src="/api/whatsapp/media/...">.
 *
 * Serve solo id già presenti in una conversazione archiviata: altrimenti
 * l'indirizzo diventerebbe un modo per pescare qualunque allegato del canale.
 */

import { fetchD360Media } from '@/lib/whatsapp360';
import { mediaIsKnown } from '@/lib/wa-conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: 'id mancante' }, { status: 400 });

  if (!(await mediaIsKnown(id))) {
    return Response.json({ error: 'Allegato non trovato' }, { status: 404 });
  }

  const res = await fetchD360Media(id);
  if (!res.ok) {
    console.error('[wa-media] download fallito', id, res.error);
    // Meta tiene i media circa 30 giorni: sui più vecchi il 404 è normale.
    return Response.json({ error: res.error }, { status: res.status === 404 ? 404 : 502 });
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': res.mimeType,
      'Content-Length': String(res.body.byteLength),
      // I media sono immutabili: una volta scaricati non serve richiederli a
      // ogni giro di polling della chat.
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
