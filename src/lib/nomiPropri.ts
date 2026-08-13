/**
 * Nomi e cognomi scritti come si scrivono.
 *
 * Al banco si digita di fretta e in minuscolo: in anagrafica finiscono
 * "giuseppe suppa" accanto a "Maria Abbate", e poi le liste, i messaggi
 * WhatsApp e gli scontrini portano in giro quel minuscolo. Qui la maiuscola
 * si mette da sola mentre si scrive.
 *
 * Regole, tutte imparate da come si scrivono davvero i cognomi italiani:
 *  - maiuscola a ogni parola: "de lucia" → "De Lucia";
 *  - anche dopo l'apostrofo: "d'angelo" → "D'Angelo", "dell'anno" → "Dell'Anno";
 *  - anche dopo il trattino: "anna-maria" → "Anna-Maria";
 *  - il resto NON si tocca: chi scrive "McDonald" o "DeLuca" se li tiene, e
 *    chi digita tutto maiuscolo lo vede corretto ("PASCARELLA" → "Pascarella")
 *    solo perché una parola tutta maiuscola è quasi sempre un caps lock
 *    dimenticato.
 */

/** Vero se la parola è tutta maiuscola: quasi sempre un caps lock dimenticato. */
function tuttaMaiuscola(parola: string): boolean {
  const lettere = parola.replace(/[^\p{L}]/gu, '');
  return lettere.length > 1 && lettere === lettere.toUpperCase();
}

/**
 * Mette la maiuscola iniziale a ogni parola, lasciando stare il resto.
 * Si applica mentre si digita: non cambia la lunghezza del testo, quindi il
 * cursore resta dov'è.
 */
export function maiuscoleNome(testo: string): string {
  if (!testo) return testo;
  return testo.replace(/[\p{L}][\p{L}'’-]*/gu, parola => {
    const base = tuttaMaiuscola(parola) ? parola.toLowerCase() : parola;
    // Maiuscola dopo inizio parola, apostrofo e trattino
    return base.replace(/(^|['’-])(\p{L})/gu, (_, prima, lettera) => prima + lettera.toUpperCase());
  });
}
