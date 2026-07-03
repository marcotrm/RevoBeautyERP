import { prisma } from '@/lib/prisma';
import { isAuthorized, unauthorized, badRequest, findClientByPhone, todayInItaly } from '@/lib/voice';

// Cerca un cliente per numero di telefono e restituisce i suoi prossimi appuntamenti
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.phone) return badRequest('Campo "phone" obbligatorio');

  const client = await findClientByPhone(body.phone);
  if (!client) {
    return Response.json({
      found: false,
      message: 'Nessun cliente trovato con questo numero di telefono',
    });
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      clientId: client.id,
      date: { gte: todayInItaly() },
      status: { notIn: ['cancelled', 'no_show', 'completed'] },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      treatmentName: true,
      operatorName: true,
      status: true,
    },
  });

  return Response.json({
    found: true,
    client: { id: client.id, firstName: client.firstName, lastName: client.lastName },
    appointments,
  });
}
