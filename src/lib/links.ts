/**
 * Link pubblici che il centro manda ai clienti.
 *
 * Stanno qui e non sparsi nei template perché finiscono in più posti (WhatsApp,
 * email, pagina Inaugurazione) e devono restare identici: un link di recensione
 * sbagliato non dà errore, semplicemente non porta recensioni e nessuno se ne
 * accorge per settimane.
 */

import { siteBaseUrl } from '@/lib/inaugurazione';

/**
 * Da dove arriva chi apre il modulo del coupon.
 *
 * L'inaugurazione è passata: i contatti che arrivano adesso non vengono più dal
 * volantino o dall'evento, ma da un messaggio che abbiamo mandato noi. Tenerli
 * distinti serve a non leggere i numeri della campagna nuova come se fossero
 * ancora quelli dell'apertura.
 */
export type CouponSource = 'post-inaugurazione' | 'inaugurazione';

/** Modulo del coupon sul sito: nome, telefono, trattamento omaggio. */
export function couponFormUrl(source: CouponSource = 'post-inaugurazione'): string {
  return `${siteBaseUrl()}/coupon/?src=${source}`;
}

/**
 * Link per lasciare una recensione su Google.
 *
 * Va preso da Google Business Profile → "Chiedi recensioni" (forma
 * `https://g.page/r/<codice>/review`) e messo in `GOOGLE_REVIEW_URL`. NON vale
 * un indirizzo copiato dalla barra del browser durante una ricerca: quelli
 * contengono token di sessione (`sxsrf`, `ved`, `si`) e le dimensioni della
 * finestra di chi l'ha copiato, e su un altro dispositivo possono scadere.
 */
export function googleReviewUrl(): string | undefined {
  const raw = process.env.GOOGLE_REVIEW_URL?.trim();
  return raw || undefined;
}

/** Vero se l'indirizzo è un link di recensione stabile e non una ricerca Google. */
export function isStableReviewUrl(url: string): boolean {
  return /^https:\/\/(g\.page\/r\/[^/]+\/review|search\.google\.com\/local\/writereview\?placeid=)/.test(url.trim());
}
