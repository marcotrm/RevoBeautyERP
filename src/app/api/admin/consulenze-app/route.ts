/**
 * Le consulenze arrivate dall'app: l'operatrice le prende in carico e,
 * quando dal colloquio nasce un piano, le trasforma in un percorso vero.
 * La trasformazione avvisa la cliente con una notifica gentile.
 */

import { prisma } from '@/lib/prisma';
import { inviaNotifica } from '@/lib/pushExpo';
import { registraAccesso } from '@/lib/estetica';

export async function GET() {
  const consulenze = await prisma.consulenzaApp.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return Response.json({
    consulenze,
    nuove: consulenze.filter((c) => c.stato === 'nuova').length,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: 'Richiesta vuota.' }, { status: 400 });

  const id = String(body.id ?? '');
  const azione = String(body.azione ?? '');
  const operatrice = String(body.operatrice ?? '').trim() || 'centro';
  const ora = new Date().toISOString();

  const consulenza = await prisma.consulenzaApp.findUnique({ where: { id } });
  if (!consulenza) return Response.json({ error: 'Consulenza non trovata.' }, { status: 404 });

  if (azione === 'prendi') {
    await prisma.consulenzaApp.update({
      where: { id },
      data: { stato: 'in_carico', presaDa: operatrice, updatedAt: ora },
    });
    return Response.json({ ok: true });
  }

  if (azione === 'chiudi') {
    await prisma.consulenzaApp.update({
      where: { id },
      data: {
        stato: 'chiusa', presaDa: consulenza.presaDa ?? operatrice,
        noteInterne: String(body.noteInterne ?? consulenza.noteInterne ?? '').trim().slice(0, 2000) || null,
        updatedAt: ora,
      },
    });
    return Response.json({ ok: true });
  }

  // Colleghiamo la consulenza a un percorso già creato dal pannello.
  if (azione === 'trasforma') {
    const percorsoId = String(body.percorsoId ?? '');
    const percorso = await prisma.percorsoEstetico.findFirst({
      where: { id: percorsoId, clientId: consulenza.clientId },
      select: { id: true, nome: true },
    });
    if (!percorso) {
      return Response.json({ error: 'Il percorso non esiste o è di un\'altra cliente.' }, { status: 404 });
    }

    await prisma.consulenzaApp.update({
      where: { id },
      data: { stato: 'trasformata', presaDa: consulenza.presaDa ?? operatrice, percorsoId, updatedAt: ora },
    });
    await registraAccesso(operatrice, consulenza.clientId, 'consulenza-trasformata', `${id} → ${percorsoId}`);

    // La notifica riusa il lucchetto in DB: se qualcuno preme due volte,
    // la seconda è un doppione e non parte.
    await inviaNotifica({
      clientId: consulenza.clientId,
      tipo: 'percorso-creato',
      refId: percorsoId,
      titolo: 'Il tuo percorso è pronto ✨',
      corpo: `Abbiamo preparato per te «${percorso.nome}»: trovalo nell'app, nella tua area risultati.`,
      dati: { rotta: '/risultati' },
    });

    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Azione sconosciuta.' }, { status: 400 });
}
