import { create } from 'zustand';
import { clientiTop } from '@/app/actions/clientiTop';
import { chiaveNome, riassunto, type ClienteTop } from '@/lib/clientiTop';
import { clientiARischio, type ClienteARischio } from '@/app/actions/affidabilita';
import { clientiDifficili, type ClienteDifficile } from '@/app/actions/clientiDifficili';
import { riassuntoAffidabilita, consiglioAffidabilita } from '@/lib/affidabilita';

/**
 * I tre segni sulle clienti, in un posto solo.
 *
 * Corona (spende tanto), calendario rosso (salta gli appuntamenti), faccina
 * (segnalata a mano). Servono dappertutto — in agenda, nella ricerca, in
 * WhatsApp, in cassa — e devono comparire PRIMA di dare un appuntamento, non
 * dopo: è lì che si decide se tenere il posto o chiedere l'acconto.
 *
 * Sono tre elenchi corti che cambiano di giorno in giorno: si leggono una volta
 * per sessione e restano qui, invece di far partire tre interrogazioni da ogni
 * tendina che si apre.
 */

export interface SegniCliente {
  corona: ClienteTop | null;
  rischio: ClienteARischio | null;
  segnalata: ClienteDifficile | null;
}

const VUOTI: SegniCliente = { corona: null, rischio: null, segnalata: null };

interface SegniStore {
  top: ClienteTop[];
  /** Per id scheda: è la via giusta, quando l'id c'è. */
  rischi: Map<string, ClienteARischio>;
  segnalate: Map<string, ClienteDifficile>;
  /*
    Per nome. Serve dove l'id non c'è: la corona nasce dagli scontrini (che
    hanno solo il nome) e in WhatsApp una conversazione è un numero con
    accanto il nome dell'anagrafica. Si usa solo come ripiego.
  */
  coroneP: Map<string, ClienteTop>;
  rischiP: Map<string, ClienteARischio>;
  segnalateP: Map<string, ClienteDifficile>;
  caricato: boolean;
  caricando: boolean;
  carica: (forza?: boolean) => Promise<void>;
}

export const useSegniStore = create<SegniStore>()((set, get) => ({
  top: [],
  rischi: new Map(),
  segnalate: new Map(),
  coroneP: new Map(),
  rischiP: new Map(),
  segnalateP: new Map(),
  caricato: false,
  caricando: false,
  carica: async (forza = false) => {
    const s = get();
    if (s.caricando || (s.caricato && !forza)) return;
    set({ caricando: true });
    try {
      const [top, rischi, segnalate] = await Promise.all([
        clientiTop().catch(() => []),
        clientiARischio().catch(() => []),
        clientiDifficili().catch(() => []),
      ]);
      set({
        top,
        coroneP: new Map(top.map(c => [chiaveNome(c.nome), c])),
        rischi: new Map(rischi.map(c => [c.clientId, c])),
        segnalate: new Map(segnalate.map(c => [c.clientId, c])),
        rischiP: new Map(rischi.filter(c => c.nome).map(c => [chiaveNome(c.nome), c])),
        segnalateP: new Map(segnalate.filter(c => c.nome).map(c => [chiaveNome(c.nome), c])),
        caricato: true,
      });
    } finally {
      set({ caricando: false });
    }
  },
}));

/**
 * I segni di una persona.
 *
 * L'id serve per disdette e segnalazioni (sono legate alla scheda), il nome per
 * la corona (che nasce dagli scontrini, dove l'id non c'è). Chi ha solo uno dei
 * due passa quello: il resto resta vuoto invece di sbagliare persona.
 */
export function segniDi(clientId?: string, nome?: string): SegniCliente {
  const s = useSegniStore.getState();
  const k = nome ? chiaveNome(nome) : '';
  return {
    corona: k ? s.coroneP.get(k) || null : null,
    // Prima per id; il nome è il ripiego di dove l'id non c'è (WhatsApp).
    rischio: (clientId && s.rischi.get(clientId)) || (k ? s.rischiP.get(k) : null) || null,
    segnalata: (clientId && s.segnalate.get(clientId)) || (k ? s.segnalateP.get(k) : null) || null,
  };
}

export function nessunSegno(s: SegniCliente): boolean {
  return !s.corona && !s.rischio && !s.segnalata;
}

export { VUOTI as SEGNI_VUOTI, riassunto, riassuntoAffidabilita, consiglioAffidabilita };
