/**
 * Autopilot: «il tuo prossimo step», con gli orari veri già pronti.
 */

import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { suggerimentiAutopilot } from '@/lib/engines/autopilot';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  // ?slots=1 fa girare anche il motore di prenotazione (più lento):
  // lo chiede la schermata di dettaglio, non la Home.
  const conSlots = new URL(req.url).searchParams.get('slots') === '1';
  const suggerimenti = await suggerimentiAutopilot(cliente.id, { conSlots });
  return Response.json({ suggerimenti });
}
