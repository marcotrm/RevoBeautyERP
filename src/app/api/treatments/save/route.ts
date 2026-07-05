import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Crea o aggiorna un singolo trattamento (con prezzi/tempi uomo e donna).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.name || !String(body.name).trim()) {
    return Response.json({ error: 'Nome obbligatorio' }, { status: 400 });
  }

  const priceFemale = body.priceFemale != null && body.priceFemale !== '' ? Number(body.priceFemale) : null;
  const priceMale = body.priceMale != null && body.priceMale !== '' ? Number(body.priceMale) : null;
  const durationFemale = body.durationFemale != null && body.durationFemale !== '' ? Math.round(Number(body.durationFemale)) : null;
  const durationMale = body.durationMale != null && body.durationMale !== '' ? Math.round(Number(body.durationMale)) : null;

  const data = {
    name: String(body.name).trim(),
    category: body.category || 'body',
    priceFemale,
    priceMale,
    durationFemale,
    durationMale,
    // valori di default usati dal resto dell'app (preferisci donna, poi uomo)
    price: priceFemale ?? priceMale ?? 0,
    duration: durationFemale ?? durationMale ?? 30,
    color: body.color || '#A855F7',
    isActive: true,
  };

  const existing = body.id ? await prisma.treatment.findUnique({ where: { id: String(body.id) } }) : null;
  const saved = existing
    ? await prisma.treatment.update({ where: { id: existing.id }, data })
    : await prisma.treatment.create({ data: { ...data, requiresRoom: false } });

  const treatments = await prisma.treatment.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return Response.json({ success: true, saved, treatments });
}
