import { prisma } from '@/lib/prisma';
import {
  isAuthorized,
  unauthorized,
  badRequest,
  hasConflict,
  findClientByPhone,
  toMinutes,
  toHHMM,
  todayInItaly,
} from '@/lib/voice';

// Crea un nuovo appuntamento in agenda.
// Riconosce il cliente dal telefono; se non esiste lo crea con nome + numero.
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Body JSON mancante');

  const { phone, clientName, treatmentId, operatorId, date, startTime } = body;

  if (!phone) return badRequest('Campo "phone" obbligatorio');
  if (!treatmentId) return badRequest('Campo "treatmentId" obbligatorio');
  if (!operatorId) return badRequest('Campo "operatorId" obbligatorio');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('Campo "date" obbligatorio in formato YYYY-MM-DD');
  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) return badRequest('Campo "startTime" obbligatorio in formato HH:MM');
  if (date < todayInItaly()) return badRequest('La data richiesta è nel passato');

  const treatment = await prisma.treatment.findUnique({ where: { id: treatmentId } });
  if (!treatment) {
    return Response.json({ success: false, message: 'Trattamento non trovato' }, { status: 404 });
  }

  const operator = await prisma.operator.findUnique({ where: { id: operatorId } });
  if (!operator || !operator.isActive) {
    return Response.json({ success: false, message: 'Operatrice non trovata o non attiva' }, { status: 404 });
  }

  const conflict = await hasConflict(date, operatorId, startTime, treatment.duration);
  if (conflict) {
    return Response.json(
      { success: false, message: 'Orario non disponibile: fuori orario di apertura o già occupato' },
      { status: 409 }
    );
  }

  // Trova o crea il cliente dal numero di telefono
  let client = await findClientByPhone(phone);
  if (!client) {
    const name = (clientName || '').trim();
    const firstName = name.split(' ')[0] || 'Cliente';
    const lastName = name.split(' ').slice(1).join(' ') || '';
    client = await prisma.client.create({
      data: {
        firstName,
        lastName,
        phone,
        createdAt: new Date().toISOString(),
      },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
  }

  const endTime = toHHMM(toMinutes(startTime) + treatment.duration);
  const operatorName = `${operator.firstName} ${operator.lastName}`.trim();
  const clientFullName = `${client.firstName} ${client.lastName}`.trim();

  const appointment = await prisma.appointment.create({
    data: {
      clientId: client.id,
      clientName: clientFullName,
      operatorId: operator.id,
      operatorName,
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      treatmentCategory: treatment.category,
      date,
      startTime,
      endTime,
      duration: treatment.duration,
      status: 'confirmed',
      price: treatment.price,
      color: treatment.color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'voice-assistant',
    },
  });

  return Response.json({
    success: true,
    message: 'Appuntamento creato con successo',
    appointment: {
      id: appointment.id,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      treatmentName: appointment.treatmentName,
      operatorName: appointment.operatorName,
      clientName: appointment.clientName,
      price: appointment.price,
    },
  });
}
