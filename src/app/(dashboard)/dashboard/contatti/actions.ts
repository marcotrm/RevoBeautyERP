'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { contattaLead, STATI_LEAD, type StatoLead } from '@/lib/lead';

const PAGINA = '/dashboard/contatti';

export async function cambiaStatoContatto(id: string, stato: string) {
  if (!id || !(stato in STATI_LEAD)) return { ok: false, errore: 'Stato non valido' };
  await prisma.lead.update({
    where: { id },
    data: { status: stato as StatoLead, updatedAt: new Date().toISOString() },
  });
  revalidatePath(PAGINA);
  return { ok: true };
}

/**
 * Manda a mano il primo messaggio.
 *
 * Serve quando la segretaria era spenta al momento della richiesta, o quando
 * l'invio automatico è fallito: il contatto è lì da giorni e nessuno gli ha
 * scritto. Il fermo contro i doppioni sta dentro `contattaLead`, non qui.
 */
export async function mandaPrimoMessaggio(id: string) {
  const esito = await contattaLead(id);
  revalidatePath(PAGINA);
  return esito.inviato ? { ok: true } : { ok: false, errore: esito.motivo || 'invio fallito' };
}

export async function eliminaContatto(id: string) {
  if (!id) return { ok: false };
  await prisma.lead.delete({ where: { id } }).catch(() => {});
  revalidatePath(PAGINA);
  return { ok: true };
}
