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
  const suggerimenti = await suggerimentiAutopilot(cliente.id, { conSlots: true });
  return Response.json({ suggerimenti });
}
