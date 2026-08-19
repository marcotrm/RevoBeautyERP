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
