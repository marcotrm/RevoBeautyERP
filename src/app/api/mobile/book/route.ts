import { prisma } from '@/lib/prisma';
import { getAccountFromRequest, unauthorized } from '@/lib/mobile';
import { hasConflict, toMinutes, toHHMM, todayInItaly } from '@/lib/voice';

export const runtime = 'nodejs';

// Prenotazione dall'app clienti: il cliente è identificato dal token (niente nome/telefono da inserire).
export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);
  if (!account) return unauthorized();
  const client = account.client;

  const b = await request.json().catch(() => null);
  if (!b?.treatmentId) return Response.json({ error: 'Seleziona un trattamento', code: 'VALIDATION' }, { status: 400 });
  if (!b?.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return Response.json({ error: 'Seleziona una data', code: 'VALIDATION' }, { status: 400 });
  if (!b?.startTime || !/^\d{2}:\d{2}$/.test(b.startTime)) return Response.json({ error: 'Seleziona un orario', code: 'VALIDATION' }, { status: 400 });
  if (b.date < todayInItaly()) return Response.json({ error: 'La data è nel passato', code: 'VALIDATION' }, { status: 400 });

  const treatment = await prisma.treatment.findUnique({ where: { id: String(b.treatmentId) } });
  if (!treatment) return Response.json({ error: 'Trattamento non trovato', code: 'NOT_FOUND' }, { status: 404 });

  const gender = (b.gender === 'male' || b.gender === 'female')
    ? b.gender
    : (client.gender === 'M' ? 'male' : 'female');
  const duration = gender === 'male'
    ? (treatment.durationMale ?? treatment.durationFemale ?? treatment.duration)
    : (treatment.durationFemale ?? treatment.duration);
  const price = gender === 'male'
    ? (treatment.priceMale ?? treatment.priceFemale ?? treatment.price)
    : (treatment.priceFemale ?? treatment.price);

  // Assegna un'operatrice libera (quella richiesta se possibile)
  const operators = await prisma.operator.findMany({ where: { isActive: true } });
  const preferredId = b.operatorId ? String(b.operatorId) : null;
  const ordered = preferredId ? [...operators].sort((a) => (a.id === preferredId ? -1 : 1)) : operators;
  let chosen: typeof operators[number] | null = null;
  for (const op of ordered) {
    if (!(await hasConflict(b.date, op.id, b.startTime, duration))) { chosen = op; break; }
  }
  if (!chosen) return Response.json({ error: 'Questo orario non è più disponibile.', code: 'NOT_CANCELLABLE' }, { status: 409 });

  const endTime = toHHMM(toMinutes(b.startTime) + duration);
  const appointment = await prisma.appointment.create({
    data: {
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      operatorId: chosen.id,
      operatorName: `${chosen.firstName} ${chosen.lastName}`.trim(),
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      treatmentCategory: treatment.category,
      date: b.date,
      startTime: b.startTime,
      endTime,
      duration,
      status: 'confirmed',
      price,
      color: treatment.color,
      notes: 'Prenotazione da app',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'mobile-app',
    },
  });

  return Response.json({
    success: true,
    appointment: {
      date: appointment.date, startTime: appointment.startTime, endTime: appointment.endTime,
      treatmentName: appointment.treatmentName, operatorName: appointment.operatorName, price: appointment.price,
    },
  });
}
