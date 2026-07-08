import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Elenco pubblico dei trattamenti prenotabili (usato dalla pagina di prenotazione online).
export async function GET() {
  const treatments = await prisma.treatment.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, category: true,
      price: true, duration: true,
      priceMale: true, priceFemale: true, durationMale: true, durationFemale: true,
    },
  });
  return Response.json({ treatments });
}
