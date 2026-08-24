/**
 * Tipografia — VALORI PLACEHOLDER.
 * Per ora font di sistema; quando verrà scelto il font del brand
 * (es. un serif elegante per i titoli) basterà aggiornare `fontFamily` qui.
 */
import { TextStyle } from 'react-native';

export const typography = {
  // Titoli grandi (es. intestazione schermata)
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.3,
  } as TextStyle,

  // Sottotitoli / titoli sezione
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
  } as TextStyle,

  // Testo corrente
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  } as TextStyle,

  // Etichette (label input, tab bar)
  label: {
    fontSize: 14,
    fontWeight: '500',
  } as TextStyle,

  // Didascalie / testi minori
  caption: {
    fontSize: 12,
    fontWeight: '400',
  } as TextStyle,
} as const;

export type AppTypography = typeof typography;
