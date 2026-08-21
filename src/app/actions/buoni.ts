'use server';

/**
 * I buoni sconto della cliente, letti da chi sta al banco.
 *
 * Sono scritti dalle automazioni (per ora solo gli auguri di compleanno) e
 * vanno visti in tre posti: nella scheda della cliente, in agenda quando la si
 * prenota e in cassa, dove si scalano da soli.
 */

import { buonoAttivo, consumaBuono, type BuonoCompleanno } from '@/lib/buonoCompleanno';

export async function buonoDiCliente(clientId: string | null | undefined): Promise<BuonoCompleanno | null> {
  return buonoAttivo(clientId);
}

export async function usaBuono(clientId: string, transazioneId?: string): Promise<{ ok: boolean }> {
  if (!clientId) return { ok: false };
  await consumaBuono(clientId, transazioneId);
  return { ok: true };
}
