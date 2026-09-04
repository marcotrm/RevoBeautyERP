/**
 * I regali riscattati, da consegnare al banco.
 * GET  → da ritirare + le ultime consegne
 * POST → { id, azione: 'consegna' | 'annulla' }. La consegna scala lo
 *        stock; l'annullo restituisce i punti alla cliente.
 */

import { prisma } from '@/lib/prisma';
import { muoviPunti } from '@/lib/wallet';

export async function GET() {
  const riscatti = await prisma.riscattoPremio.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  return Response.json({
    daRitirare: riscatti.filter((r) => r.stato === 'da_ritirare'),
    storico: riscatti.filter((r) => r.stato !== 'da_ritirare').slice(0, 20),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const id = String(body?.id || '');
  const azione = String(body?.azione || '');

  const riscatto = await prisma.riscattoPremio.findUnique({ where: { id } });
  if (!riscatto) return Response.json({ error: 'Riscatto non trovato' }, { status: 404 });
  if (riscatto.stato !== 'da_ritirare') {
    return Response.json({ error: 'Già gestito.' }, { status: 409 });
  }

  if (azione === 'consegna') {
    await prisma.riscattoPremio.update({
      where: { id },
      data: { stato: 'consegnato', consegnatoAt: new Date().toISOString() },
    });
    // Il prodotto esce dallo scaffale adesso, quando cambia di mano.
    // Un trattamento in regalo non ha scaffale: si segna e si prenota.
    if (riscatto.tipo !== 'trattamento') {
      await prisma.product.update({
        where: { id: riscatto.productId },
        data: { stock: { decrement: 1 } },
      }).catch(() => null);
    }
    return Response.json({ ok: true });
  }

  if (azione === 'annulla') {
    await prisma.riscattoPremio.update({ where: { id }, data: { stato: 'annullato' } });
    await muoviPunti({
      clientId: riscatto.clientId,
      punti: riscatto.punti,
      motivo: `Regalo annullato: ${riscatto.nomeProdotto}`,
      sourceType: 'premio-prodotto',
      sourceId: riscatto.id,
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Azione sconosciuta' }, { status: 400 });
}
