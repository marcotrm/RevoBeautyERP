import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Letta, e — se serve — chiusa.
 *
 * Aprire la conversazione segna letti i suoi messaggi, ma non basta a
 * spegnere il promemoria: quello guarda chi ha detto l'ultima parola, ed e'
 * giusto cosi'. Il buco e' un altro: a volte la cliente l'abbiamo richiamata
 * al telefono, a volte quel messaggio non chiedeva niente. Senza una via
 * d'uscita la chat resterebbe segnata per sempre — e un elenco che indica
 * cose gia' sistemate smette di essere creduto.
 *
 * Con `gestita` si mette un segno datato ADESSO. Vale fino a qui: se dopo
 * arriva un altro messaggio suo, la conversazione torna da rispondere.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.clientId) return Response.json({ error: 'clientId obbligatorio' }, { status: 400 });
  const clientId = String(body.clientId);

  await prisma.chatMessage.updateMany({
    where: { clientId, sender: 'client', readByOperator: false },
    data: { readByOperator: true },
  });

  if (body.gestita) {
    const now = new Date().toISOString();
    await prisma.adminEntry.upsert({
      where: { rowId: `chat:gestita:${clientId}` },
      update: { data: { clientId, gestitaAl: now } },
      create: { rowId: `chat:gestita:${clientId}`, kind: 'chat_gestita', entityId: clientId, data: { clientId, gestitaAl: now }, createdAt: now },
    });
  }

  return Response.json({ success: true });
}
