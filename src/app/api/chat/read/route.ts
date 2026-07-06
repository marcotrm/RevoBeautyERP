import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Segna come letti (lato operatrice) i messaggi del cliente indicato.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.clientId) return Response.json({ error: 'clientId obbligatorio' }, { status: 400 });

  await prisma.chatMessage.updateMany({
    where: { clientId: String(body.clientId), sender: 'client', readByOperator: false },
    data: { readByOperator: true },
  });

  return Response.json({ success: true });
}
