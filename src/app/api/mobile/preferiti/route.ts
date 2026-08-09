/** Centro, operatrice e trattamenti preferiti: alimentano le proposte. */
import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  const righe = await prisma.clientFavorite.findMany({ where: { clientId: cliente.id } });
  return Response.json({ preferiti: righe.map(r => ({ kind: r.kind, refId: r.refId, label: r.label })) });
}

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const kind = String(body?.kind || '');
  const refId = String(body?.refId || '');
  const label = String(body?.label || '');
  if (!['operator', 'treatment', 'location'].includes(kind) || !refId) {
    return Response.json({ error: 'Preferito non valido.', code: 'VALIDATION' }, { status: 400 });
  }

  // Toccare un preferito già impostato lo toglie: è il comportamento che si
  // aspetta chi preme una seconda volta su un cuore già pieno.
  const esistente = await prisma.clientFavorite.findUnique({
    where: { clientId_kind_refId: { clientId: cliente.id, kind, refId } },
  });
  if (esistente) {
    await prisma.clientFavorite.delete({ where: { id: esistente.id } });
    return Response.json({ ok: true, attivo: false });
  }

  await prisma.clientFavorite.create({
    data: { clientId: cliente.id, kind, refId, label, createdAt: new Date().toISOString() },
  });
  return Response.json({ ok: true, attivo: true });
}
