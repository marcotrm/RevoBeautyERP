/**
 * L'epilazione va preparata: la zona si rade il giorno prima.
 *
 * E' l'unica istruzione che il centro deve dare PRIMA della seduta, e finora
 * la davano a voce al banco — cioe' quando l'appuntamento lo prendeva qualcuno
 * al banco. Chi prenota da WhatsApp o dall'app non se la sentiva dire da
 * nessuno, e si presentava senza aver fatto niente: la seduta salta, il posto
 * e' bruciato e la cliente ci resta male.
 *
 * Non e' un consiglio medico ed e' bene che resti tale: si dice cosa fare
 * prima di venire, non cosa fa il laser sulla pelle.
 */

/** La riga che si aggiunge in coda al messaggio. */
export const NOTA_RASATURA = 'Ricordati di raderti la zona il giorno prima (niente ceretta né pinzetta)';

/**
 * Vero se in quella seduta c'e' almeno un trattamento di epilazione.
 *
 * Il criterio e' il nome, ed e' affidabile perche' al centro TUTTI i
 * trattamenti di epilazione cominciano con quella parola: «Epilazione Laser
 * Ascelle», «Epilazione Laser Inguine Completo». La ceretta si chiama
 * «Ceretta» e resta fuori, che e' giusto — li' non c'e' niente da radere.
 *
 * Si guardano i trattamenti uno per uno, non il nome messo in fila: una seduta
 * mista si chiama «Manicure + Epilazione Laser Ascelle», e cercare la parola
 * all'inizio dell'intera riga la mancherebbe.
 */
export function seduraDaRadere(a: { treatmentName?: string | null; services?: unknown }): boolean {
  const nomi: string[] = [];
  const sv = Array.isArray(a.services) ? (a.services as Array<{ treatmentName?: unknown }>) : [];
  for (const s of sv) if (s && typeof s.treatmentName === 'string') nomi.push(s.treatmentName);
  if (nomi.length === 0 && a.treatmentName) nomi.push(...String(a.treatmentName).split('+'));
  return nomi.some(n => /^\s*epilazion/i.test(n));
}

/**
 * L'ora, con la nota attaccata quando serve.
 *
 * Va in coda all'ULTIMO segnaposto del template e non dentro al nome del
 * trattamento: i template approvati da Meta dicono «per {{2}} è confermato:
 * {{3}} alle {{4}}», e infilare una frase in {{2}} spezzerebbe la frase a
 * meta'. Dopo {{4}} invece il punto c'e' gia', e la nota diventa la frase
 * dopo — senza dover far riapprovare niente a Meta.
 */
export function oraConNota(ora: string, serve: boolean): string {
  return serve ? `${ora}. ${NOTA_RASATURA}` : ora;
}
