/**
 * Le clienti da coccolare, riconosciute dai soldi veri.
 *
 * Serve a chi sta al banco e in cabina: davanti a una che in un anno ha
 * lasciato quattrocento euro in tredici visite non si improvvisa, e nessuno
 * può ricordarsi a memoria chi sono fra duecentosettanta schede.
 *
 * La spesa NON si legge da `Client.totalSpent`: quel campo esiste ma nessuno
 * lo aggiorna, ed è a zero per tutte — usarlo avrebbe premiato la prima riga
 * dell'elenco alfabetico. Si contano gli incassi veri, quelli con lo scontrino.
 *
 * Due condizioni insieme, perché "top" vuol dire fedele e non fortunata:
 *  - stare nel primo 10% per spesa degli ultimi dodici mesi;
 *  - essere venuta almeno tre volte. Un pacchetto comprato una volta sola è un
 *    bell'incasso, non una cliente affezionata, e trattarla come tale
 *    svaluterebbe il segno per quelle che ci sono davvero.
 */

/** Quanto indietro si guarda la spesa. */
export const MESI_STORIA = 12;
/** La fetta migliore per spesa: 0.10 = il primo 10%. */
export const FETTA_TOP = 0.10;
/** Sotto questo numero di visite non è fedeltà, è un caso. */
export const VISITE_MINIME = 3;

export interface ClienteTop {
  /** Nome come scritto sullo scontrino, per mostrarlo. */
  nome: string;
  speso: number;
  visite: number;
  /** 1 = quella che ha speso di più. */
  posizione: number;
}

/** Chiave di confronto fra nomi scritti in modi diversi. */
export function chiaveNome(nome: string): string {
  return (nome || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Dalla spesa per cliente alla lista delle top.
 * `spese` è già filtrata: niente schede interne, niente cliente occasionale.
 */
export function scegliTop(spese: { nome: string; speso: number; visite: number }[]): ClienteTop[] {
  const ordinate = [...spese].sort((a, b) => b.speso - a.speso);
  const quante = Math.max(1, Math.round(ordinate.length * FETTA_TOP));
  return ordinate
    .slice(0, quante)
    .map((x, i) => ({ ...x, posizione: i + 1 }))
    .filter(x => x.visite >= VISITE_MINIME && x.speso > 0);
}

/** "417 € in 13 visite": come si dice a voce, senza decimali. */
export function riassunto(c: ClienteTop): string {
  return `${Math.round(c.speso).toLocaleString('it-IT')} € in ${c.visite} ${c.visite === 1 ? 'visita' : 'visite'}`;
}
