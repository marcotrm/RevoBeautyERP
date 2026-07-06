import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Invia un messaggio in chat. Usato sia dall'app cliente (sender='client')
// sia dal gestionale/operatrice (sender='operator').
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.clientId) return Response.json({ error: 'clientId obbligatorio' }, { status: 400 });
  if (!body?.body || !String(body.body).trim()) return Response.json({ error: 'Messaggio vuoto' }, { status: 400 });
  const sender = body.sender === 'operator' ? 'operator' : 'client';

  const message = await prisma.chatMessage.create({
    data: {
      clientId: String(body.clientId),
      clientName: String(body.clientName || '').trim() || 'Cliente',
      sender,
      body: String(body.body).trim(),
      operatorName: body.operatorName ? String(body.operatorName) : null,
      readByOperator: sender === 'operator',
      readByClient: sender === 'client',
      createdAt: new Date().toISOString(),
    },
  });

  return Response.json({ success: true, message });
}
