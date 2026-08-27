import { isAuthorized, unauthorized, badRequest, todayInItaly } from '@/lib/voice';
import { cercaSlot, type ServizioRichiesto } from '@/lib/bookingEngine';
import { dataParlata, oraParlata } from '@/lib/parlato';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Gli orari liberi, per l'assistente al telefono.
 *
 * Usa lo STESSO motore dell'app clienti e della pagina /prenota
 * (`cercaSlot` in lib/bookingEngine), quindi rispetta il turno vero
 * dell'operatrice, la pausa, la settimana personalizzata di Staff → Turni, le
 * fasce bloccate in agenda e chi quel lavoro lo sa fare davvero.
 *
 * Prima qui c'era un calcolo tutto suo — 09:00-19:00 fisse, passo mezz'ora,
 * turni ignorati — e proponeva al telefono orari che poi l'agenda rifiutava:
 * le 15:00 a chi è in pausa, le 16:00 a chi stacca alle 14. Una voce che
 * promette un posto che non c'è fa più danni che se non rispondesse.
 *
 * La risposta è tagliata per essere LETTA: pochi giorni, pochi orari per
 * giorno. Al telefono un elenco di quaranta orari non è un aiuto, è un muro.
 */

/** Quanti giorni e quanti orari si possono dire a voce senza perdere la cliente. */
const MAX_GIORNI = 4;
const MAX_ORARI_PER_GIORNO = 4;

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const b = await request.json().catch(() => null);
  if (!b) return badRequest('Dati mancanti');

  // Forma nuova (più trattamenti) e forma vecchia a trattamento singolo
  const richiesti: ServizioRichiesto[] = Array.isArray(b.services) && b.services.length > 0
    ? b.services
        .filter((s: unknown) => s && typeof s === 'object')
        .map((s: { treatmentId?: unknown; operatorId?: unknown }) => ({
          treatmentId: String(s.treatmentId || ''),
          operatorId: s.operatorId ? String(s.operatorId) : (b.operatorId ? String(b.operatorId) : null),
        }))
        .filter((s: ServizioRichiesto) => s.treatmentId)
    : (b.treatmentId
        ? [{ treatmentId: String(b.treatmentId), operatorId: b.operatorId ? String(b.operatorId) : null }]
        : []);

  if (richiesti.length === 0) {
    return badRequest('Serve almeno un trattamento: passa "services" oppure "treatmentId"');
  }

  const oggi = todayInItaly();

  // Un giorno solo se la cliente ne ha chiesto uno, altrimenti i primi utili
  let dateFrom = oggi;
  let quantiGiorni = Math.min(Math.max(1, Number(b.giorni) || 7), 30);
  if (typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
    if (b.date < oggi) return badRequest('La data richiesta è nel passato');
    dateFrom = b.date;
    quantiGiorni = 1;
  }

  const { giorni, durataTotale, prezzoTotale } = await cercaSlot({
    dateFrom,
    giorni: quantiGiorni,
    services: richiesti,
    gender: b.gender === 'male' ? 'male' : 'female',
    giorniSettimana: Array.isArray(b.giorniSettimana)
      ? b.giorniSettimana.map((n: unknown) => Number(n)).filter((n: number) => n >= 1 && n <= 6)
      : [],
    oraDa: b.from || null,
    oraA: b.to || null,
    maxPerGiorno: MAX_ORARI_PER_GIORNO,
  });

  if (giorni.length === 0) {
    return Response.json({
      trovato: false,
      durataTotale,
      prezzoTotale,
      giorni: [],
      messaggio: 'Non c\'è posto con questi criteri. Prova ad allargare i giorni o la fascia oraria.',
    });
  }

  return Response.json({
    trovato: true,
    durataTotale,
    prezzoTotale,
    giorni: giorni.slice(0, MAX_GIORNI).map(g => ({
      date: g.date,
      giornoParlato: dataParlata(g.date, oggi),
      orari: g.slots.slice(0, MAX_ORARI_PER_GIORNO).map(s => ({
        // `ora` è quella da rimandare indietro alla prenotazione,
        // `oraParlata` è quella da dire alla cliente.
        ora: s.time,
        oraParlata: oraParlata(s.time),
        con: [...new Set(s.assegnazioni.map(a => a.operatorName.split(' ')[0]))].join(' e '),
      })),
    })),
  });
}
