import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Messaggi di una conversazione (per cliente), in ordine cronologico.
export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get('clientId');
  if (!clientId) return Response.json({ error: 'clientId obbligatorio' }, { status: 400 });

  const messages = await prisma.chatMessage.findMany({
    where: { clientId },
    orderBy: { createdAt: 'asc' },
  });

  return Response.json({ messages });
}
