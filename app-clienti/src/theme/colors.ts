/**
 * Palette RevoBeauty.
 *
 * Non è più inventata: sono gli stessi valori che il sito revobeauty.it
 * dichiara nelle sue variabili CSS (--rb-gold, --rb-bg, --rb-dark…). Chi
 * arriva sull'app dopo aver visto il sito deve riconoscere lo stesso posto,
 * e l'unico modo perché resti vero nel tempo è copiare i numeri, non
 * ricordarseli a occhio.
 *
 * L'identità è oro su avorio, col nero come contrasto forte: niente rosa,
 * che era un colore di comodo messo prima di guardare il sito.
 *
 * Le tinte in più servono a dare gerarchia: senza un colore per "urgente",
 * uno per "occasione" e uno per "premio", ogni riquadro pesa quanto gli
 * altri e la schermata si legge come un elenco. Sono scelte dentro la
 * famiglia calda dell'oro — un rosso acceso, qui, sarebbe uno strappo.
 */
export const colors = {
  // — Colore guida: l'oro del marchio (--rb-gold)
  primary: '#B59B53',
  primaryLight: '#D4C08A',      // --rb-gold-light
  primarySoft: '#F5EFE1',       // fondo tenue delle schede in evidenza
  primaryDark: '#8A7639',       // --rb-gold-dark, per il testo sull'oro chiaro

  // — Contrasto forte: il nero del sito, usato per ciò che deve pesare
  secondary: '#1A1A1A',         // --rb-dark-surface
  secondaryLight: '#3D3A33',
  secondarySoft: '#F0EDE7',

  // — Neutri caldi
  background: '#FFFFFF',        // bianco puro: l'identità è oro, bianco e nero
  backgroundAlt: '#F7F6F2',     // un velo appena percettibile per le fasce alternate
  surface: '#FFFFFF',           // --rb-surface
  textPrimary: '#1A1A1A',       // --rb-text
  textSecondary: '#6B6B6B',     // --rb-text-muted
  textMuted: '#9C978C',
  border: '#E9E5DB',            // caldo ma discreto: su bianco disegna, non sporca

  // — Significati: ogni proposta ha un tono, non un colore a caso
  urgent: '#A6432E',            // terracotta scura: sta per scadere
  urgentSoft: '#F8EBE6',
  flash: '#C2762F',             // rame: occasione a tempo
  flashSoft: '#FBF0E3',
  reward: '#7A4A63',            // prugna: premi e Beauty Box
  rewardSoft: '#F5EDF1',

  // — Stati
  error: '#A6432E',
  success: '#54704F',           // verde salvia, non un verde da semaforo
  successSoft: '#EEF2EC',
  disabled: '#D9D3C6',

  // — Base
  white: '#FFFFFF',
  black: '#0A0A0A',             // --rb-dark
} as const;

export type AppColors = typeof colors;
