import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Elenco conversazioni per il pannello operatrice: ultimo messaggio + non letti per cliente.
export async function GET() {
  const messages = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const byClient = new Map<string, {
    clientId: string; clientName: string; lastBody: string; lastAt: string; lastSender: string; unread: number; oldestUnreadAt: string | null;
  }>();

  for (const m of messages) {
    const isUnread = m.sender === 'client' && !m.readByOperator;
    const existing = byClient.get(m.clientId);
    if (!existing) {
      byClient.set(m.clientId, {
        clientId: m.clientId, clientName: m.clientName,
        lastBody: m.body, lastAt: m.createdAt, lastSender: m.sender,
        unread: isUnread ? 1 : 0,
        oldestUnreadAt: isUnread ? m.createdAt : null,
      });
    } else {
      existing.clientName = m.clientName || existing.clientName;
      existing.lastBody = m.body;
      existing.lastAt = m.createdAt;
      existing.lastSender = m.sender;
      if (isUnread) {
        existing.unread += 1;
        // messaggi in ordine crescente: il primo non letto è il più vecchio
        if (!existing.oldestUnreadAt) existing.oldestUnreadAt = m.createdAt;
      }
    }
  }

  const conversations = [...byClient.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  // La foto del profilo caricata dall'app, dove c'è: la chat mostra il volto
  const clienti = await prisma.client.findMany({
    where: { id: { in: conversations.map((c) => c.clientId) } },
    select: { id: true, avatar: true },
  });
  const avatarDi = new Map(clienti.map((c) => [c.id, c.avatar]));
  const conAvatar = conversations.map((c) => ({ ...c, avatar: avatarDi.get(c.clientId) ?? null }));

  return Response.json({ conversations: conAvatar, totalUnread });
}
