// Conto alla rovescia del trattamento in cabina.
// Il tempo parte dal check-in e dura quanto il trattamento.
// Se l'appuntamento ha più trattamenti, ognuno ha il suo check-in/check-out:
// il timer segue sempre quello in corso.

export interface TimedService {
  treatmentName: string;
  duration: number;
  checkInAt?: string;
  checkOutAt?: string;
}

export interface TimedAppointment {
  id: string;
  clientName: string;
  treatmentName: string;
  operatorName: string;
  duration: number; // minuti
  status: string;
  checkInAt?: string;
  services?: TimedService[];
}

export interface ActiveTimer {
  endAt: number; // timestamp di fine (ms)
  label: string; // trattamento in corso
}

/**
 * Timer unico dell'appuntamento: parte dal check-in e dura quanto TUTTI i
 * trattamenti insieme (a.duration è già la somma). Un solo check-in, un solo
 * check-out: l'estetista non timbra ogni trattamento.
 */
export function activeTimer(a: TimedAppointment): ActiveTimer | null {
  if (a.status !== 'in_cabin' || !a.checkInAt) return null;
  const start = Date.parse(a.checkInAt);
  if (Number.isNaN(start)) return null;
  const services = a.services ?? [];
  const label = services.length > 1
    ? services.map(s => s.treatmentName).join(' + ')
    : a.treatmentName;
  return { endAt: start + Math.max(1, a.duration) * 60_000, label };
}

/** "07:32" se manca tempo, "+01:15" se il trattamento è già finito da un po'. */
export function formatCountdown(msLeft: number): string {
  const over = msLeft < 0;
  const total = Math.floor(Math.abs(msLeft) / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${over ? '+' : ''}${mm}:${ss}`;
}

/** Colore dell'avviso: verde finché c'è tempo, arancione negli ultimi minuti, rosso a tempo scaduto. */
export function countdownTone(msLeft: number): 'ok' | 'soon' | 'over' {
  if (msLeft <= 0) return 'over';
  if (msLeft <= 3 * 60_000) return 'soon';
  return 'ok';
}

/** Trattamenti attualmente in cabina, ordinati da quello che finisce prima. */
export function runningTreatments<T extends TimedAppointment>(appointments: T[]): { appt: T; endAt: number; label: string }[] {
  return appointments
    .map(appt => ({ appt, timer: activeTimer(appt) }))
    .filter((x): x is { appt: T; timer: ActiveTimer } => x.timer !== null)
    .map(({ appt, timer }) => ({ appt, endAt: timer.endAt, label: timer.label }))
    .sort((a, b) => a.endAt - b.endAt);
}
