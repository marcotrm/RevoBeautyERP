import { todayInItaly } from '@/lib/voice';
import { cercaSlot, type ServizioRichiesto } from '@/lib/bookingEngine';
import { soloNome } from '@/lib/nomiPropri';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Quando posso venire?" — cerca i primi giorni utili nei prossimi X, tenendo
 * conto dei giorni della settimana e della fascia oraria che la cliente vuole.
 * È quello che riempie il calendario del passo "Orario" senza fare una
 * richiesta per ogni singolo giorno.
 */
export async function POST(request: Request) {
  const b = await request.json().catch(() => null);
  if (!b) return Response.json({ error: 'Dati mancanti' }, { status: 400 });

  const services: ServizioRichiesto[] = Array.isArray(b.services)
    ? b.services
        .filter((s: unknown) => s && typeof s === 'object')
        .map((s: { treatmentId?: unknown; operatorId?: unknown }) => ({
          treatmentId: String(s.treatmentId || ''),
          operatorId: s.operatorId ? String(s.operatorId) : null,
        }))
        .filter((s: ServizioRichiesto) => s.treatmentId)
    : [];
  if (services.length === 0) return Response.json({ error: 'Scegli almeno un trattamento' }, { status: 400 });

  const oggi = todayInItaly();
  const dateFrom = typeof b.dateFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.dateFrom) && b.dateFrom > oggi
    ? b.dateFrom
    : oggi;

  const giorniSettimana = Array.isArray(b.giorniSettimana)
    ? b.giorniSettimana.map((n: unknown) => Number(n)).filter((n: number) => n >= 1 && n <= 6)
    : [];

  const res = await cercaSlot({
    dateFrom,
    giorni: Number(b.giorni) || 21,
    // Per lo spostamento: il posto vecchio dell'appuntamento stesso è libero.
    ignoraAppointmentId: b.ignoraAppointmentId ? String(b.ignoraAppointmentId) : null,
    services,
    gender: b.gender === 'male' ? 'male' : 'female',
    giorniSettimana,
    oraDa: b.from || null,
    oraA: b.to || null,
    maxPerGiorno: Number(b.maxPerGiorno) || 40,
  });

  // Verso chi prenota il cognome delle operatrici non esce: solo "Luisa".
  return Response.json({
    ...res,
    giorni: res.giorni.map((g) => ({
      ...g,
      slots: g.slots.map((s) => ({
        ...s,
        assegnazioni: (s.assegnazioni || []).map((a) => ({ ...a, operatorName: soloNome(a.operatorName) })),
      })),
    })),
  });
}
