/**
 * L'anello del Revo Score: un cerchio che si riempie fino al punteggio.
 * Disegnato in SVG, gira identico su iOS, Android e web.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fonts } from '@/theme';

interface ScoreRingProps {
  /** 0–100 */
  valore: number;
  misura?: number;
  spessore?: number;
  /** Colori per fondi scuri (es. dentro la tessera) */
  suScuro?: boolean;
}

export function ScoreRing({ valore, misura = 76, spessore = 6, suScuro = false }: ScoreRingProps) {
  const raggio = (misura - spessore) / 2;
  const circonferenza = 2 * Math.PI * raggio;
  const pieno = Math.max(0, Math.min(100, valore)) / 100;

  const traccia = suScuro ? 'rgba(255,255,255,0.18)' : colors.border;
  const riempimento = suScuro ? colors.primaryLight : colors.primary;
  const testo = suScuro ? colors.white : colors.textPrimary;

  return (
    <View style={{ width: misura, height: misura }}>
      <Svg width={misura} height={misura}>
        <Circle
          cx={misura / 2} cy={misura / 2} r={raggio}
          stroke={traccia} strokeWidth={spessore} fill="none"
        />
        <Circle
          cx={misura / 2} cy={misura / 2} r={raggio}
          stroke={riempimento} strokeWidth={spessore} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circonferenza}`}
          strokeDashoffset={circonferenza * (1 - pieno)}
          transform={`rotate(-90 ${misura / 2} ${misura / 2})`}
        />
      </Svg>
      <View style={styles.centro}>
        <Text style={[styles.numero, { color: testo, fontSize: misura * 0.3 }]}>{valore}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  numero: { fontFamily: fonts.serif600 },
});
