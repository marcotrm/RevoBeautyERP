import { todayInItaly } from '@/lib/voice';
import { slotDisponibili, type ServizioRichiesto } from '@/lib/bookingEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Orari liberi di UN giorno per la prenotazione online.
 *
 * Accetta la forma nuova (più trattamenti, operatrice a scelta, fascia oraria)
 * e quella vecchia a trattamento singolo, che la app clienti usa ancora:
 *   ?date=&treatmentId=&operatorId=&gender=
 *   ?date=&services=[{"treatmentId":"..","operatorId":".."}]&from=14:00&to=19:00
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const gender = url.searchParams.get('gender') === 'male' ? 'male' : 'female';

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Data non valida' }, { status: 400 });
  }
  if (date < todayInItaly()) return Response.json({ date, slots: [] });

  let services: ServizioRichiesto[] = [];
  const grezzo = url.searchParams.get('services');
  if (grezzo) {
    try {
      const parsed = JSON.parse(grezzo);
      if (Array.isArray(parsed)) {
        services = parsed
          .filter((s: unknown) => s && typeof s === 'object')
          .map((s: { treatmentId?: unknown; operatorId?: unknown }) => ({
            treatmentId: String(s.treatmentId || ''),
            operatorId: s.operatorId ? String(s.operatorId) : null,
          }))
          .filter(s => s.treatmentId);
      }
    } catch {
      return Response.json({ error: 'Elenco trattamenti non valido' }, { status: 400 });
    }
  } else {
    const treatmentId = url.searchParams.get('treatmentId');
    const operatorId = url.searchParams.get('operatorId');
    if (treatmentId) services = [{ treatmentId, operatorId: operatorId || null }];
  }

  if (services.length === 0) return Response.json({ date, slots: [] });

  const { slots, durataTotale, prezzoTotale } = await slotDisponibili({
    date,
    services,
    gender,
    oraDa: url.searchParams.get('from'),
    oraA: url.searchParams.get('to'),
  });

  return Response.json({
    date,
    durationMinutes: durataTotale,
    prezzoTotale,
    // `operatorId`/`operatorName` restano quelli del primo trattamento: è ciò
    // che la app clienti legge oggi, e per un trattamento solo è tutto.
    slots: slots.map(s => ({
      time: s.time,
      endTime: s.endTime,
      operatorId: s.assegnazioni[0]?.operatorId || '',
      operatorName: s.assegnazioni[0]?.operatorName || '',
      assegnazioni: s.assegnazioni,
    })),
  });
}
