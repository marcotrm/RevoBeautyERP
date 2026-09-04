import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Elenco conversazioni per il pannello operatrice: ultimo messaggio + non letti per cliente.
export async function GET() {
  const messages = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'asc' },
  });

  /*
    Quello che conta non e' «l'abbiamo aperta», e' «le abbiamo risposto».

    Il contatore guardava solo `readByOperator`, che diventa vero appena
    qualcuno apre la conversazione: entravi, uscivi senza scrivere niente, e
    da fuori quella chat era identica a una a cui avevamo risposto. E' lo
    stesso identico buco che avevamo su WhatsApp, e li' ci e' costato una
    cliente rimasta ad aspettare dodici ore.

    Adesso si contano anche i messaggi rimasti SENZA RISPOSTA: si risale
    dall'ultimo e ci si ferma al primo messaggio nostro. Tutto quello che sta
    sopra aspetta ancora, e l'attesa si misura dal piu' vecchio del gruppo —
    se ha scritto tre volte in mezz'ora, aspetta da mezz'ora.
  */
  const byClient = new Map<string, {
    clientId: string; clientName: string; lastBody: string; lastAt: string; lastSender: string;
    unread: number; oldestUnreadAt: string | null;
    senzaRisposta: number; senzaRispostaDa: string | null; attesaMinuti: number; daRispondere: boolean;
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
        senzaRisposta: m.sender === 'client' ? 1 : 0,
        senzaRispostaDa: m.sender === 'client' ? m.createdAt : null,
        attesaMinuti: 0, daRispondere: false,
      });
      continue;
    }
    existing.clientName = m.clientName || existing.clientName;
    existing.lastBody = m.body;
    existing.lastAt = m.createdAt;
    existing.lastSender = m.sender;
    if (isUnread) {
      existing.unread += 1;
      // messaggi in ordine crescente: il primo non letto e' il piu' vecchio
      if (!existing.oldestUnreadAt) existing.oldestUnreadAt = m.createdAt;
    }
    if (m.sender === 'operator') {
      // Le abbiamo scritto: da qui in poi non aspetta piu' niente.
      existing.senzaRisposta = 0;
      existing.senzaRispostaDa = null;
    } else {
      existing.senzaRisposta += 1;
      if (!existing.senzaRispostaDa) existing.senzaRispostaDa = m.createdAt;
    }
  }

  /** Dopo questi minuti senza una nostra risposta, la chat torna in cima. */
  const ATTESA_MIN = 10;
  /*
    …ma non per sempre.

    Su WhatsApp, togliendo questo limite, sono risalite in testa all'elenco
    conversazioni di agosto e il promemoria e' diventato rumore. Qui dentro
    ce ne sono gia' due mai risposte da venticinque giorni: restano segnate
    nell'elenco, con scritto da quanto aspettano, ma non si mettono a bussare
    adesso — quella risposta non la aspetta piu' nessuno.
  */
  const ANCORA_UTILE_MIN = 48 * 60;

  for (const c of byClient.values()) {
    c.attesaMinuti = c.senzaRispostaDa
      ? Math.floor((Date.now() - new Date(c.senzaRispostaDa).getTime()) / 60_000)
      : 0;
    c.daRispondere = c.senzaRisposta > 0
      && c.attesaMinuti >= ATTESA_MIN
      && c.attesaMinuti <= ANCORA_UTILE_MIN;
    /*
      Aprire e basta non la fa piu' sembrare sistemata: passati i dieci
      minuti il numerino torna, col conto dei messaggi rimasti in sospeso, e
      ci resta finche' non le scriviamo davvero.
    */
    if (c.daRispondere) {
      c.unread = Math.max(c.unread, c.senzaRisposta);
      if (!c.oldestUnreadAt) c.oldestUnreadAt = c.senzaRispostaDa;
    }
  }

  /*
    Ordine: prima chi aspetta una risposta, e fra loro chi aspetta da piu'
    tempo. Poi il resto per orario. Chi aspetta da un'ora deve stare sopra a
    chi ha appena scritto, altrimenti l'elenco premia le chat fresche e
    seppellisce proprio quelle in ritardo.
  */
  const conversations = [...byClient.values()].sort((a, b) => {
    if (a.daRispondere !== b.daRispondere) return a.daRispondere ? -1 : 1;
    if (a.daRispondere && b.daRispondere) return (a.senzaRispostaDa || '').localeCompare(b.senzaRispostaDa || '');
    return a.lastAt < b.lastAt ? 1 : -1;
  });
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
