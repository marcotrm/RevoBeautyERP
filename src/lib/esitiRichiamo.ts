/**
 * Com'e' andata la telefonata.
 *
 * Sta in un file suo e non dentro l'azione: un file 'use server' puo'
 * esportare SOLO funzioni async, e un elenco di costanti li' dentro fa
 * esplodere la pagina che lo importa — non alla compilazione, che passa
 * liscia, ma al primo caricamento in produzione. Successo davvero, e per
 * venti minuti l'agenda non si e' aperta.
 */

export type EsitoRichiamo =
  | 'prenotato' | 'non_interessata' | 'non_risponde' | 'ci_pensa'
  | 'numero_sbagliato' | 'gia_cliente' | 'altro';

export const ESITI: { id: EsitoRichiamo; testo: string; chiude: boolean }[] = [
  { id: 'prenotato', testo: 'Ha prenotato', chiude: true },
  { id: 'non_interessata', testo: 'Non interessata', chiude: true },
  { id: 'gia_cliente', testo: 'Era già cliente', chiude: true },
  { id: 'numero_sbagliato', testo: 'Numero sbagliato', chiude: true },
  /*
    Questi due NON chiudono niente: la telefonata va rifatta e il promemoria
    deve tornare. Segnarli come «fatto» sarebbe il modo piu' rapido per
    perdere proprio le persone che stavano quasi per dire di si'.
  */
  { id: 'non_risponde', testo: 'Non risponde', chiude: false },
  { id: 'ci_pensa', testo: 'Ci pensa, richiamare', chiude: false },
];
