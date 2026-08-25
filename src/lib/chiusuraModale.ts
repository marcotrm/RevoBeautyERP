/**
 * Chiudere una finestra toccando fuori, senza chiuderla mentre si scrive.
 *
 * Il modo solito — `onClick` sullo sfondo, chiudo se il bersaglio è lo sfondo
 * — ha un difetto che sembra un guasto del gestionale: se si seleziona col
 * mouse il contenuto di un campo (il prezzo, per dire) e si rilascia il tasto
 * un pixel oltre il bordo del riquadro, il browser considera quel clic fatto
 * sullo sfondo. La finestra si chiude di colpo e si porta via tutto quello che
 * era stato scritto.
 *
 * Qui si guarda anche dove il tasto è stato PREMUTO: si chiude solo se la
 * pressione e il rilascio sono avvenuti tutti e due sullo sfondo.
 *
 * Il punto di pressione si annota una volta sola, in ascolto sulla finestra:
 * così le decine di riquadri del gestionale non devono aggiungere ognuno il
 * proprio gestore, e basta cambiare la condizione del clic.
 */

let ultimoPremuto: EventTarget | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('mousedown', e => { ultimoPremuto = e.target; }, true);
  // Col dito è lo stesso: si sfiora il campo e si stacca fuori dal riquadro.
  window.addEventListener('touchstart', e => { ultimoPremuto = e.target; }, true);
}

/** Vero se il clic è cominciato ed è finito sullo sfondo del riquadro. */
export function daSfondo(e: { target: EventTarget | null; currentTarget: EventTarget | null }): boolean {
  return e.target === e.currentTarget && ultimoPremuto === e.currentTarget;
}
