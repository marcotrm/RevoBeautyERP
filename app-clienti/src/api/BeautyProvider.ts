/**
 * I servizi del percorso beauty: Score, Autopilot, Missioni, Passport.
 */
import { apiRequest } from './http';

// ---------- Revo Score ----------

export interface ComponenteScore {
  codice: string;
  nome: string;
  punti: number;
  massimo: number;
  spiegazione: string;
}

export interface DatiScore {
  totale: number;
  livello: string;
  componenti: ComponenteScore[];
  delta30: number;
  storico: { data: string; totale: number }[];
}

// ---------- Autopilot ----------

export interface SlotAutopilot {
  date: string;
  time: string;
  endTime: string;
  operatorName: string;
  operatorId: string;
}

export interface SuggerimentoAutopilot {
  treatmentId: string;
  treatmentName: string;
  ultimaSeduta: string;
  ogniGiorni: number;
  finestraDa: string;
  finestraA: string;
  aperta: boolean;
  slots: SlotAutopilot[];
}

// ---------- Missioni ----------

export interface Missione {
  codice: string;
  titolo: string;
  descrizione: string;
  premioPunti: number;
  badge: { codice: string; nome: string } | null;
  target: number;
  avanzamento: number;
  completata: boolean;
  riscattata: boolean;
}

export interface BadgeCliente {
  codice: string;
  nome: string;
  assegnatoAt: string;
}

// ---------- Passport ----------

export interface DatiPassport {
  anno: number;
  clienteDal: string | null;
  sedute: number;
  serviziProvati: number;
  puntiGuadagnati: number;
  amichePortate: number;
  percorsiCompletati: number;
  perArea: { area: string; volte: number }[];
  badge: BadgeCliente[];
}

export const beautyService = {
  score: (token: string) => apiRequest<DatiScore>('/api/mobile/score', { token }),

  autopilot: (token: string, conSlots = false) =>
    apiRequest<{ suggerimenti: SuggerimentoAutopilot[] }>(
      `/api/mobile/autopilot${conSlots ? '?slots=1' : ''}`, { token }
    ),

  missioni: (token: string) =>
    apiRequest<{ missioni: Missione[]; badge: BadgeCliente[] }>('/api/mobile/missions', { token }),

  riscatta: (token: string, codice: string) =>
    apiRequest<{ ok: boolean; punti: number }>('/api/mobile/missions', {
      method: 'POST', token, body: { codice },
    }),

  passport: (token: string) => apiRequest<DatiPassport>('/api/mobile/passport', { token }),
};

// ---------- Revo AI ----------

export interface MessaggioRevoAI {
  id: string;
  ruolo: 'cliente' | 'revo';
  testo: string;
  createdAt: string;
}

export const revoAiService = {
  storico: (token: string) =>
    apiRequest<{ messaggi: MessaggioRevoAI[] }>('/api/mobile/ai/chat', { token }),

  chiedi: (token: string, testo: string) =>
    apiRequest<{ messaggio: MessaggioRevoAI }>('/api/mobile/ai/chat', {
      method: 'POST', token, body: { testo },
    }),
};
