'use server';

/**
 * «A lei la recensione non chiedergliela.»
 *
 * Capita, e non serve motivarlo: una cliente che si e' lamentata, una che ha
 * gia' scritto di suo, una che di messaggi ne riceve troppi. Senza un posto
 * dove segnarlo l'unico modo era spegnere l'automazione per tutte, oppure
 * marcarla come "cliente difficile" — che vuol dire un'altra cosa e le
 * appiccica addosso un segno in agenda.
 *
 * Vale per sempre finche' non si toglie: se una volta si e' deciso di non
 * chiedergliela, chiedergliela l'anno prossimo e' lo stesso errore.
 */

import { prisma } from '@/lib/prisma';
import { KIND_NIENTE_RECENSIONE, senzaRecensione } from '@/lib/segnalate';

export async function leggiSenzaRecensione(clientId: string): Promise<boolean> {
  return senzaRecensione(clientId);
}

export async function impostaSenzaRecensione(clientId: string, escludi: boolean): Promise<{ ok: boolean }> {
  if (!clientId) return { ok: false };
  const rowId = `${KIND_NIENTE_RECENSIONE}:${clientId}`;
  if (!escludi) {
    await prisma.adminEntry.deleteMany({ where: { rowId } });
    return { ok: true };
  }
  await prisma.adminEntry.upsert({
    where: { rowId },
    update: { data: { clientId, quando: new Date().toISOString() } },
    create: {
      rowId, kind: KIND_NIENTE_RECENSIONE, entityId: clientId,
      data: { clientId, quando: new Date().toISOString() },
      createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}
