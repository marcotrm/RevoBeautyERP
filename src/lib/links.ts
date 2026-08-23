/**
 * Link pubblici che il centro manda ai clienti.
 *
 * Stanno qui e non sparsi nei template perché finiscono in più posti (WhatsApp,
 * email, pagina Inaugurazione) e devono restare identici: un link di recensione
 * sbagliato non dà errore, semplicemente non porta recensioni e nessuno se ne
 * accorge per settimane.
 */

/**
 * Il dominio del sito è ripetuto qui invece di arrivare da `lib/inaugurazione`:
 * quel modulo importa `crypto` di Node per i token di conferma, e questo file
 * viene letto anche da componenti client, dove `crypto` non esiste.
 */
function siteBaseUrl(): string {
  return (process.env.SITE_URL || 'https://revobeauty.it').replace(/\/$/, '');
}

function erpBaseUrl(): string {
  return (process.env.ERP_URL || 'https://erp.revobeauty.it').replace(/\/$/, '');
}

/**
 * Indirizzo che finisce nel bottone del template recensione.
 *
 * Non è il link di Google ma un nostro rimando, per due motivi. Il primo: un
 * template approvato da Meta non si modifica a piacere, quindi se il link
 * Google cambiasse (o le due schede venissero unite) bisognerebbe rifare
 * l'approvazione; così basta cambiare una riga qui. Il secondo: passando da
 * noi possiamo contare quanti aprono davvero il modulo.
 */
/**
 * Indirizzo pubblico che apre l'app clienti (o la pagina che invita a
 * scaricarla). Finisce nei link di invito, quindi cambia solo qui.
 */
export function appUrl(): string {
  return (process.env.APP_URL || `${siteBaseUrl()}/app`).replace(/\/$/, '');
}

export function reviewRedirectUrl(): string {
  return `${erpBaseUrl()}/r/recensione`;
}

/**
 * La pagina pubblica del listino: quella del bottone su WhatsApp e del QR al
 * banco. Un indirizzo solo, così il template approvato da Meta non va rifatto
 * se un domani cambia dove sta la pagina.
 */
export function listinoUrl(): string {
  return `${erpBaseUrl()}/listino`;
}

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
 * Link per lasciare una recensione su Google: apre direttamente il modulo con
 * le stelle, senza passaggi intermedi.
 *
 * Punta alla scheda di MADDALONI (Via Caudina, 30), che è la sede di questo
 * gestionale. Attenzione: su Google esiste anche una seconda scheda verificata
 * "Revo Beauty" a Marcianise (SS87), con più recensioni. Sono profili distinti:
 * mandare i clienti di Maddaloni all'altro link significa regalargli le
 * recensioni e lasciare questa sede a zero.
 *
 * La parte `1s0x...:0x...` è l'identificativo del luogo e `!12e1` è ciò che
 * apre la scrittura della recensione. Non ci sono token di sessione, quindi il
 * link non scade e funziona da qualsiasi dispositivo — al contrario di un
 * indirizzo copiato dalla barra durante una ricerca (`sxsrf`, `ved`, `si`).
 */
export const GOOGLE_REVIEW_URL =
  'https://www.google.com/maps/place//data=!4m3!3m2!1s0x133a536521a3c273:0x148c145390b2793d!12e1';

/** Vero se l'indirizzo è un link di recensione stabile e non una ricerca Google. */
export function isStableReviewUrl(url: string): boolean {
  return /^https:\/\/(g\.page\/r\/[^/]+\/review|search\.google\.com\/local\/writereview\?placeid=|www\.google\.com\/maps\/place\/\/data=)/
    .test(url.trim());
}
