/**
 * Il giorno in cui il centro ha aperto davvero.
 *
 * Prima di quella data il gestionale è stato usato per provarlo: appuntamenti
 * finti per vedere l'agenda, incassi da un centesimo per collaudare lo
 * scontrino, un pacchetto da 800 € comprato per capire come si scala, perfino
 * un rimborso di prova. Sono righe vere nel database e sbagliate nella realtà:
 * dentro alle statistiche diventano fatturato, clienti e trattamenti che non
 * sono mai esistiti — e ci si mette un attimo a fidarsi di un numero gonfiato.
 *
 * Si tagliano a monte, con una data sola: tutto quello che sta prima
 * dell'apertura non entra nei conti. Non si cancella niente — resta lì, e se
 * un giorno la data cambia (o si scopre che quel giorno si lavorava davvero)
 * basta cambiarla qui.
 */

import { prisma } from '@/lib/prisma';

/** Il giorno dell'inaugurazione: prima di questo il centro era chiuso. */
export const APERTURA_PREDEFINITA = '2026-07-27';

const ROW_ID = 'config:apertura';

let cache: { al: number; data: string } | null = null;

export async function dataApertura(): Promise<string> {
  if (cache && Date.now() - cache.al < 300_000) return cache.data;
  try {
    const row = await prisma.adminEntry.findUnique({ where: { rowId: ROW_ID } });
    const d = (row?.data as { data?: string } | null)?.data;
    const scelta = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : APERTURA_PREDEFINITA;
    cache = { al: Date.now(), data: scelta };
    return scelta;
  } catch {
    return APERTURA_PREDEFINITA;
  }
}

/** Cambia la data di apertura (e quindi cosa entra nelle statistiche). */
export async function salvaDataApertura(data: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
  cache = null;
  await prisma.adminEntry.upsert({
    where: { rowId: ROW_ID },
    update: { data: { data } as unknown as object },
    create: {
      rowId: ROW_ID, kind: 'config', entityId: 'apertura',
      data: { data } as unknown as object, createdAt: new Date().toISOString(),
    },
  });
}
