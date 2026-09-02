'use server';

/**
 * Il testo che parte davvero e quello che il gestionale mostra.
 *
 * Un template approvato vive su Meta: il corpo lo decide l'approvazione, e da
 * qui non si puo' toccare. Quello scritto in `wa-templates.ts` serve
 * all'anteprima e all'archivio della chat — cioe' a quello che chi lavora
 * LEGGE di aver mandato.
 *
 * Finche' i due coincidono nessuno se ne accorge. Quando divergono, in chat si
 * legge una cosa e alla cliente ne arriva un'altra: e' successo con
 * l'indirizzo del centro — nel gestionale c'era il civico, nel template
 * approvato no — e per accorgersene e' servito che una cliente lo facesse
 * notare. Questo controllo lo dice prima.
 */

import { listD360Templates } from '@/lib/whatsapp360';
import { WA_TEMPLATES } from '@/lib/wa-templates';

export interface TemplateDiverso {
  nome: string;
  nostro: string;
  approvato: string;
}

/** Solo lo spazio bianco non conta: il resto e' testo che la cliente legge. */
const pulisci = (t: string) => t.replace(/\s+/g, ' ').trim();

export async function templateDiversi(): Promise<{ ok: boolean; diversi: TemplateDiverso[]; errore?: string }> {
  const elenco = await listD360Templates().catch(() => null);
  if (!elenco?.ok) return { ok: false, diversi: [], errore: 'Non riesco a leggere i template dal provider' };

  const diversi: TemplateDiverso[] = [];
  for (const key of Object.keys(WA_TEMPLATES) as Array<keyof typeof WA_TEMPLATES>) {
    const nostro = WA_TEMPLATES[key];
    const remoto = elenco.templates.find(
      t => t.name === nostro.name && t.status.toUpperCase() === 'APPROVED' && t.language.toLowerCase().startsWith('it'),
    );
    if (!remoto) continue;
    const corpo = remoto.body;
    if (!corpo) continue;
    if (pulisci(corpo) !== pulisci(nostro.body)) {
      diversi.push({ nome: nostro.name, nostro: nostro.body, approvato: corpo });
    }
  }
  return { ok: true, diversi };
}
