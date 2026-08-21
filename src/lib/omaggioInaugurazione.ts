/**
 * I resti dell'inaugurazione.
 *
 * L'omaggio serviva a far entrare gente che non conosceva il centro. Chi nel
 * frattempo ha comprato un pacchetto vero è già cliente: continuare a mostrarle
 * la seduta gratis in ogni appuntamento è confusione al banco, e un invito a
 * regalare una seduta a chi ormai paga.
 *
 * Quindi: se una persona ha almeno un pacchetto comprato, l'omaggio
 * dell'inaugurazione sparisce dal pannello dell'appuntamento. Non si cancella e
 * resta nella sua scheda e in Trattamenti e Pacchetti — se un giorno lo vuole
 * usare davvero, si scala da lì.
 */

/** Riconosce l'omaggio dal nome, che è come lo si è chiamato in tutto il gestionale. */
export function eOmaggioInaugurazione(nome: string | null | undefined): boolean {
  const n = (nome || '').toLowerCase();
  return n.includes('omaggio') && n.includes('inaugurazione');
}

/**
 * Toglie l'omaggio dall'elenco quando fra i pacchetti c'è già qualcosa di
 * comprato. Se la persona ha SOLO l'omaggio resta visibile: è l'unica cosa che
 * ha, ed è esattamente il caso per cui l'omaggio esiste.
 */
export function senzaOmaggioInaugurazione<T extends { packageName: string }>(pacchetti: T[]): T[] {
  const haComprato = pacchetti.some(p => !eOmaggioInaugurazione(p.packageName));
  if (!haComprato) return pacchetti;
  return pacchetti.filter(p => !eOmaggioInaugurazione(p.packageName));
}
