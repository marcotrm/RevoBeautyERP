/**
 * La vetrina dei regali per l'app: prodotti veri dello scaffale,
 * riscattabili coi punti.
 *
 * GET  → saldo punti, vetrina, i propri riscatti
 * POST → { premioId } riscatta: i punti scendono SUBITO e nasce il codice
 *        da mostrare al banco. Se poi il centro annulla, i punti tornano.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { saldoPunti, muoviPunti } from '@/lib/wallet';

function codiceRegalo(): string {
  // Corto e leggibile ad alta voce al banco: niente 0/O né 1/I
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return c;
}

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const [punti, regole, regoleTratt, riscatti] = await Promise.all([
    saldoPunti(cliente.id),
    prisma.premioProdotto.findMany({ where: { attivo: true }, orderBy: { punti: 'asc' } }),
    prisma.premioTrattamento.findMany({ where: { attivo: true }, orderBy: { punti: 'asc' } }),
    prisma.riscattoPremio.findMany({
      where: { clientId: cliente.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, tipo: true, nomeProdotto: true, punti: true, stato: true, codice: true, createdAt: true },
    }),
  ]);

  const [prodotti, trattamenti] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: regole.map((r) => r.productId) }, isActive: true },
      select: { id: true, name: true, brand: true, stock: true, image: true },
    }),
    prisma.treatment.findMany({
      where: { id: { in: regoleTratt.map((r) => r.treatmentId) }, isActive: true },
      select: { id: true, name: true, category: true, duration: true },
    }),
  ]);
  const prodottoDi = new Map(prodotti.map((p) => [p.id, p]));
  const trattamentoDi = new Map(trattamenti.map((t) => [t.id, t]));

  return Response.json({
    punti,
    premi: regole
      .map((r) => {
        const p = prodottoDi.get(r.productId);
        if (!p) return null;
        return {
          premioId: r.id,
          nome: p.name,
          brand: p.brand,
          image: p.image,
          punti: r.punti,
          disponibile: p.stock > 0,
        };
      })
      .filter(Boolean),
    /** I trattamenti in regalo: la seconda vetrina, coi servizi. */
    trattamenti: regoleTratt
      .map((r) => {
        const t = trattamentoDi.get(r.treatmentId);
        if (!t) return null;
        return {
          premioId: r.id,
          nome: t.name,
          categoria: t.category,
          durata: t.duration,
          punti: r.punti,
          disponibile: true,
        };
      })
      .filter(Boolean),
    riscatti,
  });
}

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const premioId = String(body?.premioId || '');
  const tipo = body?.tipo === 'trattamento' ? 'trattamento' : 'prodotto';

  // Le due vetrine hanno regole diverse solo su UNA cosa: i prodotti hanno
  // uno scaffale che si svuota, i trattamenti no.
  let punti = 0;
  let riferimentoId = '';
  let nomePremio = '';
  if (tipo === 'prodotto') {
    const regola = await prisma.premioProdotto.findUnique({ where: { id: premioId } });
    if (!regola || !regola.attivo) {
      return Response.json({ error: 'Questo regalo non è più disponibile.', code: 'NOT_FOUND' }, { status: 404 });
    }
    const prodotto = await prisma.product.findUnique({ where: { id: regola.productId } });
    if (!prodotto || prodotto.stock <= 0) {
      return Response.json({ error: 'Purtroppo è appena andato esaurito.', code: 'NOT_FOUND' }, { status: 409 });
    }
    punti = regola.punti;
    riferimentoId = prodotto.id;
    nomePremio = `${prodotto.brand ? `${prodotto.brand} ` : ''}${prodotto.name}`.trim();
  } else {
    const regola = await prisma.premioTrattamento.findUnique({ where: { id: premioId } });
    if (!regola || !regola.attivo) {
      return Response.json({ error: 'Questo regalo non è più disponibile.', code: 'NOT_FOUND' }, { status: 404 });
    }
    const trattamento = await prisma.treatment.findUnique({ where: { id: regola.treatmentId } });
    if (!trattamento || !trattamento.isActive) {
      return Response.json({ error: 'Questo regalo non è più disponibile.', code: 'NOT_FOUND' }, { status: 404 });
    }
    punti = regola.punti;
    riferimentoId = trattamento.id;
    nomePremio = trattamento.name;
  }

  const saldo = await saldoPunti(cliente.id);
  if (saldo < punti) {
    return Response.json(
      { error: `Ti servono ${punti} punti: te ne mancano ${punti - saldo}.`, code: 'VALIDATION' },
      { status: 409 }
    );
  }

  // Prima i punti, poi il codice: se qualcosa va storto a metà, il centro
  // vede il movimento e sistema — mai il contrario (regalo gratis).
  const riscatto = await prisma.riscattoPremio.create({
    data: {
      clientId: cliente.id,
      clientName: `${cliente.firstName} ${cliente.lastName}`.trim(),
      tipo,
      productId: riferimentoId,
      nomeProdotto: nomePremio,
      punti,
      codice: codiceRegalo(),
      createdAt: new Date().toISOString(),
    },
  });
  await muoviPunti({
    clientId: cliente.id,
    punti: -punti,
    motivo: `Regalo riscattato: ${riscatto.nomeProdotto}`,
    sourceType: tipo === 'prodotto' ? 'premio-prodotto' : 'premio-trattamento',
    sourceId: riscatto.id,
  });

  return Response.json({
    ok: true,
    riscatto: {
      id: riscatto.id, tipo: riscatto.tipo, nomeProdotto: riscatto.nomeProdotto,
      punti: riscatto.punti, codice: riscatto.codice, stato: riscatto.stato,
      createdAt: riscatto.createdAt,
    },
  });
}
