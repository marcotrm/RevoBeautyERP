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
import {
  ultimeAutocritiche, autocriticaDelGiorno, accettaProposta, scartaProposta,
  type Autocritica,
} from '@/lib/autocritica';
import { proponiChiarimenti, type ChiarimentoProposto } from '@/lib/chiarimentiProposti';

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


// ============================================================
// L'autocritica: quello che la segretaria ha sbagliato ieri
// ============================================================

export async function caricaAutocritiche(quante = 10): Promise<Autocritica[]> {
  return ultimeAutocritiche(quante);
}

/**
 * Rilancia l'analisi a mano, senza aspettare le 21:30.
 *
 * Serve la prima volta — per vedere che funziona senza restare un giorno al
 * buio — e serve il giorno che si vuole rileggere una giornata storta senza
 * aspettare domani. Se l'analisi di oggi c'è già, non la rifà: costa e
 * direbbe le stesse cose.
 */
export async function rileggiOggi() {
  const esito = await autocriticaDelGiorno();
  return {
    ok: esito.fatta,
    motivo: esito.motivo,
    analisi: esito.analisi ?? null,
  };
}

/**
 * Accetta una proposta: da qui, e solo da qui, il testo dell'assistente cambia.
 *
 * È il passaggio umano che tiene insieme le due cose: un testo che si riscrive
 * da solo ogni notte dopo un mese non è più quello che qualcuno ha approvato,
 * e dentro le chat analizzate ci sono messaggi scritti da estranei.
 */
export async function accettaPropostaAssistente(id: string) {
  return accettaProposta(id);
}

export async function scartaPropostaAssistente(id: string) {
  return scartaProposta(id);
}

/**
 * Fatti proporre le domande che distinguono i trattamenti.
 *
 * Legge il listino e le conversazioni in cui ha risposto una PERSONA: le
 * domande giuste le hanno già fatte le ragazze, e riprendere le loro parole
 * vale più di qualunque riformulazione. Propone e basta — entrano quando
 * qualcuno le accetta.
 */
export async function proponiDomandeTrattamenti(): Promise<
  { ok: true; proposte: ChiarimentoProposto[]; chatLette: number } | { ok: false; motivo: string }
> {
  return proponiChiarimenti();
}
