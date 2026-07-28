// Conto alla rovescia del trattamento in cabina.
// Il tempo parte dal check-in e dura quanto il trattamento prenotato.

export interface TimedAppointment {
  id: string;
  clientName: string;
  treatmentName: string;
  operatorName: string;
  duration: number; // minuti
  status: string;
  checkInAt?: string;
}

/** Timestamp (ms) di fine trattamento, o null se non è in cabina. */
export function treatmentEndAt(a: TimedAppointment): number | null {
  if (a.status !== 'in_cabin' || !a.checkInAt) return null;
  const start = Date.parse(a.checkInAt);
  if (Number.isNaN(start)) return null;
  return start + Math.max(1, a.duration) * 60_000;
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
export function runningTreatments<T extends TimedAppointment>(appointments: T[]): { appt: T; endAt: number }[] {
  return appointments
    .map((appt) => ({ appt, endAt: treatmentEndAt(appt) }))
    .filter((x): x is { appt: T; endAt: number } => x.endAt !== null)
    .sort((a, b) => a.endAt - b.endAt);
}
