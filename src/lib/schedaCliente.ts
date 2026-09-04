/**
 * Cosa vuol dire "scheda cliente completa".
 *
 * Al telefono si prendono solo nome, cognome e numero: giusto così, la
 * prenotazione deve essere veloce. Ma la scheda va finita quando la cliente
 * È in negozio: per questo il check-in si ferma se mancano i dati chiave.
 * L'email resta FACOLTATIVA (molti non la ricordano): si chiede, non blocca.
 *
 * Questo criterio è unico per tutto il gestionale: il badge "Dati incompleti"
 * nella lista clienti e il blocco al check-in devono dire la stessa cosa.
 */

import type { Client } from '@/types';
import { problemaDataNascita } from '@/lib/dataNascita';

/** I campi che mancano per considerare completa la scheda, già in italiano. */
export function campiMancanti(c: Pick<Client, 'birthDate' | 'gender' | 'address' | 'city'>): string[] {
  const out: string[] = [];
  /*
    Una data impossibile e' peggio di una casella vuota: la casella vuota si
    vede, il 1198 sembra un dato. Quindi conta come mancante — e la prima
    volta che quella cliente torna, il check-in la fa sistemare a chi ce l'ha
    davanti e puo' chiederle l'anno vero.
  */
  if (!c.birthDate || problemaDataNascita(c.birthDate)) out.push('data di nascita');
  if (!c.gender) out.push('sesso');
  if (!c.address?.trim()) out.push('indirizzo');
  if (!c.city?.trim()) out.push('città');
  return out;
}

export function schedaCompleta(c: Pick<Client, 'birthDate' | 'gender' | 'address' | 'city'>): boolean {
  return campiMancanti(c).length === 0;
}
