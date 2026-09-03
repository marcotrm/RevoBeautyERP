/**
 * Il pagamento misto: un po' in contanti, un po' con la carta.
 *
 * In cassa succede di continuo — «cinquanta in contanti e il resto con la
 * carta» — e per il gestionale e' sempre stata una vendita sola con un
 * metodo solo. Qui i due importi viaggiano dentro il nome del metodo:
 * «Misto (Contanti €50,00, Carta €20,00)». Sembra un trucco, ma tiene
 * insieme le due cose che contano: la vendita resta una riga sola, e la
 * chiusura di cassa sa quanti soldi veri ci sono nel cassetto.
 *
 * I numeri si scrivono all'italiana, con la virgola: il lettore qui sotto
 * toglie i punti delle migliaia, quindi un «50.5» all'inglese diventerebbe
 * 505 euro.
 */

/** Come si scrive un misto, in modo che poi si sappia rileggere. */
export function descriviMisto(contanti: number, carta: number): string {
  const euro = (n: number) => n.toFixed(2).replace('.', ',');
  return `Misto (Contanti €${euro(contanti)}, Carta €${euro(carta)})`;
}

export function eMisto(metodo?: string | null): boolean {
  return /misto/i.test(String(metodo || ''));
}

/**
 * Divide un incasso fra contante, POS e resto.
 *
 * Serve in due posti che non devono mai raccontare cose diverse: la chiusura
 * di cassa (quanti contanti ci sono davvero) e i report degli incassi.
 */
export function quoteMetodo(metodo: string, totale: number): { contanti: number; carta: number; altro: number } {
  const m = String(metodo || '');
  if (eMisto(m)) {
    /*
      La virgola fa da separatore due volte: dentro il numero (50,00) e fra i
      due importi (…€50,00, Carta…). Presa alla lettera, la prima cifra
      diventava "50,00," e non si leggeva piu': la vendita finiva tutta sulla
      carta. Quindi si toglie la punteggiatura rimasta in coda.
    */
    const numeri = [...m.matchAll(/€\s*([\d.,]+)/g)]
      .map(x => Number(x[1].replace(/[.,]+$/, '').replace(/\./g, '').replace(',', '.')) || 0);
    const [contanti = 0, carta = 0] = numeri;
    const somma = contanti + carta;
    // Se il testo non si legge (formati vecchi) si tiene tutto sul contante,
    // come faceva gia' la chiusura di cassa.
    if (somma <= 0) return { contanti: totale, carta: 0, altro: 0 };
    // Riproporziona sui centesimi realmente incassati (resi compresi)
    const k = totale / somma;
    return { contanti: contanti * k, carta: carta * k, altro: 0 };
  }
  if (/contant|cash/i.test(m)) return { contanti: totale, carta: 0, altro: 0 };
  if (/carta|pos|bancomat|credit/i.test(m)) return { contanti: 0, carta: totale, altro: 0 };
  return { contanti: 0, carta: 0, altro: totale };
}

/** Quanto di questo incasso finisce fisicamente nel cassetto. */
export function parteInContanti(metodo: string, totale: number): number {
  return Math.round(quoteMetodo(metodo, totale).contanti * 100) / 100;
}
