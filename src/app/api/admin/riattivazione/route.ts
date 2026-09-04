/**
 * La coda di riattivazione: il motore propone chi si sta perdendo, qui una
 * persona decide se e come contattarla. Non parte MAI niente da solo.
 *
 * L'unico canale collegato oggi è la notifica push dell'app: per WhatsApp
 * o email la proposta resta in coda con il messaggio pronto da copiare.
 */

import { prisma } from '@/lib/prisma';
import { inviaNotifica } from '@/lib/pushExpo';
import { generaRiattivazioni, registraAccesso } from '@/lib/estetica';

export async function GET(request: Request) {
  const url = new URL(request.url);
  // ?rigenera=1 rifà il giro del motore prima di mostrare la lista.
  if (url.searchParams.get('rigenera') === '1') {
    await generaRiattivazioni();
  }

  const proposte = await prisma.riattivazioneProposta.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return Response.json({
    proposte,
    daDecidere: proposte.filter((p) => p.stato === 'proposta').length,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: 'Richiesta vuota.' }, { status: 400 });

  const id = String(body.id ?? '');
  const azione = String(body.azione ?? '');
  const operatrice = String(body.operatrice ?? '').trim() || 'centro';
  const ora = new Date().toISOString();

  const proposta = await prisma.riattivazioneProposta.findUnique({ where: { id } });
  if (!proposta) return Response.json({ error: 'Proposta non trovata.' }, { status: 404 });
  if (proposta.stato !== 'proposta') {
    return Response.json({ error: 'Questa proposta è già stata decisa.' }, { status: 409 });
  }

  if (azione === 'scarta') {
    await prisma.riattivazioneProposta.update({
      where: { id },
      data: { stato: 'scartata', decisaDa: operatrice },
    });
    return Response.json({ ok: true });
  }

  if (azione === 'invia') {
    // Il consenso si ricontrolla ADESSO: fra la proposta e il click possono
    // essere passati giorni, e nel frattempo la cliente può aver revocato.
    const consenso = await prisma.consensoApp.findUnique({
      where: { clientId_tipo: { clientId: proposta.clientId, tipo: 'riattivazione' } },
    });
    if (consenso && !consenso.concesso) {
      await prisma.riattivazioneProposta.update({
        where: { id }, data: { stato: 'scartata', decisaDa: 'consenso revocato' },
      });
      return Response.json({ error: 'La cliente ha disattivato questi promemoria: proposta scartata.' }, { status: 403 });
    }

    const messaggio = String(body.messaggio ?? proposta.messaggio).trim().slice(0, 500) || proposta.messaggio;
    const esito = await inviaNotifica({
      clientId: proposta.clientId,
      tipo: 'riattivazione',
      refId: id,
      titolo: 'Ci manchi 💛',
      corpo: messaggio,
      dati: { rotta: '/prenota' },
    });

    if (esito === 'no-token' || esito === 'errore') {
      return Response.json(
        { error: esito === 'no-token'
            ? 'La cliente non ha l\'app o le notifiche attive: contattala su un altro canale (il messaggio è pronto da copiare).'
            : 'Invio non riuscito: riprova fra poco.' },
        { status: 422 }
      );
    }

    await prisma.riattivazioneProposta.update({
      where: { id },
      data: { stato: 'inviata', decisaDa: operatrice, canale: 'push', inviataIl: ora, messaggio },
    });
    await registraAccesso(operatrice, proposta.clientId, 'riattivazione-inviata', `${proposta.motivo} via push`);
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Azione sconosciuta.' }, { status: 400 });
}
