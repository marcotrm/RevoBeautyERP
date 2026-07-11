import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Turni pubblici (sola lettura) per la pagina che le operatrici aprono dal telefono.
export async function GET() {
  const operators = await prisma.operator.findMany({
    where: { isActive: true },
    orderBy: { firstName: 'asc' },
    select: { id: true, firstName: true, lastName: true, color: true, schedule: true },
  });
  return Response.json({ operators });
}
