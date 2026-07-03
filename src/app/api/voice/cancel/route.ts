import { prisma } from '@/lib/prisma';
import { isAuthorized, unauthorized, badRequest } from '@/lib/voice';

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

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: 'cancelled', updatedAt: new Date().toISOString() },
  });

  return Response.json({
    success: true,
    message: `Appuntamento del ${appointment.date} alle ${appointment.startTime} (${appointment.treatmentName}) cancellato`,
  });
}
