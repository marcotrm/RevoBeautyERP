/**
 * Il modulo dei percorsi di estetica: check-up, consulenza, area risultati,
 * foto e consensi. Tutto passa dalle API reali del gestionale.
 */
import { apiRequest } from './http';

// ── Check-up ──

export interface DomandeCheckup {
  obiettivi: string[]; aree: string[]; abitudini: string[]; condizioni: string[];
}
export interface RisposteCheckup {
  obiettivi: string[]; aree: string[]; abitudini: string[];
  trattamentiPrecedenti: string; preferenze: string; condizioni: string[]; note: string;
}
export interface StatoCheckup {
  domande: DomandeCheckup;
  ultimo: { id: string; risposte: RisposteCheckup; daValutare: boolean; verificato: boolean; creatoIl: string } | null;
}

// ── Consulenza ──

export interface RichiestaConsulenza {
  id: string; aree: string[]; desiderio: string; stato: string; percorsoId: string | null; createdAt: string;
}

// ── Percorsi e risultati ──

export interface SedutaCliente {
  id: string; numero: number; data: string; ora: string | null; operatrice: string;
  trattamento: string; area: string | null; durataMinuti: number | null;
  osservazioni: string | null; indicazioniDopo: string | null;
  misurazioni: { nome: string; valore: string; unita: string }[] | null;
}
export interface FotoCliente {
  id: string; area: string; immagine: string; scattataIl: string; origine: string; sedutaId: string | null;
}
export interface PercorsoCliente {
  id: string; nome: string; descrizione: string | null; obiettivo: string;
  trattamenti: { nome: string }[]; seduteTotali: number; seduteFatte: number;
  frequenza: string | null; dataInizio: string; stato: string;
  noteCliente: string | null; mantenimento: string | null;
  tappe: { titolo: string; dopoSeduta: number; raggiunta: boolean }[];
  sedute: SedutaCliente[]; foto: FotoCliente[]; fotoTotali: number;
}
export interface DatiRisultati {
  percorsi: PercorsoCliente[];
  consensoFoto: boolean;
  prossimoAppuntamento: { id: string; date: string; startTime: string; treatmentName: string; operatorName: string } | null;
  checkup: { fatto: boolean; verificato: boolean; creatoIl: string } | null;
}

// ── Consensi ──

export interface ConsensoCliente {
  tipo: string; nome: string; testo: string; concesso: boolean;
  concessoIl: string | null; revocatoIl: string | null;
}

export const esteticaService = {
  // Check-up
  checkup: (token: string) => apiRequest<StatoCheckup>('/api/mobile/checkup', { token }),
  inviaCheckup: (token: string, risposte: Partial<RisposteCheckup> & { consenso: true }) =>
    apiRequest<{ ok: boolean; daValutare: boolean; avviso: string | null }>('/api/mobile/checkup', {
      method: 'POST', token, body: risposte,
    }),

  // Consulenza
  consulenza: (token: string) =>
    apiRequest<{ aree: string[]; richieste: RichiestaConsulenza[] }>('/api/mobile/consulenza', { token }),
  inviaConsulenza: (token: string, aree: string[], desiderio: string) =>
    apiRequest<{ ok: boolean; id: string }>('/api/mobile/consulenza', {
      method: 'POST', token, body: { aree, desiderio },
    }),

  // Area risultati
  risultati: (token: string) => apiRequest<DatiRisultati>('/api/mobile/percorso-estetico', { token }),
  caricaFoto: (token: string, percorsoId: string, area: string, immagine: string) =>
    apiRequest<{ ok: boolean; id: string }>('/api/mobile/percorso-estetico/foto', {
      method: 'POST', token, body: { percorsoId, area, immagine },
    }),
  eliminaFoto: (token: string, id: string) =>
    apiRequest<{ ok: boolean }>('/api/mobile/percorso-estetico/foto', {
      method: 'DELETE', token, body: { id },
    }),

  // Consensi
  consensi: (token: string) =>
    apiRequest<{ consensi: ConsensoCliente[] }>('/api/mobile/consensi', { token }),
  impostaConsenso: (token: string, tipo: string, concesso: boolean) =>
    apiRequest<{ ok: boolean }>('/api/mobile/consensi', {
      method: 'POST', token, body: { tipo, concesso },
    }),
};
