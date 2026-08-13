/**
 * Le schede "di casa": titolari, staff, prove.
 *
 * Il titolare si prenota da solo per provare l'agenda, e quelle righe finiscono
 * nelle classifiche come se fosse la cliente che spende di più. Non sono
 * clienti veri e falsano ogni numero: incasso medio, scontrino, visite.
 *
 * Non si cancellano — hanno appuntamenti e pagamenti attaccati, e servono a
 * fare le prove — si marcano con un'etichetta e le statistiche le saltano.
 * L'etichetta si mette dalla scheda cliente, fra le altre etichette.
 */

export const TAG_INTERNO = 'interno';

/** Vero se la scheda è di casa e non deve entrare nelle statistiche. */
export function isInterno(c: { tags?: string[] | null }): boolean {
  return (c.tags || []).some(t => String(t).trim().toLowerCase() === TAG_INTERNO);
}

/** Le sole schede vere, senza quelle di casa. */
export function soloClientiVeri<T extends { tags?: string[] | null }>(clients: T[]): T[] {
  return clients.filter(c => !isInterno(c));
}
