import { prisma } from '@/lib/prisma';
import { isAuthorized, unauthorized } from '@/lib/voice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Il listino per l'assistente al telefono.
 *
 * I prezzi e le durate arrivano separati per donna e per uomo: sono due
 * numeri diversi su quasi tutto il listino, e finché qui ne passava uno solo
 * l'assistente rispondeva la cifra sbagliata a metà di chi chiama.
 * `prezzo`/`durata` restano come valore di riserva quando il trattamento non
 * distingue.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const b = await request.json().catch(() => null);
  const categoria = typeof b?.categoria === 'string' ? b.categoria.trim() : '';
  const cerca = typeof b?.cerca === 'string' ? b.cerca.trim() : '';

  const treatments = await prisma.treatment.findMany({
    where: {
      isActive: true,
      ...(categoria ? { category: categoria } : {}),
      // Ricerca per nome: la cliente dice "il baffetto", non l'identificativo
      ...(cerca ? { name: { contains: cerca, mode: 'insensitive' as const } } : {}),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, category: true,
      duration: true, price: true,
      durationMale: true, durationFemale: true,
      priceMale: true, priceFemale: true,
    },
  });

  return Response.json({
    treatments: treatments.map(t => ({
      id: t.id,
      nome: t.name,
      categoria: t.category,
      donna: {
        prezzo: t.priceFemale ?? t.price,
        durata: t.durationFemale ?? t.duration,
      },
      uomo: {
        prezzo: t.priceMale ?? t.priceFemale ?? t.price,
        durata: t.durationMale ?? t.durationFemale ?? t.duration,
      },
    })),
  });
}
