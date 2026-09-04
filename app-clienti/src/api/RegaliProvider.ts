/**
 * I regali coi punti: prodotti veri dello scaffale, riscattabili dall'app.
 */
import { apiRequest } from './http';

export interface PremioVetrina {
  premioId: string;
  nome: string;
  brand: string;
  image: string | null;
  punti: number;
  disponibile: boolean;
}

export interface TrattamentoVetrina {
  premioId: string;
  nome: string;
  categoria: string;
  durata: number;
  punti: number;
  disponibile: boolean;
}

export interface RiscattoRegalo {
  id: string;
  tipo?: 'prodotto' | 'trattamento';
  nomeProdotto: string;
  punti: number;
  stato: 'da_ritirare' | 'consegnato' | 'annullato';
  codice: string;
  createdAt: string;
}

export interface DatiRegali {
  punti: number;
  premi: PremioVetrina[];
  trattamenti: TrattamentoVetrina[];
  riscatti: RiscattoRegalo[];
}

export const regaliService = {
  vetrina: (token: string) => apiRequest<DatiRegali>('/api/mobile/rewards', { token }),
  riscatta: (token: string, premioId: string, tipo: 'prodotto' | 'trattamento' = 'prodotto') =>
    apiRequest<{ ok: boolean; riscatto: RiscattoRegalo }>('/api/mobile/rewards', {
      method: 'POST', token, body: { premioId, tipo },
    }),
};
