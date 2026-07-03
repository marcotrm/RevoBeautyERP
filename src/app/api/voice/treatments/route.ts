import { prisma } from '@/lib/prisma';
import { isAuthorized, unauthorized } from '@/lib/voice';

// Elenca i trattamenti attivi (id, nome, categoria, durata, prezzo)
// Serve a Federica per sapere quale trattamento prenotare e con quale durata.
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const treatments = await prisma.treatment.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, category: true, duration: true, price: true },
  });

  return Response.json({ treatments });
}
