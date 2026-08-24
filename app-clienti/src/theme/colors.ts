/**
 * Palette RevoBeauty.
 *
 * Presa dall'identità che il centro già usa nel gestionale e sui materiali
 * stampati: il malva/rosa antico come colore guida, l'oro sabbia per gli
 * accenti preziosi, uno sfondo bianco caldo che non affatica.
 *
 * Le tinte in più rispetto a prima servono a dare gerarchia: senza un colore
 * per "urgente", uno per "occasione" e uno per "premio", ogni riquadro pesa
 * quanto gli altri e la schermata si legge come un elenco.
 */
export const colors = {
  // — Colore guida
  primary: '#B76E79',
  primaryLight: '#E8C4CA',
  primarySoft: '#FBEFF1', // sfondo tenue delle schede in evidenza
  primaryDark: '#8E4E58',

  // — Accento prezioso
  secondary: '#C9A96A',
  secondaryLight: '#EBDDBF',
  secondarySoft: '#FAF4E8',

  // — Neutri
  background: '#FDF9F7',
  backgroundAlt: '#F6F0EE', // fasce alternate, fondo delle barre di avanzamento
  surface: '#FFFFFF',
  textPrimary: '#3A2E30',
  textSecondary: '#8A7B7E',
  textMuted: '#B3A6A8',
  border: '#EADFE0',

  // — Significati: ogni proposta ha un tono, non un colore a caso
  urgent: '#C0392B',      // sta per scadere, si perde qualcosa
  urgentSoft: '#FBECEA',
  flash: '#E67E22',       // occasione a tempo
  flashSoft: '#FDF2E7',
  reward: '#8E5BA6',       // premi e Beauty Box
  rewardSoft: '#F5EFF8',

  // — Stati
  error: '#C0392B',
  success: '#5B8C5A',
  successSoft: '#EEF5EE',
  disabled: '#D8CFD0',

  // — Base
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type AppColors = typeof colors;
