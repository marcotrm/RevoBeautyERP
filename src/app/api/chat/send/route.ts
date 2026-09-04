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

  // La risposta dell'operatrice bussa sul telefono della cliente, subito.
  // Solo per chi ha l'app; se la push fallisce il messaggio resta comunque
  // consegnato in chat — mai far dipendere l'uno dall'altra.
  if (sender === 'operator') {
    try {
      const account = await prisma.mobileAccount.findUnique({
        where: { clientId: message.clientId },
        select: { id: true },
      });
      if (account) {
        const { inviaNotifica } = await import('@/lib/pushExpo');
        const anteprima = message.body.length > 90 ? `${message.body.slice(0, 90)}…` : message.body;
        await inviaNotifica({
          clientId: message.clientId,
          tipo: 'chat',
          refId: message.id,
          titolo: `${message.operatorName || 'RevoBeauty'} ti ha risposto 💬`,
          corpo: anteprima,
          dati: { rotta: '/chat' },
        });
      }
    } catch (err) {
      console.error('[chat] push di risposta fallita:', err);
    }
  }

  return Response.json({ success: true, message });
}
