import { isAuthorized, unauthorized } from '@/lib/voice';
import { costruisciIstruzioni, versioneIstruzioni, type Canale } from '@/lib/istruzioniAssistente';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Le istruzioni dell'assistente, servite dal gestionale.
 *
 * Il bot le chiede all'avvio di ogni telefonata invece di portarsele dentro:
 * così cambiare come parla l'assistente — o cambiare gli orari del centro, che
 * finiscono lì dentro — non richiede di rilasciare il bot.
 *
 * `versione` cambia a ogni modifica del testo o dei dati: il bot può tenersele
 * in memoria e ricaricarle solo quando serve, invece di rifare la richiesta a
 * ogni squillo.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const b = await request.json().catch(() => null);
  const canale: Canale = b?.canale === 'whatsapp' ? 'whatsapp' : 'telefono';

  const prompt = await costruisciIstruzioni(canale);
  return Response.json({ canale, versione: versioneIstruzioni(prompt), prompt });
}
