import { prisma } from '@/lib/prisma';
import { isAuthorized, unauthorized, badRequest, getFreeSlots, todayInItaly } from '@/lib/voice';

// Restituisce gli orari liberi in una data, per una o tutte le operatrici
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return badRequest('Campo "date" obbligatorio in formato YYYY-MM-DD');
  }
  if (body.date < todayInItaly()) {
    return badRequest('La data richiesta è nel passato');
  }
  const duration = Number(body.duration) || 60;

  const operators = await prisma.operator.findMany({
    where: {
      isActive: true,
      ...(body.operatorId ? { id: body.operatorId } : {}),
    },
    select: { id: true, firstName: true, lastName: true },
  });
  if (operators.length === 0) {
    return Response.json({ date: body.date, operators: [], message: 'Nessuna operatrice trovata' });
  }

  const results = await Promise.all(
    operators.map(async (op) => ({
      operatorId: op.id,
      operatorName: `${op.firstName} ${op.lastName}`.trim(),
      freeSlots: await getFreeSlots(body.date, op.id, duration),
    }))
  );

  return Response.json({ date: body.date, durationMinutes: duration, operators: results });
}
