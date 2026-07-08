/**
 * Servizio prenotazione: trattamenti, orari liberi e creazione appuntamento.
 * Trattamenti e disponibilità sono pubblici; la prenotazione usa il token
 * (il cliente è già loggato, non deve inserire nome/telefono).
 */
import { apiRequest } from './http';

export interface BookingTreatment {
  id: string; name: string; category: string;
  price: number; duration: number;
  priceMale: number | null; priceFemale: number | null;
  durationMale: number | null; durationFemale: number | null;
}
export interface BookingSlot { time: string; operatorId: string; operatorName: string }
export interface BookingResult {
  date: string; startTime: string; endTime: string;
  treatmentName: string; operatorName: string; price: number;
}

export interface BookingProvider {
  treatments(): Promise<BookingTreatment[]>;
  availability(date: string, treatmentId: string, gender: 'male' | 'female'): Promise<BookingSlot[]>;
  book(token: string, payload: { treatmentId: string; date: string; startTime: string; operatorId?: string; gender: 'male' | 'female' }): Promise<BookingResult>;
}

export class RealBookingService implements BookingProvider {
  async treatments(): Promise<BookingTreatment[]> {
    const r = await apiRequest<{ treatments: BookingTreatment[] }>('/api/booking/treatments');
    return r.treatments;
  }

  async availability(date: string, treatmentId: string, gender: 'male' | 'female'): Promise<BookingSlot[]> {
    const r = await apiRequest<{ slots: BookingSlot[] }>(
      `/api/booking/availability?date=${encodeURIComponent(date)}&treatmentId=${encodeURIComponent(treatmentId)}&gender=${gender}`
    );
    return r.slots || [];
  }

  async book(token: string, payload: { treatmentId: string; date: string; startTime: string; operatorId?: string; gender: 'male' | 'female' }): Promise<BookingResult> {
    const r = await apiRequest<{ appointment: BookingResult }>('/api/mobile/book', { method: 'POST', token, body: payload });
    return r.appointment;
  }
}
