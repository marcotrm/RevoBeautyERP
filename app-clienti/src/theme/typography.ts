/**
 * Tipografia RevoBeauty.
 *
 * Non sono più valori provvisori: sono i due font del sito. Cormorant
 * Garamond, il serif dei titoli, e Montserrat per tutto il resto. Il font di
 * sistema che c'era prima è il motivo per cui l'app sembrava un modulo da
 * compilare invece che il centro: un serif nei titoli fa metà del lavoro di
 * un'identità, e non costa niente.
 *
 * Regola di React Native da tenere a mente: con un font caricato a mano
 * `fontWeight` non fa nulla — il peso è nel nome della famiglia. Per questo i
 * pesi si scelgono con `fonts.wNNN` e non con fontWeight.
 *
 * Le misure hanno un ritmo: 34 / 26 / 21 nei titoli, 16 / 14 / 12 nei testi.
 * Salti netti, così la gerarchia si vede senza doverla leggere.
 */
import { TextStyle } from 'react-native';

import { fonts } from './fonts';

export const typography = {
  /** Numeri e titoli da copertina: la schermata ne regge uno solo. */
  display: {
    fontFamily: fonts.serif600,
    fontSize: 34,
    lineHeight: 40,
    // I serif larghi respirano meglio stretti: di serie sembrano slegati.
    letterSpacing: -0.4,
  } as TextStyle,

  /** Titoli di schermata ("Ciao Maria", "Il tuo wallet"). */
  title: {
    fontFamily: fonts.serif600,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.2,
  } as TextStyle,

  /** Titoli di sezione e cifre importanti. */
  subtitle: {
    fontFamily: fonts.serif600,
    fontSize: 21,
    lineHeight: 27,
  } as TextStyle,

  /**
   * Occhiello: la righetta piccola, in maiuscolo e larga, sopra a un dato
   * ("IL TUO PROSSIMO APPUNTAMENTO"). È il dettaglio che distingue una
   * scheda curata da un elenco di campi, e costa una riga.
   */
  occhiello: {
    fontFamily: fonts.w600,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  } as TextStyle,

  /** Testo corrente. */
  body: {
    fontFamily: fonts.w400,
    fontSize: 16,
    lineHeight: 24,
  } as TextStyle,

  /** Paragrafi lunghi: il sito usa il peso leggero, e alla lettura si sente. */
  bodyLeggero: {
    fontFamily: fonts.w300,
    fontSize: 16,
    lineHeight: 25,
  } as TextStyle,

  /** Testo corrente che deve pesare (nome del trattamento, totale). */
  bodyForte: {
    fontFamily: fonts.w600,
    fontSize: 16,
    lineHeight: 24,
  } as TextStyle,

  /** Etichette: label dei campi, voci della tab bar, testo dei bottoni. */
  label: {
    fontFamily: fonts.w500,
    fontSize: 14,
    lineHeight: 20,
  } as TextStyle,

  labelForte: {
    fontFamily: fonts.w600,
    fontSize: 14,
    lineHeight: 20,
  } as TextStyle,

  /** Didascalie e testi minori. */
  caption: {
    fontFamily: fonts.w400,
    fontSize: 12,
    lineHeight: 17,
  } as TextStyle,

  captionForte: {
    fontFamily: fonts.w600,
    fontSize: 12,
    lineHeight: 17,
  } as TextStyle,

  /**
   * Cifre che stanno in colonna (punti, euro, saldi).
   * Le tabellari non ballano quando il numero cambia sotto le dita.
   */
  numero: {
    fontFamily: fonts.w600,
    fontSize: 22,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
} as const;

export type AppTypography = typeof typography;
