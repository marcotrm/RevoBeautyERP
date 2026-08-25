/**
 * Le icone dell'app, disegnate a mano.
 *
 * Quelle di serie (Ionicons) sono le stesse di mezzo mondo: si riconoscono, e
 * un'app che le usa sembra il modello di partenza di qualcun altro. Queste
 * stanno tutte sulla stessa griglia 20x20, tratto sottile e uniforme, costruite
 * su archi e cerchi come l'emblema del marchio — è quello che le fa sembrare
 * una famiglia invece di cinque disegni presi in giro.
 *
 * Il tratto non si ingrossa quando l'icona è attiva: cambia solo il colore, e
 * sotto compare un punto. Un'icona che si riempie di colore in una schermata
 * fatta di spazio bianco urla.
 */
import Svg, { Circle, Path } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

export type NomeIcona = 'home' | 'perTe' | 'premi' | 'prenota' | 'profilo' | 'freccia';

/**
 * Tratto a 1.1 su una griglia di 20: sotto si smaterializza sui display meno
 * fitti, sopra diventa pesante accanto a un serif.
 */
const TRATTO = 1.1;

function Disegno({ nome }: { nome: NomeIcona }) {
  switch (nome) {
    case 'home':
      // Un arco, non una casetta: la porta di un posto dove si entra.
      return (
        <>
          <Path d="M3.6 16.8V9.4c0-.3.1-.6.4-.8L10 4l6 4.6c.3.2.4.5.4.8v7.4" />
          <Path d="M2.6 16.8h14.8" />
          <Path d="M8.2 16.8v-3.4a1.8 1.8 0 0 1 3.6 0v3.4" />
        </>
      );
    case 'perTe':
      // Due scintille di misura diversa: una sola sembra un asterisco.
      return (
        <>
          <Path d="M10 3.4c.6 3.3 1.7 4.4 5 5-3.3.6-4.4 1.7-5 5-.6-3.3-1.7-4.4-5-5 3.3-.6 4.4-1.7 5-5z" />
          <Path d="M15.4 12.8c.3 1.5.8 2 2.2 2.3-1.4.3-1.9.8-2.2 2.3-.3-1.5-.8-2-2.2-2.3 1.4-.3 1.9-.8 2.2-2.3z" />
        </>
      );
    case 'premi':
      return (
        <>
          <Path d="M4.4 9.6h11.2v6.4a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1z" />
          <Path d="M3.2 6.8h13.6v2.8H3.2z" />
          <Path d="M10 6.8v10.2" />
          <Path d="M10 6.8c-1.1-2.6-4.4-2-3.5.7M10 6.8c1.1-2.6 4.4-2 3.5.7" />
        </>
      );
    case 'prenota':
      return (
        <>
          <Path d="M4.4 6.6h11.2a1 1 0 0 1 1 1v8.2a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1V7.6a1 1 0 0 1 1-1z" />
          <Path d="M3.4 10h13.2" />
          <Path d="M6.8 4.2v3M13.2 4.2v3" />
          <Circle cx="10" cy="13.4" r="1.1" />
        </>
      );
    case 'profilo':
      return (
        <>
          <Circle cx="10" cy="7.2" r="3.1" />
          <Path d="M4.5 17c.4-2.9 2.7-4.4 5.5-4.4S15.1 14.1 15.5 17" />
        </>
      );
    case 'freccia':
      return <Path d="M7.5 4.5 13 10l-5.5 5.5" />;
  }
}

export function Icona({ nome, colore = colors.textSecondary, misura = 22 }: {
  nome: NomeIcona;
  colore?: string;
  misura?: number;
}) {
  return (
    <Svg
      width={misura}
      height={misura}
      viewBox="0 0 20 20"
      fill="none"
      stroke={colore}
      strokeWidth={TRATTO}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Disegno nome={nome} />
    </Svg>
  );
}

/** L'icona di una scheda, col punto che segna quella aperta. */
export function IconaScheda({ nome, attiva }: { nome: NomeIcona; attiva: boolean }) {
  return (
    <View style={styles.scheda}>
      <Icona nome={nome} misura={22} colore={attiva ? colors.primaryDark : colors.textMuted} />
      <View style={[styles.punto, attiva && styles.puntoAttivo]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scheda: { alignItems: 'center', gap: 4 },
  punto: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'transparent' },
  puntoAttivo: { backgroundColor: colors.primary },
});
