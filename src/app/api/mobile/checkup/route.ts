/**
 * Il check-up estetico dall'app: la cliente compila, l'operatrice verifica.
 *
 * Non produce diagnosi: se emergono condizioni da guardare si accende solo
 * un flag e un avviso neutro — la valutazione la fa una persona in centro.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { leggiDomandeCheckup, impostaConsenso, registraAccesso } from '@/lib/estetica';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const [domande, ultimo] = await Promise.all([
    leggiDomandeCheckup(),
    prisma.checkupEstetico.findFirst({
      where: { clientId: cliente.id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return Response.json({
    domande,
    // Le note interne restano interne: alla cliente arriva solo il suo.
    ultimo: ultimo && {
      id: ultimo.id,
      risposte: ultimo.risposte,
      daValutare: ultimo.daValutare,
      verificato: Boolean(ultimo.verificatoIl),
      creatoIl: ultimo.createdAt,
    },
  });
}

const lista = (v: unknown, max = 20) =>
  (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, max);

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || body.consenso !== true) {
    return Response.json(
      { error: 'Per salvare il check-up serve il consenso al trattamento dei dati.' },
      { status: 400 }
    );
  }

  const risposte = {
    obiettivi: lista(body.obiettivi),
    aree: lista(body.aree),
    abitudini: lista(body.abitudini),
    trattamentiPrecedenti: String(body.trattamentiPrecedenti ?? '').trim().slice(0, 1000),
    preferenze: String(body.preferenze ?? '').trim().slice(0, 1000),
    condizioni: lista(body.condizioni),
    note: String(body.note ?? '').trim().slice(0, 1000),
  };
  if (risposte.obiettivi.length === 0 && risposte.aree.length === 0) {
    return Response.json({ error: 'Scegli almeno un obiettivo o un\'area.' }, { status: 400 });
  }

  const ora = new Date().toISOString();
  const daValutare = risposte.condizioni.length > 0;

  const checkup = await prisma.checkupEstetico.create({
    data: {
      clientId: cliente.id,
      risposte: risposte as unknown as object,
      daValutare,
      consensoIl: ora,
      createdAt: ora,
    },
  });
  await impostaConsenso(cliente.id, 'checkup', true);
  await registraAccesso('cliente', cliente.id, 'checkup-compilato', checkup.id);

  return Response.json({
    ok: true,
    daValutare,
    // L'avviso è volutamente neutro: nessuna diagnosi, nessun allarme.
    avviso: daValutare
      ? 'Grazie! Alcune risposte richiedono una valutazione di persona: prima di alcuni trattamenti ne parleremo insieme in centro.'
      : null,
  });
}
