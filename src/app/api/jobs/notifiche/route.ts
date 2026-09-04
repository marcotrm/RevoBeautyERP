/**
 * Trigger manuale del giro notifiche (promemoria + lista d'attesa).
 *
 * Il giro vero lo fa lo scheduler in instrumentation.ts ogni cinque minuti;
 * questa porta serve per i test e per rilanciarlo a mano. Protetta dallo
 * stesso segreto delle API vocali: un giro lanciato da uno sconosciuto non
 * manderebbe doppioni (la deduplica sta nel DB), ma non è comunque roba sua.
 */

import { promemoriaAppuntamenti, abbinaListaAttesa } from '@/lib/engines/notificheApp';

export async function POST(request: Request) {
  const secret = process.env.JOBS_SECRET || process.env.VOICE_API_SECRET;
  const header = request.headers.get('authorization') || '';
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const promemoria = await promemoriaAppuntamenti();
  const lista = await abbinaListaAttesa();
  return Response.json({ ok: true, promemoria, listaAttesa: lista });
}
