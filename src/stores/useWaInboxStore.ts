import { create } from 'zustand';
import { loadWaUnread } from '@/app/actions/whatsapp';
import type { WaUnreadChat } from '@/lib/wa-conversations';

/**
 * Messaggi WhatsApp non letti, condivisi da tutto il gestionale.
 *
 * Li usa il pallino lampeggiante sul menu WhatsApp e l'avviso a schermo che
 * scatta se un cliente resta senza risposta troppo a lungo. Un solo store così
 * il polling gira una volta sola, non una per componente.
 */
interface WaInboxState {
  chats: WaUnreadChat[];
  /** Messaggi nuovi in totale: è il numerino sul menu. */
  total: number;
  /** Quante conversazioni aspettano da più di 15 minuti: è il lampeggio. */
  inAttesa: number;
  loaded: boolean;
  fetchUnread: () => Promise<void>;
}

export const useWaInboxStore = create<WaInboxState>()((set) => ({
  chats: [],
  total: 0,
  inAttesa: 0,
  loaded: false,
  fetchUnread: async () => {
    try {
      const chats = await loadWaUnread();
      set({
        chats,
        total: chats.reduce((s, c) => s + c.unread, 0),
        inAttesa: chats.filter(c => c.daRispondere).length,
        loaded: true,
      });
    } catch {
      // Rete o DB giù: si riprova al giro dopo, senza svuotare quello che già mostriamo.
    }
  },
}));
