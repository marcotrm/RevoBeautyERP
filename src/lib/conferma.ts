/**
 * Il gettone di conferma: la prova che l'assistente ha ripetuto alla cliente
 * quello che sta per fare, e che la cliente ha detto di sì.
 *
 * Al telefono l'audio è a 8 kHz e i cognomi si sfasciano: "Cioffi" diventa
 * "Ciotti", "Varone" diventa "Barone". Un appuntamento intestato al nome
 * sbagliato è peggio di un appuntamento non preso, perché nessuno se ne
 * accorge finché la cliente non si presenta.
 *
 * Scriverlo nelle istruzioni non basta: un modello che sta gestendo una
 * conversazione salta i passaggi, soprattutto quando la cliente ha fretta.
 * Quindi la regola è imposta dalla struttura: chi scrive in agenda accetta
 * SOLO un gettone rilasciato dal passo di verifica, e il gettone si porta
 * dentro i dati già confermati. Così fra il "sì, corretto" e la scrittura non
 * può cambiare niente, e prenotare senza aver letto il riepilogo non è una
 * cosa che il modello sceglie di non fare: è una cosa che non può fare.
 *
 * Il gettone è firmato, non cifrato: non contiene niente che non sia già
 * passato per la telefonata, e serve solo a dimostrare che l'abbiamo emesso
 * noi. Vive dieci minuti, la durata di una telefonata lunga.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const VALIDITA_MS = 10 * 60 * 1000;

function segreto(): string | null {
  return process.env.VOICE_API_SECRET || null;
}

function b64url(b: Buffer): string {
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function daB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Confronto a tempo costante.
 *
 * `a === b` su una firma esce al primo byte diverso, e la differenza di tempo
 * fra un tentativo quasi giusto e uno sbagliato si misura: è il modo in cui si
 * indovina una firma un carattere per volta.
 */
export function confrontoSicuro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Emette il gettone per dei dati già ripetuti alla cliente.
 *
 * `validitaMs` serve a chi il gettone lo manda per posta invece che dirlo al
 * telefono: il link del consenso laser parte il giorno prima e deve reggere
 * fino alla seduta, mentre dieci minuti sono la durata di una telefonata.
 */
export function firmaConferma(dati: unknown, validitaMs = VALIDITA_MS): string | null {
  const chiave = segreto();
  if (!chiave) return null;
  const corpo = b64url(Buffer.from(JSON.stringify({ dati, scade: Date.now() + validitaMs })));
  const firma = b64url(createHmac('sha256', chiave).update(corpo).digest());
  return `${corpo}.${firma}`;
}

/**
 * Rilegge un gettone. Torna `null` se è stato manomesso, se è scaduto o se non
 * l'abbiamo emesso noi — in tutti e tre i casi la risposta giusta è la stessa:
 * ripeti alla cliente e fatti confermare di nuovo.
 */
export function leggiConferma<T>(token: unknown): T | null {
  const chiave = segreto();
  if (!chiave || typeof token !== 'string' || !token.includes('.')) return null;

  const [corpo, firma] = token.split('.');
  if (!corpo || !firma) return null;

  const attesa = b64url(createHmac('sha256', chiave).update(corpo).digest());
  if (!confrontoSicuro(firma, attesa)) return null;

  try {
    const { dati, scade } = JSON.parse(daB64url(corpo).toString()) as { dati: T; scade: number };
    if (typeof scade !== 'number' || Date.now() > scade) return null;
    return dati;
  } catch {
    return null;
  }
}
