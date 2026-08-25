/**
 * Due clienti con lo stesso nome e cognome.
 *
 * Nell'elenco sono due righe identiche: si prende la prima e si va avanti. È
 * successo davvero — l'appuntamento è finito sulla scheda sbagliata, e con lui
 * lo storico, i pacchetti e il messaggio di conferma, che è partito a una
 * persona che non aspettava niente.
 *
 * Il telefono nell'elenco c'era già, ma un numero che non si conosce a memoria
 * non aiuta: quello che serve è essere avvisati che la scelta è ambigua,
 * proprio nel momento in cui si sceglie.
 */

export interface PersonaConNome {
  id: string;
  firstName: string;
  lastName: string;
}

export function chiaveNome(c: { firstName?: string | null; lastName?: string | null }): string {
  return `${c.firstName || ''} ${c.lastName || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** I nomi che nel gestionale compaiono più di una volta. */
export function nomiDoppi(clienti: PersonaConNome[]): Set<string> {
  const conta = new Map<string, number>();
  for (const c of clienti) {
    const k = chiaveNome(c);
    if (!k) continue;
    conta.set(k, (conta.get(k) || 0) + 1);
  }
  const doppi = new Set<string>();
  for (const [k, n] of conta) if (n > 1) doppi.add(k);
  return doppi;
}

/** Le altre schede con lo stesso nome, escludendo quella scelta. */
export function omonimiDi<T extends PersonaConNome>(clienti: T[], clientId: string): T[] {
  const scelta = clienti.find(c => c.id === clientId);
  if (!scelta) return [];
  const k = chiaveNome(scelta);
  return clienti.filter(c => c.id !== clientId && chiaveNome(c) === k);
}
