/**
 * Formattazione di date e prezzi per la UI (locale italiano).
 */

/** "2026-07-10" → "venerdì 10 luglio" */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

/** 85 → "85 €", 42.5 → "42,50 €" */
export function formatPrice(price: number): string {
  const formatted = Number.isInteger(price)
    ? String(price)
    : price.toFixed(2).replace('.', ',');
  return `${formatted} €`;
}

/** 90 → "1h 30min", 45 → "45 min" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
