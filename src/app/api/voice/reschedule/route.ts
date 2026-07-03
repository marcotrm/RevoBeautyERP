import { prisma } from '@/lib/prisma';
import { isAuthorized, unauthorized, badRequest, hasConflict, toMinutes, toHHMM, todayInItaly } from '@/lib/voice';

// Sposta un appuntamento esistente a una nuova data/ora
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.appointmentId) return badRequest('Campo "appointmentId" obbligatorio');
  if (!body?.newDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.newDate)) {
    return badRequest('Campo "newDate" obbligatorio in formato YYYY-MM-DD');
  }
  if (!body?.newTime || !/^\d{2}:\d{2}$/.test(body.newTime)) {
    return badRequest('Campo "newTime" obbligatorio in formato HH:MM');
  }
  if (body.newDate < todayInItaly()) {
    return badRequest('La nuova data è nel passato');
  }

  const appointment = await prisma.appointment.findUnique({ where: { id: body.appointmentId } });
  if (!appointment) {
    return Response.json({ success: false, message: 'Appuntamento non trovato' }, { status: 404 });
  }
  if (appointment.status === 'cancelled') {
    return Response.json({ success: false, message: 'Questo appuntamento è stato cancellato' }, { status: 409 });
  }
  if (appointment.isLocked) {
    return Response.json(
      { success: false, message: 'Questo appuntamento è bloccato e non può essere spostato al telefono' },
      { status: 409 }
    );
  }

  const conflict = await hasConflict(
    body.newDate,
    appointment.operatorId,
    body.newTime,
    appointment.duration,
    appointment.id
  );
  if (conflict) {
    return Response.json(
      { success: false, message: 'Orario non disponibile: fuori orario di apertura o già occupato' },
      { status: 409 }
    );
  }

  const newEndTime = toHHMM(toMinutes(body.newTime) + appointment.duration);
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      date: body.newDate,
      startTime: body.newTime,
      endTime: newEndTime,
      updatedAt: new Date().toISOString(),
    },
  });

  return Response.json({
    success: true,
    message: 'Appuntamento spostato con successo',
    appointment: {
      id: updated.id,
      date: updated.date,
      startTime: updated.startTime,
      endTime: updated.endTime,
      treatmentName: updated.treatmentName,
      operatorName: updated.operatorName,
    },
  });
}
