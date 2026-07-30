// Cliente "al volo": entra e fa il trattamento subito, senza aver preso appuntamento.
//
// Tipico delle lampade: la cliente è già davanti al bancone mentre si scrive
// l'appuntamento in agenda. Mandarle la conferma su WhatsApp ("il tuo
// appuntamento è confermato alle 11:30") è inutile e sembra un errore, quindi
// in questo caso il messaggio non parte.
//
// Niente prisma qui dentro: serve identico al server e nella schermata agenda.

import { todayRome, nowTimeRome } from '@/lib/date';

/** Quanto deve mancare all'orario perché valga la pena confermare via WhatsApp. */
export const WALKIN_WINDOW_MIN = 30;

function minutesOfDay(hhmm: string): number {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Vero se l'appuntamento è di oggi e inizia adesso (o è già iniziato). */
export function isWalkIn(date: string, startTime: string): boolean {
  if (date !== todayRome()) return false;
  return minutesOfDay(startTime) - minutesOfDay(nowTimeRome()) <= WALKIN_WINDOW_MIN;
}
