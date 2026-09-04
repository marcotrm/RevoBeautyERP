/**
 * La bacheca dell'app, lato gestionale: pubblicare la promo del giorno
 * o la foto di un lavoro, e mandarla come notifica a tutte le clienti
 * con l'app.
 *
 * GET  → i post (anche spenti), i più recenti prima
 * POST → { tipo, titolo, testo?, foto?, push? } pubblica; con push=true
 *        parte la notifica a ogni cliente con l'app (la deduplica di
 *        app_notifications regge anche a un doppio clic).
 */

import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const posts = await prisma.appPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return Response.json({ posts });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const tipo = body?.tipo === 'promo' ? 'promo' : 'lavoro';
  const titolo = String(body?.titolo || '').trim();
  const testo = String(body?.testo || '').trim();
  const foto = typeof body?.foto === 'string' && body.foto.startsWith('data:image/') ? body.foto : null;

  if (!titolo) return Response.json({ error: 'Il titolo serve.' }, { status: 400 });
  if (foto && foto.length > 400_000) {
    return Response.json({ error: 'Foto troppo pesante: la pagina dovrebbe averla compressa.' }, { status: 400 });
  }

  const post = await prisma.appPost.create({
    data: {
      tipo, titolo, testo, foto,
      creatoDa: body?.creatoDa ? String(body.creatoDa) : null,
      createdAt: new Date().toISOString(),
    },
  });

  // La notifica a tutte: chi pubblica decide il momento, quindi si manda
  // adesso. Ogni invio è dedupato per (cliente, tipo, refId) — un doppio
  // clic non produce doppioni.
  let inviate = 0;
  if (body?.push) {
    const { inviaNotifica } = await import('@/lib/pushExpo');
    const account = await prisma.mobileAccount.findMany({ select: { clientId: true } });
    for (const a of account) {
      try {
        const esito = await inviaNotifica({
          clientId: a.clientId,
          tipo: 'post',
          refId: post.id,
          titolo: tipo === 'promo' ? `Promo di oggi 🎁 ${titolo}` : `Dal salone ✨ ${titolo}`,
          corpo: testo ? (testo.length > 90 ? `${testo.slice(0, 90)}…` : testo) : 'Apri la bacheca per vederla.',
          dati: { rotta: '/bacheca' },
        });
        if (esito === 'inviata') inviate++;
      } catch (err) {
        console.error('[bacheca] push fallita per', a.clientId, err);
      }
    }
    await prisma.appPost.update({ where: { id: post.id }, data: { pushInviata: true } });
  }

  return Response.json({ post, inviate });
}
