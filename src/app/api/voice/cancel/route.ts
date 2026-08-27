import { isAuthorized, unauthorized, badRequest } from '@/lib/voice';
import { disdiciAppuntamento } from '@/lib/agendaAgente';

export const runtime = 'nodejs';

/**
 * Disdetta al telefono (in agenda resta, con lo stato "cancelled").
 *
 * I controlli — esiste, non è già disdetto, non è bloccato, manca abbastanza
 * preavviso — stanno in `lib/agendaAgente`, gli stessi che usa la segretaria
 * su WhatsApp. Sotto le ventiquattr'ore risponde TROPPO_TARDI e la chiamata va
 * passata a una persona.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.appointmentId) return badRequest('Campo "appointmentId" obbligatorio');

  const esito = await disdiciAppuntamento(String(body.appointmentId));
  if (!esito.ok) {
    const stato = esito.codice === 'NON_TROVATO' ? 404 : 409;
    // `TOO_LATE` resta il codice che il bot conosce da sempre: cambiarlo
    // significherebbe rilasciare l'orchestratore insieme al gestionale.
    const code = esito.codice === 'TROPPO_TARDI' ? 'TOO_LATE' : esito.codice;
    return Response.json({ success: false, code, message: esito.messaggio }, { status: stato });
  }

  return Response.json({
    success: true,
    message: `Appuntamento del ${esito.date} alle ${esito.startTime} (${esito.treatmentName}) cancellato`,
  });
}
