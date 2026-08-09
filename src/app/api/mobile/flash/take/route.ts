/** Presa di un Flash Slot: chi arriva prima se lo prende. */
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { prendiSlot } from '@/lib/flashSlot';
import { traccia } from '@/lib/appEvents';

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const slotId = String(body?.slotId || '');
  if (!slotId) return Response.json({ error: 'Occasione non indicata.', code: 'VALIDATION' }, { status: 400 });

  await traccia({ clientId: cliente.id, type: 'click', surface: 'flash_slot', itemId: slotId });

  const esito = await prendiSlot(slotId, cliente.id);
  if (!esito.ok) {
    const status = esito.code === 'NOT_FOUND' ? 404 : 409;
    return Response.json({ error: esito.error, code: esito.code }, { status });
  }

  await traccia({
    clientId: cliente.id, type: 'booking', surface: 'flash_slot',
    itemId: slotId, value: esito.slot.price,
  });

  return Response.json({ ok: true, appointmentId: esito.appointmentId, slot: esito.slot });
}
