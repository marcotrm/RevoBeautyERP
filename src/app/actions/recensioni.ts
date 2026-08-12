'use server';

/**
 * Le recensioni Google viste dal gestionale.
 *
 * La lettura costa: la Places API fa pagare ogni richiesta che chiede il campo
 * `reviews`. Per questo non si interroga Google a ogni apertura di pagina ma al
 * massimo una volta ogni MINUTI_FRA_LETTURE, più il tasto Aggiorna quando serve
 * davvero.
 */

import {
  aggiornaRecensioni, cercaSchede, collegaScheda, leggiStato, segnaViste,
  recensioniConfigurate, type StatoRecensioni,
} from '@/lib/recensioni';

const MINUTI_FRA_LETTURE = 30;

export async function statoRecensioni(): Promise<StatoRecensioni & { configurato: boolean }> {
  const stato = await leggiStato();
  return { ...stato, configurato: recensioniConfigurate() };
}

/**
 * Stato aggiornato: rilegge da Google solo se l'ultima lettura è vecchia.
 * Con `forza` (tasto Aggiorna) rilegge comunque.
 */
export async function aggiornaSeVecchio(forza = false): Promise<StatoRecensioni & { configurato: boolean }> {
  const stato = await leggiStato();
  if (!recensioniConfigurate() || !stato.placeId) {
    return { ...stato, configurato: recensioniConfigurate() };
  }

  const vecchio = !stato.ultimaLettura
    || Date.now() - new Date(stato.ultimaLettura).getTime() > MINUTI_FRA_LETTURE * 60_000;

  const fresco = forza || vecchio ? await aggiornaRecensioni() : stato;
  return { ...fresco, configurato: true };
}

export async function cercaSchedaGoogle(query: string) {
  return cercaSchede(query);
}

export async function collegaSchedaGoogle(placeId: string, nome?: string, indirizzo?: string) {
  await collegaScheda(placeId, nome, indirizzo);
  // Appena collegata si legge subito: senza, la scheda resterebbe vuota fino
  // al primo aggiornamento e sembrerebbe non aver funzionato.
  const stato = await aggiornaRecensioni();
  return { ...stato, configurato: recensioniConfigurate() };
}

export async function segnaRecensioniViste(): Promise<StatoRecensioni & { configurato: boolean }> {
  const stato = await segnaViste();
  return { ...stato, configurato: recensioniConfigurate() };
}
