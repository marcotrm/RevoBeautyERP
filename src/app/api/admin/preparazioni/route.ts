/**
 * Le istruzioni pre-appuntamento, per trattamento: come prepararsi, cosa
 * evitare, cosa portare, con quanto anticipo avvisare. Vive sul trattamento
 * stesso, così ogni appuntamento (anche futuro) le eredita da solo.
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { leggiPreTrattamento } from '@/lib/estetica';

export async function GET() {
  const trattamenti = await prisma.treatment.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, category: true, preTrattamento: true },
  });
  return Response.json({
    trattamenti: trattamenti.map((t) => ({
      id: t.id, nome: t.name, categoria: t.category,
      preparazione: leggiPreTrattamento(t.preTrattamento),
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: 'Richiesta vuota.' }, { status: 400 });

  const id = String(body.id ?? '');
  const trattamento = await prisma.treatment.findUnique({ where: { id }, select: { id: true } });
  if (!trattamento) return Response.json({ error: 'Trattamento non trovato.' }, { status: 404 });

  // Passare campi tutti vuoti equivale a togliere la preparazione.
  const dati = leggiPreTrattamento(body.preparazione);
  await prisma.treatment.update({
    where: { id },
    data: { preTrattamento: dati ? (dati as unknown as Prisma.InputJsonValue) : Prisma.DbNull },
  });

  return Response.json({ ok: true, preparazione: dati });
}
