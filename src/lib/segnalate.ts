/**
 * Le clienti segnalate a mano, lato server.
 *
 * Vive qui e non dentro la server action perché la usa anche l'automazione che
 * gira di sera senza nessuno davanti allo schermo (src/lib/wa-automations.ts):
 * la richiesta di recensione su Google non deve partire a chi è stata
 * segnalata.
 *
 * Il motivo è pratico, non morale: a chi ha avuto da ridire la recensione non
 * si chiede. Se ci aveva pensato la scrive comunque, ma se non ci aveva
 * pensato è il nostro messaggio a dargliene l'occasione — e una stella su
 * Google resta lì per anni.
 */

import { prisma } from '@/lib/prisma';

/** Il tipo di riga in admin_entries: una sola stringa, scritta in un posto solo. */
export const KIND_SEGNALATA = 'cliente:difficile';

/** Gli id delle clienti segnalate. Elenco corto: si legge tutto. */
export async function idClientiSegnalati(): Promise<Set<string>> {
  const righe = await prisma.adminEntry.findMany({
    where: { kind: KIND_SEGNALATA },
    select: { entityId: true },
  });
  return new Set(righe.map(r => r.entityId));
}

/**
 * Chi la recensione non la deve ricevere, e basta.
 *
 * Diverso dall'essere segnalata: quella e' una cliente con cui e' successo
 * qualcosa, e il segno si vede in agenda. Questa e' una scelta sola —
 * «a lei la recensione non chiedergliela» — e non deve appiccicare addosso a
 * nessuno un'etichetta che significa un'altra cosa.
 *
 * Vale per sempre finche' non la si toglie: se una volta si e' deciso di non
 * chiedergliela, chiedergliela l'anno prossimo e' lo stesso errore.
 */
export const KIND_NIENTE_RECENSIONE = 'cliente:niente-recensione';

export async function idSenzaRecensione(): Promise<Set<string>> {
  const righe = await prisma.adminEntry.findMany({
    where: { kind: KIND_NIENTE_RECENSIONE },
    select: { entityId: true },
  });
  return new Set(righe.map(r => r.entityId));
}

/** Vero se a questa cliente la recensione non si chiede. */
export async function senzaRecensione(clientId: string): Promise<boolean> {
  if (!clientId) return false;
  const r = await prisma.adminEntry.findUnique({ where: { rowId: `${KIND_NIENTE_RECENSIONE}:${clientId}` } });
  return Boolean(r);
}
