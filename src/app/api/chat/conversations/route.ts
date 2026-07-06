import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Elenco conversazioni per il pannello operatrice: ultimo messaggio + non letti per cliente.
export async function GET() {
  const messages = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const byClient = new Map<string, {
    clientId: string; clientName: string; lastBody: string; lastAt: string; lastSender: string; unread: number;
  }>();

  for (const m of messages) {
    const existing = byClient.get(m.clientId);
    const unreadInc = m.sender === 'client' && !m.readByOperator ? 1 : 0;
    if (!existing) {
      byClient.set(m.clientId, {
        clientId: m.clientId, clientName: m.clientName,
        lastBody: m.body, lastAt: m.createdAt, lastSender: m.sender, unread: unreadInc,
      });
    } else {
      existing.clientName = m.clientName || existing.clientName;
      existing.lastBody = m.body;
      existing.lastAt = m.createdAt;
      existing.lastSender = m.sender;
      existing.unread += unreadInc;
    }
  }

  const conversations = [...byClient.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return Response.json({ conversations, totalUnread });
}
