import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Azioni massive su più trattamenti: elimina (soft) o cambia categoria.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  if (ids.length === 0) {
    return Response.json({ error: 'Nessun trattamento selezionato' }, { status: 400 });
  }

  if (body.action === 'delete') {
    // Soft-delete: preserva gli appuntamenti collegati (FK)
    await prisma.treatment.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
  } else if (body.action === 'category') {
    if (!body.category) return Response.json({ error: 'Categoria mancante' }, { status: 400 });
    await prisma.treatment.updateMany({ where: { id: { in: ids } }, data: { category: String(body.category) } });
  } else {
    return Response.json({ error: 'Azione non valida' }, { status: 400 });
  }

  const treatments = await prisma.treatment.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return Response.json({ success: true, treatments });
}
