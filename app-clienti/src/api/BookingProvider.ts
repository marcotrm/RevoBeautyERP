/**
 * Servizio prenotazione: trattamenti, operatrici, ricerca degli orari liberi e
 * creazione dell'appuntamento.
 *
 * Trattamenti, operatrici e disponibilità sono pubblici; la prenotazione usa
 * il token (il cliente è già loggato, non deve inserire nome/telefono).
 * Gli orari arrivano dal motore del gestionale, che tiene conto di turni,
 * pause e appuntamenti già presi.
 */
import { apiRequest } from './http';

export interface BookingTreatment {
  id: string; name: string; category: string;
  price: number; duration: number;
  priceMale: number | null; priceFemale: number | null;
  durationMale: number | null; durationFemale: number | null;
  /** Chi lo sa fare (id operatrici). Vuoto = tutte, come nel motore. */
  abili?: string[];
}
export interface BookingOperator {
  id: string;
  nome: string;
  /** Solo il nome di battesimo: sotto la faccina ci sta. */
  nomeBreve: string;
  /** Foto tonda caricata dal centro; senza, si mostrano le iniziali. */
  avatar: string | null;
  /** Colore dell'operatrice, per il cerchio quando la foto manca. */
  colore: string;
  /** Le categorie che sa fare: la fila delle faccine si filtra su questa. */
  categorie: string[];
}

/** Un trattamento richiesto: operatorId vuoto = la prima disponibile. */
export interface ServizioRichiesto { treatmentId: string; operatorId?: string | null }

/** Chi fa cosa e a che ora dentro una seduta con più trattamenti. */
export interface Assegnazione {
  treatmentId: string; treatmentName: string;
  operatorId: string; operatorName: string;
  startTime: string; endTime: string; duration: number; price: number;
}
export interface BookingSlot {
  time: string; endTime: string;
  operatorId: string; operatorName: string;
  assegnazioni?: Assegnazione[];
}
export interface GiornoDisponibile { date: string; slots: BookingSlot[] }

export interface BookingResult {
  date: string; startTime: string; endTime: string;
  treatmentName: string; operatorName: string; price: number;
  servizi?: { nome: string; orario: string; operatrice: string; prezzo: number }[];
}

export interface RicercaOrari {
  services: ServizioRichiesto[];
  gender: 'male' | 'female';
  /** 1=Lun … 6=Sab. Vuoto = tutti i giorni. */
  giorniSettimana?: number[];
  from?: string | null;
  to?: string | null;
  giorni?: number;
  /** Lo spostamento: l'appuntamento da non contare fra gli occupati. */
  ignoraAppointmentId?: string | null;
}

/** La copertura pacchetto di un trattamento scelto (nell'ordine della richiesta). */
export type CoperturaPacchetto = { pacchetto: string; rimaste: number } | null;

export interface BookingProvider {
  treatments(): Promise<BookingTreatment[]>;
  operators(): Promise<BookingOperator[]>;
  availability(date: string, treatmentId: string, gender: 'male' | 'female'): Promise<BookingSlot[]>;
  /** Quali dei trattamenti scelti sono coperti da un pacchetto (in ordine). */
  copertura(token: string, treatmentIds: string[]): Promise<CoperturaPacchetto[]>;
  search(req: RicercaOrari): Promise<GiornoDisponibile[]>;
  book(token: string, payload: {
    date: string; startTime: string; gender: 'male' | 'female';
    services?: ServizioRichiesto[];
    treatmentId?: string; operatorId?: string;
  }): Promise<BookingResult>;
}

export class RealBookingService implements BookingProvider {
  async treatments(): Promise<BookingTreatment[]> {
    const r = await apiRequest<{ treatments: BookingTreatment[] }>('/api/booking/treatments');
    return r.treatments;
  }

  async operators(): Promise<BookingOperator[]> {
    const r = await apiRequest<{ operators: BookingOperator[] }>('/api/booking/operators');
    return r.operators || [];
  }

  async availability(date: string, treatmentId: string, gender: 'male' | 'female'): Promise<BookingSlot[]> {
    const r = await apiRequest<{ slots: BookingSlot[] }>(
      `/api/booking/availability?date=${encodeURIComponent(date)}&treatmentId=${encodeURIComponent(treatmentId)}&gender=${gender}`
    );
    return r.slots || [];
  }

  /** "Quando posso venire?": i primi giorni utili, filtrati come vuole la cliente. */
  /** Quali dei trattamenti scelti sono coperti da un pacchetto (in ordine). */
  async copertura(token: string, treatmentIds: string[]): Promise<CoperturaPacchetto[]> {
    if (treatmentIds.length === 0) return [];
    const r = await apiRequest<{ coperture: CoperturaPacchetto[] }>(
      `/api/mobile/pacchetto-copre?treatmentIds=${encodeURIComponent(treatmentIds.join(','))}`,
      { token },
    );
    return r.coperture || [];
  }

  async search(req: RicercaOrari): Promise<GiornoDisponibile[]> {
    const r = await apiRequest<{ giorni: GiornoDisponibile[] }>('/api/booking/search', {
      method: 'POST',
      body: { giorni: 21, ...req },
    });
    return r.giorni || [];
  }

  async book(token: string, payload: {
    date: string; startTime: string; gender: 'male' | 'female';
    services?: ServizioRichiesto[];
    treatmentId?: string; operatorId?: string;
  }): Promise<BookingResult> {
    const r = await apiRequest<{ appointment: BookingResult }>('/api/mobile/book', { method: 'POST', token, body: payload });
    return r.appointment;
  }
}
