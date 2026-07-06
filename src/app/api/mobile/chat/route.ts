import { prisma } from '@/lib/prisma';
import { getAccountFromRequest, unauthorized } from '@/lib/mobile';

export const runtime = 'nodejs';

// Chat della cliente loggata. Il cliente vede e scrive solo la propria conversazione
// (identificata dal token di sessione, non da un id passato dal client).

export async function GET(request: Request) {
  const account = await getAccountFromRequest(request);
  if (!account) return unauthorized();

  // Segna come letti (lato cliente) i messaggi dell'operatrice
  await prisma.chatMessage.updateMany({
    where: { clientId: account.clientId, sender: 'operator', readByClient: false },
    data: { readByClient: true },
  });

  const messages = await prisma.chatMessage.findMany({
    where: { clientId: account.clientId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, sender: true, body: true, operatorName: true, createdAt: true },
  });

  return Response.json({ messages });
}

export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);
  if (!account) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.body || !String(body.body).trim()) {
    return Response.json({ error: 'Il messaggio non può essere vuoto.', code: 'VALIDATION' }, { status: 400 });
  }

  const clientName = `${account.client.firstName} ${account.client.lastName}`.trim();
  const message = await prisma.chatMessage.create({
    data: {
      clientId: account.clientId,
      clientName,
      sender: 'client',
      body: String(body.body).trim(),
      readByOperator: false,
      readByClient: true,
      createdAt: new Date().toISOString(),
    },
    select: { id: true, sender: true, body: true, operatorName: true, createdAt: true },
  });

  return Response.json({ message });
}
