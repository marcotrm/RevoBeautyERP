/**
 * Palette colori RevoBeauty — VALORI PLACEHOLDER.
 *
 * Palette provvisoria coerente con l'estetica femminile/elegante del brand
 * (farfalla R+B). Da sostituire con i colori ufficiali della brand identity
 * quando disponibili: basta aggiornare i valori qui, tutta l'app li eredita.
 */
export const colors = {
  // — Colore primario: rosa cipria/malva (tinta principale del brand)
  primary: '#B76E79', // placeholder: rosa antico
  primaryLight: '#E8C4CA', // placeholder: rosa chiaro (sfondi attivi, badge)
  primaryDark: '#8E4E58', // placeholder: rosa scuro (pressed state, testi su chiaro)

  // — Colore secondario: oro tenue (accenti eleganti)
  secondary: '#C9A96A', // placeholder: oro sabbia
  secondaryLight: '#EBDDBF', // placeholder: oro chiarissimo

  // — Neutri (sfondi, testi, bordi)
  background: '#FDF9F7', // sfondo app: bianco caldo
  surface: '#FFFFFF', // card e superfici in rilievo
  textPrimary: '#3A2E30', // testo principale: marrone-grigio scuro
  textSecondary: '#8A7B7E', // testo secondario/didascalie
  border: '#EADFE0', // bordi input e divisori

  // — Stati e feedback
  error: '#C0392B', // errori form / API
  success: '#5B8C5A', // conferme
  disabled: '#D8CFD0', // elementi disabilitati

  // — Base
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type AppColors = typeof colors;
