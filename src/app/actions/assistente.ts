'use server';

/**
 * Le impostazioni dell'assistente, in mano al centro.
 *
 * Fin qui gli orari di apertura e le regole vivevano nel codice: per cambiare
 * "il lunedì siamo chiusi" serviva un rilascio, quindi non si cambiava mai e
 * l'assistente diceva cose vecchie. Da qui si modificano e valgono subito,
 * sia al telefono sia su WhatsApp.
 */

import { leggiCentro, salvaCentro, orariParlati, type Centro } from '@/lib/centro';
import { costruisciIstruzioni } from '@/lib/istruzioniAssistente';
import { ultimeChiamate, type Chiamata } from '@/lib/voceChiamate';

export async function caricaCentro(): Promise<Centro> {
  return leggiCentro();
}

export async function salvaImpostazioniCentro(parziale: Partial<Centro>) {
  const nuovo = await salvaCentro(parziale);
  return { ok: true as const, centro: nuovo };
}

/** Come suonano gli orari detti a voce: si controlla prima, non dalla cliente. */
export async function anteprimaOrari(orari: Centro['orari']): Promise<string> {
  return orariParlati(orari);
}

/**
 * Il testo esatto che l'assistente riceve.
 *
 * Serve a poterlo leggere: finché resta invisibile, nessuno sa davvero cosa
 * l'assistente è stato autorizzato a dire alle clienti.
 */
export async function anteprimaIstruzioni(canale: 'telefono' | 'whatsapp'): Promise<string> {
  return costruisciIstruzioni(canale);
}

/** Cosa è stato configurato e cosa manca ancora perché il telefono funzioni. */
export async function statoAssistente() {
  const centro = await leggiCentro();
  return {
    segretoImpostato: !!process.env.VOICE_API_SECRET,
    modelloImpostato: !!process.env.ANTHROPIC_API_KEY,
    telefonoCentro: !!centro.telefono,
    orariImpostati: !!centro.orari,
  };
}

export async function caricaChiamate(quante = 50): Promise<Chiamata[]> {
  return ultimeChiamate(quante);
}
