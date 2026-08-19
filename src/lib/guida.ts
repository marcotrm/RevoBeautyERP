/**
 * La guida del gestionale: cosa c'è dentro e come si usa.
 *
 * Nasce da una frase precisa — "dobbiamo creare un menu guida con tutte le
 * funzioni" — e da un problema che si vede ogni giorno: metà delle cose che il
 * gestionale fa non le sa nessuno, e quelle che fa DA SOLO (i messaggi
 * automatici, i controlli, le esclusioni) non le sa nessuno per definizione,
 * perché nessuno le preme.
 *
 * Il testo è pensato per chi sta al banco, non per chi ha scritto il software:
 * si dice dove si clicca con le parole che stanno sui bottoni, si dice a cosa
 * serve con l'esempio vero, e si dice la trappola quando c'è.
 *
 * Sta in un file di dati e non dentro la pagina perché la guida si aggiorna
 * ogni volta che si aggiunge una funzione: deve essere una lista da allungare,
 * non un pezzo di interfaccia da rimontare.
 */

export interface VoceGuida {
  /** Come la chiamerebbe chi lavora, non come si chiama nel codice. */
  titolo: string;
  /** Il percorso da fare col mouse: "Agenda → clic sull'appuntamento → Sconto". */
  dove: string;
  /** Il problema vero che risolve, in una o due frasi. */
  aCosaServe: string;
  /** I passi, brevi e in ordine. */
  comeSiFa: string[];
  /** La trappola o il limite: si legge prima di sbagliare, non dopo. */
  attenzione?: string;
  /** Succede da solo, senza che nessuno prema niente. */
  automatico?: boolean;
}

export interface AreaGuida {
  id: string;
  titolo: string;
  /** Una riga che dice di cosa si parla in questa parte. */
  sottotitolo: string;
  voci: VoceGuida[];
}

/** Le parole su cui si cerca: titolo, dove, a cosa serve, passi, avvertenza. */
export function testoCercabile(v: VoceGuida): string {
  return [v.titolo, v.dove, v.aCosaServe, ...v.comeSiFa, v.attenzione || '']
    .join(' ')
    .toLowerCase();
}

export const GUIDA: AreaGuida[] = [];
