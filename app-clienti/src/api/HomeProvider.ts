/**
 * Dati della Home, del wallet, dei percorsi, dei Flash Slot e degli inviti.
 *
 * Una chiamata per schermata: su rete mobile sei richieste separate diventano
 * sei attese e sei modi di riempirsi a metà.
 */
import { apiRequest } from './http';

export interface Proposta {
  id: string;
  tipo: 'scadenza' | 'premio' | 'percorso' | 'flash' | 'ritorno' | 'club' | 'challenge' | 'compleanno' | 'referral';
  icona: string;
  titolo: string;
  sottotitolo: string;
  priorita: number;
  azione: { tipo: string; label: string; treatmentId?: string; slotId?: string; winId?: string; packageId?: string; challengeId?: string };
}

export interface DatiHome {
  user: { id: string; nome: string; cognome: string; loyaltyPoints: number; cashback: number; vipLevel: number; avatar?: string | null };
  messaggio: string | null;
  prossimoAppuntamento: {
    id: string; date: string; startTime: string; endTime: string;
    treatmentName: string; operatorName: string; price: number;
  } | null;
  /** Data dell'ultima visita (ISO), per il richiamo "ci manchi". */
  ultimaVisita: string | null;
  /** Recapiti del centro, configurati dal gestionale. Campi vuoti = riga nascosta. */
  centro: { nome: string; telefono: string; indirizzo: string; orari: string };
  punti: number;
  wallet: {
    totale: number;
    perTasca: { bucket: string; etichetta: string; importo: number }[];
    inScadenza: { importo: number; entro: string | null; giorni: number | null };
  } | null;
  club: {
    attuale: { name: string; color: string; perks: string[] } | null;
    prossimo: { name: string; color: string; mancaSpesa: number } | null;
    avanzamento: number;
    spesaTotale: number;
  } | null;
  percorsi: { id: string; nome: string; colore: string; fatte: number; totali: number; residue: number; scadenza: string | null }[];
  proposte: Proposta[];
  proposteTotali: number;
  funzioni: Record<string, boolean>;
}

export interface MovimentoWallet {
  id: string; kind: 'credit' | 'points'; amount: number;
  etichettaTasca: string; reason: string; createdAt: string;
  expiresAt: string | null; scaduto: boolean; residuo: number;
}

export interface DatiWallet {
  totale: number;
  perTasca: { bucket: string; etichetta: string; importo: number }[];
  inScadenza: { importo: number; entro: string | null; giorni: number | null };
  punti: number;
  puntiPerEuro: number;
  movimenti: MovimentoWallet[];
}

export interface Percorso {
  id: string; nome: string; colore: string;
  totali: number; fatte: number; residue: number;
  omaggio: boolean; scadenza: string | null;
  prezzo: number; pagato: number; daPagare: number; acquisto: string; stato: string;
  ultimaSeduta: string | null; ogniGiorni: number | null; prossimaConsigliata: string | null;
  tappe: { numero: number; data: string; operatrice: string | null; nota: string | null }[];
}

export interface FlashSlotApp {
  id: string; date: string; startTime: string; endTime: string;
  treatmentName: string; operatorName: string;
  fullPrice: number; price: number; risparmio: number; restanoSecondi: number;
}

export interface DatiReferral {
  codice: string; link: string; testoDaCondividere: string;
  invitate: number; registrate: number; diventateClienti: number;
  creditoGuadagnato: number; premioInvitante: number; premioInvitata: number;
  righe: { nome: string | null; telefono: string; stato: string; quando: string }[];
}

export const homeService = {
  home: (token: string) => apiRequest<DatiHome>('/api/mobile/home', { token }),
  wallet: (token: string) => apiRequest<DatiWallet>('/api/mobile/wallet', { token }),
  percorsi: (token: string) =>
    apiRequest<{ attivi: Percorso[]; conclusi: Percorso[] }>('/api/mobile/percorsi', { token }),
  flash: (token: string) => apiRequest<{ slots: FlashSlotApp[] }>('/api/mobile/flash', { token }),
  prendiFlash: (token: string, slotId: string) =>
    apiRequest<{ ok: boolean; slot: { date: string; startTime: string; treatmentName: string; operatorName: string; price: number } }>(
      '/api/mobile/flash/take', { method: 'POST', token, body: { slotId } }
    ),
  referral: (token: string) => apiRequest<DatiReferral>('/api/mobile/referral', { token }),
  invita: (token: string, nome: string, telefono: string) =>
    apiRequest<{ ok: boolean }>('/api/mobile/referral', { method: 'POST', token, body: { nome, telefono } }),
  apriPremio: (token: string, winId: string) =>
    apiRequest<{ ok: boolean; premio: { nome: string; kind: string; valore: number } }>(
      '/api/mobile/premi/apri', { method: 'POST', token, body: { winId } }
    ),
};
