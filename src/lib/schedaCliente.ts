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

/** I campi che mancano per considerare completa la scheda, già in italiano. */
export function campiMancanti(c: Pick<Client, 'birthDate' | 'gender' | 'address' | 'city'>): string[] {
  const out: string[] = [];
  if (!c.birthDate) out.push('data di nascita');
  if (!c.gender) out.push('sesso');
  if (!c.address?.trim()) out.push('indirizzo');
  if (!c.city?.trim()) out.push('città');
  return out;
}

export function schedaCompleta(c: Pick<Client, 'birthDate' | 'gender' | 'address' | 'city'>): boolean {
  return campiMancanti(c).length === 0;
}
