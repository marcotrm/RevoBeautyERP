/**
 * I check-up compilati dall'app, per il pannello: l'operatrice li legge,
 * aggiunge le sue note interne e li segna come verificati. È il pezzo umano
 * del check-up: il software raccoglie, la persona valuta.
 */

import { prisma } from '@/lib/prisma';
import { leggiDomandeCheckup, salvaDomandeCheckup, registraAccesso, type DomandeCheckup } from '@/lib/estetica';

export async function GET() {
  const [checkups, domande] = await Promise.all([
    prisma.checkupEstetico.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    leggiDomandeCheckup(),
  ]);

  // I nomi con una query sola, come sempre.
  const clienti = await prisma.client.findMany({
    where: { id: { in: [...new Set(checkups.map((c) => c.clientId))] } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  const anagrafica = new Map(clienti.map((c) => [c.id, c]));

  return Response.json({
    domande,
    checkups: checkups.map((c) => {
      const a = anagrafica.get(c.clientId);
      return {
        ...c,
        nome: a ? `${a.firstName} ${a.lastName}`.trim() : c.clientId,
        telefono: a?.phone ?? '',
      };
    }),
    daVerificare: checkups.filter((c) => !c.verificatoIl).length,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: 'Richiesta vuota.' }, { status: 400 });

  const operatrice = String(body.operatrice ?? '').trim() || 'centro';

  // Le domande configurabili dal centro.
  if (body.azione === 'domande') {
    await salvaDomandeCheckup(body.domande as DomandeCheckup);
    return Response.json({ ok: true });
  }

  const id = String(body.id ?? '');
  const checkup = await prisma.checkupEstetico.findUnique({ where: { id } });
  if (!checkup) return Response.json({ error: 'Check-up non trovato.' }, { status: 404 });

  const dati: Record<string, unknown> = {};
  if (body.noteInterne !== undefined) dati.noteInterne = String(body.noteInterne).trim().slice(0, 2000) || null;
  if (body.verificato === true) {
    dati.verificatoDa = operatrice;
    dati.verificatoIl = new Date().toISOString();
  }
  await prisma.checkupEstetico.update({ where: { id }, data: dati });
  await registraAccesso(operatrice, checkup.clientId, 'checkup-verificato', id);

  return Response.json({ ok: true });
}
