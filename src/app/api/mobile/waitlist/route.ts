/**
 * Lista d'attesa intelligente: "se si libera un posto così, avvisami".
 *
 * GET  → i desideri della cliente (attivi e recenti)
 * POST → nuovo desiderio. Massimo 3 attivi: una lista d'attesa illimitata
 *        diventa un modo per farsi notificare tutto, cioè niente.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';

const MAX_ATTIVE = 3;
const GIORNI_VALIDITA = 14;

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const desideri = await prisma.waitlistWish.findMany({
    where: { clientId: cliente.id, stato: { in: ['attiva', 'avvisata'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, treatmentName: true, giorni: true, dalleOre: true,
      alleOre: true, scadenza: true, stato: true,
    },
  });
  return Response.json({ desideri });
}

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const treatmentId = String(body?.treatmentId || '');
  const giorni: number[] = Array.isArray(body?.giorni)
    ? body.giorni.map(Number).filter((g: number) => g >= 0 && g <= 6)
    : [];
  const dalleOre = String(body?.dalleOre || '09:00');
  const alleOre = String(body?.alleOre || '19:00');

  if (!treatmentId) {
    return Response.json({ error: 'Scegli il trattamento.', code: 'VALIDATION' }, { status: 400 });
  }
  if (!/^\d{2}:\d{2}$/.test(dalleOre) || !/^\d{2}:\d{2}$/.test(alleOre) || dalleOre >= alleOre) {
    return Response.json({ error: 'Fascia oraria non valida.', code: 'VALIDATION' }, { status: 400 });
  }

  const trattamento = await prisma.treatment.findUnique({ where: { id: treatmentId } });
  if (!trattamento) {
    return Response.json({ error: 'Trattamento non trovato.', code: 'NOT_FOUND' }, { status: 404 });
  }

  const attive = await prisma.waitlistWish.count({
    where: { clientId: cliente.id, stato: 'attiva' },
  });
  if (attive >= MAX_ATTIVE) {
    return Response.json(
      { error: `Puoi avere al massimo ${MAX_ATTIVE} avvisi attivi. Annullane uno per crearne un altro.`, code: 'TOO_MANY' },
      { status: 409 }
    );
  }

  const scadenza = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(
    new Date(Date.now() + GIORNI_VALIDITA * 86400000)
  );

  const desiderio = await prisma.waitlistWish.create({
    data: {
      clientId: cliente.id,
      clientName: `${cliente.firstName} ${cliente.lastName}`.trim(),
      treatmentId,
      treatmentName: trattamento.name,
      giorni,
      dalleOre,
      alleOre,
      scadenza,
      createdAt: new Date().toISOString(),
    },
    select: {
      id: true, treatmentName: true, giorni: true, dalleOre: true,
      alleOre: true, scadenza: true, stato: true,
    },
  });

  return Response.json({ desiderio });
}
