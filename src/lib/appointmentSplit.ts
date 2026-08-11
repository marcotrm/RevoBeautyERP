/**
 * Appuntamenti con più operatrici.
 *
 * Un appuntamento resta uno solo (una cliente, un check-in, un conto), ma ogni
 * trattamento può essere assegnato a un'operatrice diversa: l'acrygel a Michela
 * e la pedicure a Veronica. In agenda serve però che ognuna veda occupato il
 * proprio tempo, altrimenti sopra ci finisce un'altra prenotazione.
 *
 * Qui si taglia l'appuntamento in "fette": una per operatrice coinvolta, con
 * l'orario dei soli trattamenti che fa lei. I trattamenti si considerano in
 * fila, nell'ordine in cui sono stati aggiunti — è lo stesso criterio con cui
 * si calcola la durata totale.
 */

import type { Appointment, AppointmentService } from '@/types';
import { timeToMinutes, minutesToTime } from '@/lib/helpers';

/** Fetta di appuntamento: un normale appuntamento, ma con i soli trattamenti di una operatrice. */
export interface SplitAppointment extends Appointment {
  /** Vero quando altri trattamenti dello stesso appuntamento sono di un'altra operatrice. */
  parziale?: boolean;
  /**
   * Il conto INTERO dell'appuntamento, non solo di questa fetta. Senza, in
   * agenda si legge "45 €" e si pensa sia tutto da incassare, mentre la
   * cliente ne deve 80 (il resto lo fa un'altra operatrice).
   */
  totaleAppuntamento?: number;
}

/** I trattamenti dell'appuntamento, anche per i vecchi che ne hanno uno solo. */
export function servicesOf(a: Appointment): AppointmentService[] {
  if (a.services && a.services.length > 0) return a.services;
  return [{
    treatmentId: a.treatmentId,
    treatmentName: a.treatmentName,
    treatmentCategory: a.treatmentCategory,
    duration: a.duration,
    price: a.price,
  }];
}

/** Chi esegue davvero un trattamento: quella indicata sopra, o l'operatrice dell'appuntamento. */
export function serviceOperatorId(s: AppointmentService, a: Appointment): string {
  return s.operatorId || a.operatorId;
}

/** Vero se l'appuntamento coinvolge più di un'operatrice. */
export function hasMultipleOperators(a: Appointment): boolean {
  const ids = new Set(servicesOf(a).map(s => serviceOperatorId(s, a)));
  return ids.size > 1;
}

/**
 * La fetta di un appuntamento che riguarda una certa operatrice, con orari
 * ricalcolati. Torna null se quell'operatrice non c'entra niente.
 */
export function sliceForOperator(a: Appointment, operatorId: string): SplitAppointment | null {
  const services = servicesOf(a);
  const start = timeToMinutes(a.startTime);

  let cursor = start;
  const mie: { s: AppointmentService; from: number; to: number }[] = [];
  for (const s of services) {
    const from = cursor;
    const to = cursor + (s.duration || 0);
    if (serviceOperatorId(s, a) === operatorId) mie.push({ s, from, to });
    cursor = to;
  }
  if (mie.length === 0) return null;

  const parziale = mie.length !== services.length;
  if (!parziale) return { ...a };

  const from = Math.min(...mie.map(x => x.from));
  const to = Math.max(...mie.map(x => x.to));
  const svc = mie.map(x => x.s);

  return {
    ...a,
    parziale: true,
    totaleAppuntamento: services.reduce((sum, s) => sum + (s.price || 0), 0),
    startTime: minutesToTime(from),
    endTime: minutesToTime(to),
    duration: to - from,
    services: svc,
    treatmentName: svc.map(s => s.treatmentName).join(' + '),
    price: svc.reduce((sum, s) => sum + (s.price || 0), 0),
  };
}

/** Tutti gli appuntamenti che occupano il tempo di una operatrice, già tagliati. */
export function appointmentsForOperator(appointments: Appointment[], operatorId: string): SplitAppointment[] {
  const out: SplitAppointment[] = [];
  for (const a of appointments) {
    const slice = sliceForOperator(a, operatorId);
    if (slice) out.push(slice);
  }
  return out;
}
