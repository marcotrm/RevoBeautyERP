import { prisma } from '@/lib/prisma';
import { isAuthorized, unauthorized, badRequest, troppoTardi, PREAVVISO_ORE } from '@/lib/voice';

// Cancella un appuntamento (soft delete: imposta lo stato a "cancelled")
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.appointmentId) return badRequest('Campo "appointmentId" obbligatorio');

  const appointment = await prisma.appointment.findUnique({ where: { id: body.appointmentId } });
  if (!appointment) {
    return Response.json({ success: false, message: 'Appuntamento non trovato' }, { status: 404 });
  }
  if (appointment.status === 'cancelled') {
    return Response.json({ success: false, message: 'Questo appuntamento è già cancellato' }, { status: 409 });
  }
  if (appointment.isLocked) {
    return Response.json(
      { success: false, message: 'Questo appuntamento è bloccato e non può essere cancellato al telefono' },
      { status: 409 }
    );
  }

  /*
    Sotto le ventiquattr'ore la disdetta non la prende l'assistente.

    Non e' una regola burocratica: quel posto non si rivende piu', e' tempo di
    cabina gia' perso. Se la cliente ha un motivo serio deve poterlo dire a una
    persona, che decide. Quindi qui non si dice di no e basta: si passa la
    telefonata.
  */
  if (troppoTardi(appointment.date, appointment.startTime)) {
    return Response.json({
      success: false,
      code: 'TOO_LATE',
      message: `Manca meno di ${PREAVVISO_ORE} ore: la disdetta non la puoi fare tu. `
        + `Dille che la passi subito a una collega, e passa la chiamata.`,
    }, { status: 409 });
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: 'cancelled', updatedAt: new Date().toISOString() },
  });

  return Response.json({
    success: true,
    message: `Appuntamento del ${appointment.date} alle ${appointment.startTime} (${appointment.treatmentName}) cancellato`,
  });
}
