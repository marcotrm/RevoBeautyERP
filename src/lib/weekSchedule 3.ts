// Risoluzione del turno effettivo di un'operatrice in una certa data,
// dando priorità al turno della SETTIMANA specifica; se quella settimana non è
// stata pianificata, si usa come ripiego il turno ricorrente della scheda
// operatrice (così le settimane non ancora compilate non bloccano le prenotazioni).

import type { WeekScheduleMap, WeekDaySchedule } from '@/app/actions/weekShifts';

/** Lunedì della settimana di `date`, in formato YYYY-MM-DD (ora locale). */
export function mondayISO(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Dom..6=Sab
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

interface WithSchedule { id: string; schedule?: Record<number, WeekDaySchedule | undefined> | undefined; }

/**
 * Turno del giorno per un'operatrice, considerando la settimana specifica.
 * Ritorna undefined se non c'è nessun turno impostato (né settimana né template):
 * in quel caso chi chiama assume "disponibile tutto il giorno".
 */
export function resolveDaySchedule(
  weekMap: Record<string, WeekScheduleMap> | undefined,
  op: WithSchedule,
  date: Date,
): WeekDaySchedule | undefined {
  const dow = date.getDay(); // 1..6 (0=Dom gestito a parte da chi chiama)
  const forWeek = weekMap?.[op.id];
  if (forWeek && forWeek[dow] !== undefined) return forWeek[dow];
  // Ripiego: turno ricorrente della scheda operatrice (settimana non pianificata)
  return op.schedule?.[dow];
}
