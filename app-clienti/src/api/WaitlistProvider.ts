/**
 * Lista d'attesa intelligente: "se si libera un posto così, avvisami".
 */
import { apiRequest } from './http';

export interface DesiderioAttesa {
  id: string;
  treatmentName: string;
  /** 0=domenica … 6=sabato; vuoto = qualsiasi giorno */
  giorni: number[];
  dalleOre: string;
  alleOre: string;
  scadenza: string;
  stato: 'attiva' | 'avvisata' | 'annullata' | 'scaduta';
}

export interface NuovoDesiderio {
  treatmentId: string;
  giorni: number[];
  dalleOre: string;
  alleOre: string;
}

export const waitlistService = {
  list: (token: string) =>
    apiRequest<{ desideri: DesiderioAttesa[] }>('/api/mobile/waitlist', { token }),

  crea: (token: string, dati: NuovoDesiderio) =>
    apiRequest<{ desiderio: DesiderioAttesa }>('/api/mobile/waitlist', {
      method: 'POST', token, body: dati,
    }),

  annulla: (token: string, id: string) =>
    apiRequest<{ ok: boolean }>('/api/mobile/waitlist/cancel', {
      method: 'POST', token, body: { id, azione: 'annulla' },
    }),

  riattiva: (token: string, id: string) =>
    apiRequest<{ ok: boolean }>('/api/mobile/waitlist/cancel', {
      method: 'POST', token, body: { id, azione: 'riattiva' },
    }),
};
