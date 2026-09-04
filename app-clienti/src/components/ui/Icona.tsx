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
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

export type NomeIcona =
  | 'home' | 'chat' | 'perTe' | 'premi' | 'prenota' | 'profilo' | 'freccia'
  // le categorie del listino: stessa griglia e stesso tratto delle schede
  | 'unghie' | 'laser' | 'ceretta' | 'viso' | 'corpo' | 'massaggi'
  | 'trucco' | 'consulenza' | 'capelli' | 'generico'
  | 'chiunque' | 'spunta';

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
    case 'chat':
      // La bolla che parla: il filo diretto col centro.
      return (
        <>
          <Path d="M4.2 4.8h11.6a1.6 1.6 0 0 1 1.6 1.6v5.6a1.6 1.6 0 0 1-1.6 1.6H9.8l-3.2 2.6v-2.6H4.2a1.6 1.6 0 0 1-1.6-1.6V6.4a1.6 1.6 0 0 1 1.6-1.6z" />
          <Path d="M6.6 9.2h6.8" />
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

    // ---------------------------------------------------------- categorie
    case 'unghie':
      // L'unghia vista di fronte, con la lunetta: una mano intera a 20px
      // diventa una macchia.
      return (
        <>
          <Path d="M7.3 16.2V9.1a2.7 2.7 0 0 1 5.4 0v7.1a1.3 1.3 0 0 1-1.3 1.3H8.6a1.3 1.3 0 0 1-1.3-1.3z" />
          <Path d="M7.7 11.3c1.5 1 3.1 1 4.6 0" />
        </>
      );
    case 'laser':
      // Manipolo e fascio che converge sulla pelle: e' quello che si vede
      // stando sul lettino.
      return (
        <>
          <Path d="M5.6 4.6h8.8a1 1 0 0 1 1 1v2.2a1 1 0 0 1-1 1H5.6a1 1 0 0 1-1-1V5.6a1 1 0 0 1 1-1z" />
          <Path d="M8.1 9.2 10 13.4l1.9-4.2" />
          <Path d="M6 16.4h8" />
        </>
      );
    case 'ceretta':
      // La striscia che si stacca: il ricciolo a sinistra e' tutto il disegno.
      return (
        <>
          <Path d="M5 9.2h7.8a2.5 2.5 0 0 1 0 5H5" />
          <Path d="M5 9.2c-1.9 0-1.9 5 0 5" />
          <Path d="M8.2 11.7h3.2" />
        </>
      );
    case 'viso':
      return (
        <>
          <Path d="M10 3.3c3 0 5 2.6 5 6.2 0 4-2.2 7.2-5 7.2s-5-3.2-5-7.2c0-3.6 2-6.2 5-6.2z" />
          <Path d="M8.2 12.3c1.1.8 2.5.8 3.6 0" />
        </>
      );
    case 'corpo':
      // Due curve speculari: la silhouette senza disegnare un corpo.
      return (
        <>
          <Path d="M7.4 3.2c1 2.7 1 4.3 0 5.9-1.2 2-1.2 3.7 0 5.7.9 1.5.9 2.4.4 4" />
          <Path d="M12.6 3.2c-1 2.7-1 4.3 0 5.9 1.2 2 1.2 3.7 0 5.7-.9 1.5-.9 2.4-.4 4" />
        </>
      );
    case 'massaggi':
      // Le pietre calde impilate.
      return (
        <>
          <Ellipse cx="10" cy="5.9" rx="2.7" ry="1.4" />
          <Ellipse cx="10" cy="10" rx="4" ry="1.8" />
          <Ellipse cx="10" cy="14.4" rx="5.1" ry="2.1" />
        </>
      );
    case 'trucco':
      return (
        <>
          <Path d="M7.8 9.5h4.4v6.3a1.6 1.6 0 0 1-1.6 1.6H9.4a1.6 1.6 0 0 1-1.6-1.6z" />
          <Path d="M8.5 9.5V5.5l3-2.2v6.2" />
        </>
      );
    case 'consulenza':
      // Il fumetto: la consulenza e' una chiacchierata, non un modulo.
      return (
        <>
          <Path d="M4.2 6.3a1.7 1.7 0 0 1 1.7-1.7h8.2a1.7 1.7 0 0 1 1.7 1.7v5.4a1.7 1.7 0 0 1-1.7 1.7H9.4l-3.6 3.1v-3.1a1.7 1.7 0 0 1-1.6-1.7z" />
          <Path d="M6.9 7.9h6.2M6.9 10.3h3.9" />
        </>
      );
    case 'capelli':
      return (
        <>
          <Circle cx="6.5" cy="15" r="2" />
          <Circle cx="13.5" cy="15" r="2" />
          <Path d="M7.9 13.5 14.6 3.6" />
          <Path d="M12.1 13.5 5.4 3.6" />
        </>
      );
    case 'generico':
      return (
        <>
          <Circle cx="10" cy="10" r="5.6" />
          <Circle cx="10" cy="10" r="1.4" />
        </>
      );

    // ------------------------------------------------------------ servizio
    case 'chiunque':
      // Due persone: "la prima libera" e' una scelta, non un buco.
      return (
        <>
          <Circle cx="7.6" cy="7.7" r="2.6" />
          <Path d="M2.9 16.1c.5-2.6 2.4-4.1 4.7-4.1s4.2 1.5 4.7 4.1" />
          <Path d="M13.1 5.5a2.6 2.6 0 0 1 0 4.5" />
          <Path d="M14.4 12.5c1.5.6 2.5 1.9 2.8 3.6" />
        </>
      );
    case 'spunta':
      return <Path d="M4.7 10.5 8.4 14.2 15.3 6.4" />;
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
