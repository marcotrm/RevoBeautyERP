'use server';

/**
 * Le clienti segnalate a mano.
 *
 * Il conteggio delle disdette prende quello che il gestionale può misurare, ma
 * metà dei problemi non lascia traccia in nessun campo: chi arriva sempre
 * mezz'ora tardi, chi tratta male le ragazze, chi discute sul prezzo ogni
 * volta. Quello lo sa solo chi sta al banco, e finora se lo diceva a voce —
 * cioè lo sapeva chi c'era quel giorno.
 *
 * Sta in `admin_entries` e non in un campo della scheda perché è una nota
 * interna con un autore e una data, non un dato dell'anagrafica: quando
 * qualcuno segnala una persona, deve restare scritto chi è stato.
 */

import { prisma } from '@/lib/prisma';

const KIND = 'cliente:difficile';

export interface ClienteDifficile {
  clientId: string;
  motivo: string;
  segnalataDa?: string;
  quando: string;
}

export async function clientiDifficili(): Promise<ClienteDifficile[]> {
  const righe = await prisma.adminEntry.findMany({ where: { kind: KIND } });
  return righe.map(r => {
    const d = (r.data || {}) as { motivo?: string; segnalataDa?: string };
    return {
      clientId: r.entityId,
      motivo: d.motivo || '',
      segnalataDa: d.segnalataDa || undefined,
      quando: r.createdAt,
    };
  });
}

/** Una sola per cliente: se c'è già, si riscrive il motivo. */
export async function segnalaCliente(params: {
  clientId: string;
  motivo: string;
  segnalataDa?: string;
}): Promise<{ ok: boolean; errore?: string }> {
  const motivo = params.motivo.trim();
  if (!params.clientId) return { ok: false, errore: 'Manca la cliente' };
  if (!motivo) return { ok: false, errore: 'Scrivi due parole sul perché' };

  const rowId = `${KIND}:${params.clientId}`;
  const data = { motivo, segnalataDa: params.segnalataDa?.trim() || null };
  await prisma.adminEntry.upsert({
    where: { rowId },
    update: { data },
    create: { rowId, kind: KIND, entityId: params.clientId, data, createdAt: new Date().toISOString() },
  });
  return { ok: true };
}

/** Le persone cambiano: la segnalazione si toglie. */
export async function togliSegnalazione(clientId: string): Promise<{ ok: boolean }> {
  await prisma.adminEntry.delete({ where: { rowId: `${KIND}:${clientId}` } }).catch(() => {});
  return { ok: true };
}
