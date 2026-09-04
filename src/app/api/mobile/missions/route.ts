/**
 * Le missioni della cliente: avanzamento calcolato dai dati veri,
 * riscatto col lucchetto anti-doppione (vedi engines/missioni).
 *
 * GET  → elenco con stato
 * POST → { codice } riscatta il premio
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { missioniDellaCliente, riscattaMissione } from '@/lib/engines/missioni';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const [missioni, badge] = await Promise.all([
    missioniDellaCliente(cliente.id),
    prisma.clientBadge.findMany({
      where: { clientId: cliente.id },
      orderBy: { assegnatoAt: 'desc' },
      select: { codice: true, nome: true, assegnatoAt: true },
    }),
  ]);
  return Response.json({ missioni, badge });
}

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const esito = await riscattaMissione(cliente.id, String(body?.codice || ''));
  if (!esito.ok) {
    return Response.json({ error: esito.errore, code: esito.code }, { status: 409 });
  }
  return Response.json({ ok: true, punti: esito.punti });
}
