/**
 * I regali riscattati, da consegnare al banco.
 * GET  → da ritirare + le ultime consegne, con la giacenza di quello che
 *        deve uscire dallo scaffale.
 * POST → { id, azione: 'consegna' | 'annulla' }. La consegna scala lo
 *        stock; l'annullo restituisce i punti alla cliente.
 */

import { prisma } from '@/lib/prisma';
import { muoviPunti } from '@/lib/wallet';

/**
 * Quanto ce n'e' ancora a scaffale, accanto a ogni regalo.
 *
 * Lo scarico avviene alla consegna ed e' sempre avvenuto, ma in silenzio: chi
 * premeva il tasto non aveva modo di sapere se il magazzino si era mosso, e
 * una cosa che non si vede si finisce per rifarla a mano — due volte.
 */
async function conGiacenza<T extends { productId: string; tipo: string }>(righe: T[]) {
  const ids = righe.filter(r => r.tipo !== 'trattamento').map(r => r.productId);
  if (ids.length === 0) return righe.map(r => ({ ...r, giacenza: null as number | null }));
  const prodotti = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, stock: true },
  });
  const stockDi = new Map(prodotti.map(p => [p.id, p.stock]));
  return righe.map(r => ({ ...r, giacenza: r.tipo === 'trattamento' ? null : stockDi.get(r.productId) ?? null }));
}

export async function GET() {
  const riscatti = await prisma.riscattoPremio.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  const [daRitirare, storico] = await Promise.all([
    conGiacenza(riscatti.filter((r) => r.stato === 'da_ritirare')),
    conGiacenza(riscatti.filter((r) => r.stato !== 'da_ritirare').slice(0, 20)),
  ]);
  return Response.json({ daRitirare, storico });
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
    let giacenza: number | null = null;
    let nomeProdotto: string | null = null;
    if (riscatto.tipo !== 'trattamento') {
      const prodotto = await prisma.product.findUnique({
        where: { id: riscatto.productId },
        select: { name: true, stock: true },
      });
      if (prodotto) {
        nomeProdotto = prodotto.name;
        /*
          Sotto zero non si scende.

          Una giacenza negativa non descrive niente di reale — il pezzo lo si
          e' dato lo stesso — ma sballa il valore del magazzino e il «sotto
          scorta» per sempre, e nessuno va piu' a cercare da dove arriva.
          Meglio fermarsi a zero: il conto tornera' al primo inventario.
        */
        giacenza = Math.max(0, prodotto.stock - 1);
        await prisma.product.update({
          where: { id: riscatto.productId },
          data: { stock: giacenza },
        }).catch(() => { giacenza = prodotto.stock; });
      }
    }
    return Response.json({ ok: true, giacenza, nomeProdotto });
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
    return Response.json({ ok: true, puntiRestituiti: riscatto.punti });
  }

  return Response.json({ error: 'Azione sconosciuta' }, { status: 400 });
}
