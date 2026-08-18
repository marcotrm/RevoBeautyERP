/**
 * I dati del centro, quelli che finiscono sulla carta.
 *
 * Stanno qui perché oggi sono sparsi: la sede è scritta a mano in Impostazioni,
 * il nome sta nei dati di esempio, l'indirizzo compare nella ricerca di Google
 * Recensioni. Su un foglio che si dà in mano a una cliente devono essere una
 * cosa sola, e si devono poter cambiare in un punto solo.
 *
 * Quando in Impostazioni le "Informazioni Centro" verranno salvate davvero,
 * questi diventano i valori di partenza e basta leggerli da lì.
 */

export interface Centro {
  nome: string;
  indirizzo?: string;
  telefono?: string;
  sito?: string;
}

export const CENTRO: Centro = {
  nome: 'Revobeauty',
  indirizzo: 'Via Caudina 30 · Maddaloni (CE)',
  telefono: '',
  sito: 'revobeauty.it',
};
