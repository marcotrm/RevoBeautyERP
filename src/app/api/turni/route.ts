import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Turni pubblici (sola lettura) per la pagina che le operatrici aprono dal
 * telefono. Accetta ?week=YYYY-MM-DD (il lunedì della settimana voluta): se
 * per quella settimana esistono turni personalizzati (Staff → Turni), vincono
 * quelli; altrimenti valgono gli orari base dell'operatrice.
 */
export async function GET(request: Request) {
  const week = new URL(request.url).searchParams.get('week');

  const [operators, weekRows] = await Promise.all([
    prisma.operator.findMany({
      where: { isActive: true, isResource: false },
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true, color: true, schedule: true },
    }),
    week
      ? prisma.operatorWeekSchedule.findMany({ where: { weekStart: week } })
      : Promise.resolve([] as { operatorId: string; schedule: unknown }[]),
  ]);

  const merged = operators.map(o => {
    const settimana = weekRows.find(w => w.operatorId === o.id);
    return { ...o, schedule: (settimana?.schedule ?? o.schedule) };
  });

  return Response.json({ operators: merged });
}
