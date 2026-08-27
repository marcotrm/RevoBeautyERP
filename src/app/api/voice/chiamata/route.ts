import { isAuthorized, unauthorized, badRequest } from '@/lib/voice';
import { salvaChiamata, type BattutaChiamata, type Chiamata, type EsitoChiamata } from '@/lib/voceChiamate';

export const runtime = 'nodejs';

const ESITI: EsitoChiamata[] = ['info', 'prenotato', 'spostato', 'disdetto', 'trasferito', 'nessuno'];

/**
 * Il servizio vocale deposita qui la telefonata appena finita.
 *
 * Si chiama a chiamata CHIUSA, una volta sola: il registro serve a rileggere
 * cosa è successo, non a seguire la conversazione mentre avviene. Se il
 * servizio riprova, lo stesso `callId` sovrascrive invece di sdoppiare.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const b = await request.json().catch(() => null);
  if (!b) return badRequest('Dati mancanti');
  if (!b.callId) return badRequest('Campo "callId" obbligatorio');
  if (!b.phone) return badRequest('Campo "phone" obbligatorio');

  const trascrizione: BattutaChiamata[] = Array.isArray(b.trascrizione)
    ? b.trascrizione
        .filter((r: unknown) => r && typeof r === 'object')
        .map((r: { chi?: unknown; testo?: unknown }) => ({
          chi: r.chi === 'cliente' ? 'cliente' as const : 'assistente' as const,
          testo: String(r.testo || ''),
        }))
        .filter((r: BattutaChiamata) => r.testo)
    : [];

  const chiamata: Chiamata = {
    callId: String(b.callId),
    phone: String(b.phone),
    clientId: b.clientId ? String(b.clientId) : null,
    clientName: b.clientName ? String(b.clientName) : null,
    iniziata: typeof b.iniziata === 'string' ? b.iniziata : new Date().toISOString(),
    durata: Math.max(0, Math.round(Number(b.durata) || 0)),
    esito: ESITI.includes(b.esito) ? b.esito : 'nessuno',
    appointmentId: b.appointmentId ? String(b.appointmentId) : null,
    trascrizione,
    note: b.note ? String(b.note) : undefined,
  };

  await salvaChiamata(chiamata);
  return Response.json({ ok: true });
}
