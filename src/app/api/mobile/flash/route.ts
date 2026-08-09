/** I posti liberati visibili adesso a questa cliente. */
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { slotVisibili, ripulisciScaduti } from '@/lib/flashSlot';
import { leggiConfig } from '@/lib/appSettings';
import { tracciaMolti } from '@/lib/appEvents';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });

  const config = await leggiConfig();
  if (!config.funzioni.flashSlot) return Response.json({ slots: [] });

  // Si ripulisce leggendo: senza un lavoro pianificato, la vetrina resterebbe
  // piena di occasioni scadute finché non passa qualcuno dal gestionale.
  await ripulisciScaduti();
  const slots = await slotVisibili(cliente.id);

  await tracciaMolti(slots.map(s => ({
    clientId: cliente.id, type: 'view' as const, surface: 'flash_slot' as const, itemId: s.id,
  })));

  return Response.json({ slots });
}
