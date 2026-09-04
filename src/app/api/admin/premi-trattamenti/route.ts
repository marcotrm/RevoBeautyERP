/**
 * I trattamenti in regalo coi punti, lato gestionale: il gemello di
 * premi-prodotti, ma sul listino dei servizi.
 *
 * GET  → trattamenti attivi (con l'eventuale regola premio)
 * POST → { treatmentId, punti?, attivo? } crea/aggiorna la regola.
 *        punti assente o 0 = il trattamento esce dalla vetrina.
 */

import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  const [trattamenti, regole] = await Promise.all([
    prisma.treatment.findMany({
      where: {
        isActive: true,
        ...(q ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ] } : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: 60,
      select: { id: true, name: true, category: true, duration: true, price: true },
    }),
    prisma.premioTrattamento.findMany(),
  ]);
  const regolaDi = new Map(regole.map((r) => [r.treatmentId, r]));
  return Response.json({
    trattamenti: trattamenti.map((t) => ({
      ...t,
      premio: regolaDi.get(t.id) ? { punti: regolaDi.get(t.id)!.punti, attivo: regolaDi.get(t.id)!.attivo } : null,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const treatmentId = String(body?.treatmentId || '');
  const trattamento = await prisma.treatment.findUnique({ where: { id: treatmentId } });
  if (!trattamento) return Response.json({ error: 'Trattamento non trovato' }, { status: 404 });

  const punti = Math.max(0, Math.round(Number(body?.punti) || 0));
  if (punti === 0) {
    await prisma.premioTrattamento.deleteMany({ where: { treatmentId } });
  } else {
    await prisma.premioTrattamento.upsert({
      where: { treatmentId },
      update: { punti, attivo: body?.attivo !== false },
      create: { treatmentId, punti, attivo: body?.attivo !== false, createdAt: new Date().toISOString() },
    });
  }

  return Response.json({ ok: true });
}
