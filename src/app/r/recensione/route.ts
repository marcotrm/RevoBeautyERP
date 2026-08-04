/**
 * Rimando al modulo recensioni di Google.
 *
 * È l'indirizzo che sta nel bottone del template WhatsApp `richiesta_recensione`.
 * Passare da qui invece di linkare Google direttamente serve a due cose: poter
 * cambiare la destinazione senza rifare l'approvazione Meta del template, e
 * sapere quanti clienti aprono davvero il modulo (il numero delle recensioni
 * scritte, da solo, non distingue "non ha aperto" da "ha aperto e lasciato
 * perdere").
 */

import { prisma } from '@/lib/prisma';
import { GOOGLE_REVIEW_URL } from '@/lib/links';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Un contatore al giorno. `data` è una colonna JSON, quindi l'incremento non
 * può farlo il database: si rilegge e si riscrive. Con i click di un centro
 * estetico due aperture nello stesso istante sono improbabili, e il prezzo di
 * perderne uno è un numero leggermente basso in una statistica.
 */
async function contaClick(): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const rowId = `link:recensione:${day}`;
  const row = await prisma.adminEntry.findUnique({ where: { rowId } });
  const clicks = Number((row?.data as { clicks?: number } | null)?.clicks || 0) + 1;
  await prisma.adminEntry.upsert({
    where: { rowId },
    update: { data: { link: 'recensione', day, clicks } },
    create: {
      rowId, kind: 'link_click', entityId: 'recensione',
      data: { link: 'recensione', day, clicks }, createdAt: new Date().toISOString(),
    },
  });
}

export async function GET() {
  // Il conteggio non deve mai ritardare o impedire il rimando: se la scrittura
  // fallisce il cliente arriva su Google lo stesso, perdiamo solo il numero.
  contaClick().catch(err => console.error('[r/recensione] conteggio fallito', err));

  return Response.redirect(GOOGLE_REVIEW_URL, 302);
}
