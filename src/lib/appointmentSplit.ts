/**
 * Appuntamenti con più operatrici.
 *
 * Un appuntamento resta uno solo (una cliente, un check-in, un conto), ma ogni
 * trattamento può essere assegnato a un'operatrice diversa: l'acrygel a Michela
 * e la pedicure a Veronica. In agenda serve però che ognuna veda occupato il
 * proprio tempo, altrimenti sopra ci finisce un'altra prenotazione.
 *
 * Qui si taglia l'appuntamento in "fette": una per ogni pezzo di tempo di una
 * operatrice, con i soli trattamenti che fa lei.
 *
 * Gli orari si calcolano così:
 *  - i trattamenti senza orario proprio vanno in fila, nell'ordine in cui sono
 *    stati aggiunti, a partire dall'inizio dell'appuntamento — è lo stesso
 *    criterio con cui si calcola la durata totale;
 *  - un trattamento con `startTime` sta all'ora scritta e basta: non entra
 *    nella fila e non sposta gli altri. Serve quando la collega lavora insieme
 *    alla prima (mani e piedi nello stesso momento) o quando può solo più
 *    tardi. Prima si poteva solo accodare, e l'agenda mostrava un orario che
 *    non c'entrava niente con la realtà.
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
  /**
   * L'inizio e la durata dell'appuntamento INTERO.
   *
   * La fetta porta gli orari del proprio pezzo, ma per trascinarla serve
   * sapere dove comincia tutto quanto: spostare una fetta deve spostare
   * l'appuntamento intero, altrimenti i pezzi si staccherebbero fra loro.
   */
  inizioReale?: string;
  durataReale?: number;
  /** Chiave per React quando la stessa operatrice ha più pezzi nello stesso giorno. */
  fettaId?: string;
  /** Vero se questo pezzo ha un orario messo a mano: non si trascina. */
  oraFissata?: boolean;
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

/** Un trattamento con il suo posto nella giornata. */
interface Pezzo { s: AppointmentService; from: number; to: number; fissato: boolean }

/**
 * Dove cade ogni trattamento dell'appuntamento.
 * Quelli senza orario proprio in fila, gli altri all'ora scritta.
 */
export function pezziDi(a: Appointment): Pezzo[] {
  const services = servicesOf(a);
  let cursore = timeToMinutes(a.startTime);
  return services.map(s => {
    const durata = s.duration || 0;
    if (s.startTime) {
      const from = timeToMinutes(s.startTime);
      return { s, from, to: from + durata, fissato: true };
    }
    const from = cursore;
    cursore = from + durata;
    return { s, from, to: cursore, fissato: false };
  });
}

/**
 * La durata dell'appuntamento "vero e proprio": solo i trattamenti in fila.
 *
 * Quelli con l'ora a mano stanno per conto loro e non allungano il blocco
 * principale — se no un trattamento spostato di due ore farebbe diventare
 * l'appuntamento un lenzuolo che copre anche il tempo in mezzo, libero.
 */
export function durataInFila(services: AppointmentService[]): number {
  return services.filter(s => !s.startTime).reduce((somma, s) => somma + (s.duration || 0), 0);
}

/**
 * Le fette di un appuntamento che occupano il tempo di una certa operatrice.
 * Una per ogni pezzo di tempo separato: se fa una cosa alle 9 e una alle 11,
 * in agenda si vedono due blocchi e non uno lungo due ore.
 */
export function slicesForOperator(a: Appointment, operatorId: string): SplitAppointment[] {
  const services = servicesOf(a);
  const pezzi = pezziDi(a);
  const miei = pezzi.filter(p => serviceOperatorId(p.s, a) === operatorId);
  if (miei.length === 0) return [];

  const tuttiSuoi = miei.length === services.length;
  const nessunOrarioAMano = pezzi.every(p => !p.fissato);
  // Caso normale, quello di sempre: un'operatrice sola e nessun orario a mano.
  if (tuttiSuoi && nessunOrarioAMano) return [{ ...a }];

  // Pezzi attaccati fra loro = un blocco solo.
  const ordinati = [...miei].sort((x, y) => x.from - y.from);
  const gruppi: Pezzo[][] = [];
  for (const p of ordinati) {
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && p.from <= ultimo[ultimo.length - 1].to) ultimo.push(p);
    else gruppi.push([p]);
  }

  const totale = services.reduce((somma, s) => somma + (s.price || 0), 0);
  return gruppi.map((gruppo, i) => {
    const from = Math.min(...gruppo.map(p => p.from));
    const to = Math.max(...gruppo.map(p => p.to));
    const svc = gruppo.map(p => p.s);
    return {
      ...a,
      parziale: !tuttiSuoi || gruppi.length > 1,
      totaleAppuntamento: totale,
      inizioReale: a.startTime,
      durataReale: a.duration,
      fettaId: `${a.id}#${operatorId}#${i}`,
      oraFissata: gruppo.some(p => p.fissato),
      startTime: minutesToTime(from),
      endTime: minutesToTime(to),
      duration: to - from,
      services: svc,
      treatmentName: svc.map(s => s.treatmentName).join(' + '),
      price: svc.reduce((somma, s) => somma + (s.price || 0), 0),
    };
  });
}

/** Compatibilità: la prima fetta di quell'operatrice, o null. */
export function sliceForOperator(a: Appointment, operatorId: string): SplitAppointment | null {
  return slicesForOperator(a, operatorId)[0] ?? null;
}

/** Tutti gli appuntamenti che occupano il tempo di una operatrice, già tagliati. */
export function appointmentsForOperator(appointments: Appointment[], operatorId: string): SplitAppointment[] {
  const out: SplitAppointment[] = [];
  for (const a of appointments) out.push(...slicesForOperator(a, operatorId));
  return out;
}
