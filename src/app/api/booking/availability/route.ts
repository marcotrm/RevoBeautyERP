import { prisma } from '@/lib/prisma';
import { getFreeSlots, todayInItaly } from '@/lib/voice';

export const runtime = 'nodejs';

// Verifica se un'operatrice lavora in una data (turno settimanale; 1=Lun..6=Sab, Dom chiuso)
function worksOn(schedule: unknown, date: string): boolean {
  const dow = new Date(date + 'T12:00:00').getDay(); // 0=Dom..6=Sab
  if (dow === 0) return false;
  if (!schedule || typeof schedule !== 'object') return true;
  const day = (schedule as Record<string, { isWorking?: boolean }>)[String(dow)];
  if (!day) return true;
  return day.isWorking !== false;
}

// Orari liberi aggregati su tutte le operatrici, per la prenotazione online.
// Ogni slot riporta un'operatrice libera a cui assegnarlo.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const treatmentId = url.searchParams.get('treatmentId');
  const gender = url.searchParams.get('gender') === 'male' ? 'male' : 'female';

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Data non valida' }, { status: 400 });
  }
  if (date < todayInItaly()) {
    return Response.json({ slots: [] });
  }

  const treatment = treatmentId ? await prisma.treatment.findUnique({ where: { id: treatmentId } }) : null;
  const duration = treatment
    ? (gender === 'male'
        ? (treatment.durationMale ?? treatment.durationFemale ?? treatment.duration)
        : (treatment.durationFemale ?? treatment.duration))
    : 60;

  const operators = await prisma.operator.findMany({ where: { isActive: true } });

  // slot -> prima operatrice libera
  const slotToOperator = new Map<string, { operatorId: string; operatorName: string }>();
  for (const op of operators) {
    if (!worksOn(op.schedule, date)) continue;
    const free = await getFreeSlots(date, op.id, duration);
    for (const s of free) {
      if (!slotToOperator.has(s)) {
        slotToOperator.set(s, { operatorId: op.id, operatorName: `${op.firstName} ${op.lastName}`.trim() });
      }
    }
  }

  const slots = [...slotToOperator.entries()]
    .map(([time, op]) => ({ time, ...op }))
    .sort((a, b) => (a.time < b.time ? -1 : 1));

  return Response.json({ date, durationMinutes: duration, slots });
}
