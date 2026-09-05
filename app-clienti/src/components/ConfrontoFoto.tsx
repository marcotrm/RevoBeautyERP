/**
 * Il confronto prima/dopo col cursore: due foto sovrapposte, si trascina
 * la linea e la foto "dopo" si svela. Niente giudizi, niente punteggi:
 * solo gli occhi della cliente su due momenti del suo percorso.
 */
import { useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

interface Props {
  prima: { immagine: string; scattataIl: string };
  dopo: { immagine: string; scattataIl: string };
  /** Larghezza disponibile in punti (quadrato). */
  lato: number;
}

export function ConfrontoFoto({ prima, dopo, lato }: Props) {
  const [quota, setQuota] = useState(0.5);
  const quotaRef = useRef(0.5);

  const muovi = (x: number) => {
    const q = Math.max(0.05, Math.min(0.95, x / lato));
    quotaRef.current = q;
    setQuota(q);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => muovi(e.nativeEvent.locationX),
      onPanResponderMove: (e) => muovi(e.nativeEvent.locationX),
    })
  ).current;

  return (
    <View style={{ width: lato }}>
      <View
        style={[styles.cornice, { width: lato, height: lato }]}
        {...pan.panHandlers}
        accessibilityLabel={`Confronto: prima del ${prima.scattataIl}, dopo del ${dopo.scattataIl}. Trascina per confrontare.`}
      >
        {/* Sotto: il "dopo", intero. */}
        <Image source={{ uri: dopo.immagine }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {/* Sopra: il "prima", ritagliato fino al cursore. */}
        <View style={[styles.ritaglio, { width: lato * quota }]}>
          <Image source={{ uri: prima.immagine }} style={{ width: lato, height: lato }} resizeMode="cover" />
        </View>
        {/* La linea col pomello. */}
        <View style={[styles.linea, { left: lato * quota - 1 }]} />
        <View style={[styles.pomello, { left: lato * quota - 14, top: lato / 2 - 14 }]}>
          <Text style={styles.pomelloTesto}>⇔</Text>
        </View>
        <Text style={[styles.tag, styles.tagPrima]}>PRIMA · {prima.scattataIl}</Text>
        <Text style={[styles.tag, styles.tagDopo]}>DOPO · {dopo.scattataIl}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cornice: {
    borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border,
  },
  ritaglio: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  linea: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.white },
  pomello: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  pomelloTesto: { fontFamily: fonts.w700, fontSize: 13, color: colors.textPrimary },
  tag: {
    position: 'absolute', bottom: spacing.xs, fontFamily: fonts.w700, fontSize: 10,
    letterSpacing: 0.5, color: colors.white, backgroundColor: 'rgba(26,26,26,0.65)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden',
  },
  tagPrima: { left: spacing.xs },
  tagDopo: { right: spacing.xs },
});
