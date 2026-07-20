// Data/ora nel fuso orario italiano (Europe/Rome).
// Il server (Railway) gira in UTC: usare la data UTC farebbe "cambiare giorno"
// alle 2 di notte italiane, spostando incassi e report al giorno sbagliato.

// Ritorna la data odierna italiana come "YYYY-MM-DD".
export function todayRome(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

// Ritorna l'ora italiana come "HH:mm".
export function nowTimeRome(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}
