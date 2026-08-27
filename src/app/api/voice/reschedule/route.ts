import { isAuthorized, unauthorized, badRequest } from '@/lib/voice';
import { spostaAppuntamento } from '@/lib/agendaAgente';

export const runtime = 'nodejs';

/**
 * Sposta un appuntamento a una nuova data e ora.
 *
 * Il controllo del posto nuovo lo fa `lib/agendaAgente`, che su un giorno
 * diverso passa dal motore vero degli orari: prima qui si guardava solo
 * "siamo aperti dalle nove alle sette", e il telefono spostava appuntamenti
 * dentro la pausa dell'operatrice o dopo la fine del suo turno.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.appointmentId) return badRequest('Campo "appointmentId" obbligatorio');
  if (!body?.newDate) return badRequest('Campo "newDate" obbligatorio in formato YYYY-MM-DD');
  if (!body?.newTime) return badRequest('Campo "newTime" obbligatorio in formato HH:MM');

  const esito = await spostaAppuntamento({
    appointmentId: String(body.appointmentId),
    newDate: String(body.newDate),
    newTime: String(body.newTime),
  });

  if (!esito.ok) {
    if (esito.codice === 'VALIDAZIONE') return badRequest(esito.messaggio);
    const stato = esito.codice === 'NON_TROVATO' ? 404 : 409;
    const code = esito.codice === 'TROPPO_TARDI' ? 'TOO_LATE' : esito.codice;
    return Response.json({ success: false, code, message: esito.messaggio }, { status: stato });
  }

  return Response.json({
    success: true,
    message: 'Appuntamento spostato con successo',
    appointment: {
      id: String(body.appointmentId),
      date: esito.date,
      startTime: esito.startTime,
      endTime: esito.endTime,
      treatmentName: esito.treatmentName,
      operatorName: esito.operatorName,
    },
  });
}
