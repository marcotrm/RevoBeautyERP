/**
 * I regali coi punti, lato gestionale: si sceglie dal magazzino cosa
 * mettere in vetrina e quanti punti costa. La foto del prodotto si
 * carica da qui e finisce sulla scheda dell'inventario (products.image).
 *
 * GET  → prodotti attivi dell'inventario (con l'eventuale regola premio)
 * POST → { productId, punti?, attivo?, image? } crea/aggiorna la regola
 *        e/o la foto. punti assente o 0 = il prodotto esce dalla vetrina.
 */

import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  const [prodotti, regole] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        ...(q ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
        ] } : {}),
      },
      orderBy: { name: 'asc' },
      take: 60,
      select: { id: true, name: true, brand: true, category: true, stock: true, price: true, image: true },
    }),
    prisma.premioProdotto.findMany(),
  ]);
  const regolaDi = new Map(regole.map((r) => [r.productId, r]));
  return Response.json({
    prodotti: prodotti.map((p) => ({
      ...p,
      premio: regolaDi.get(p.id) ? { punti: regolaDi.get(p.id)!.punti, attivo: regolaDi.get(p.id)!.attivo } : null,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const productId = String(body?.productId || '');
  const prodotto = await prisma.product.findUnique({ where: { id: productId } });
  if (!prodotto) return Response.json({ error: 'Prodotto non trovato' }, { status: 404 });

  // La foto, se arriva: compressa dalla pagina, come in bacheca
  if (typeof body?.image === 'string') {
    if (body.image === '') {
      await prisma.product.update({ where: { id: productId }, data: { image: null } });
    } else if (body.image.startsWith('data:image/') && body.image.length <= 400_000) {
      await prisma.product.update({ where: { id: productId }, data: { image: body.image } });
    } else {
      return Response.json({ error: 'Foto non valida o troppo pesante' }, { status: 400 });
    }
  }

  // La regola premio, se arriva
  if (body?.punti !== undefined || body?.attivo !== undefined) {
    const punti = Math.max(0, Math.round(Number(body?.punti) || 0));
    if (punti === 0) {
      await prisma.premioProdotto.deleteMany({ where: { productId } });
    } else {
      await prisma.premioProdotto.upsert({
        where: { productId },
        update: { punti, attivo: body?.attivo !== false },
        create: { productId, punti, attivo: body?.attivo !== false, createdAt: new Date().toISOString() },
      });
    }
  }

  return Response.json({ ok: true });
}
