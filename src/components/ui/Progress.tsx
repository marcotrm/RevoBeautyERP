/** Barra di avanzamento: percorsi, livelli del Club, sfide. */
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

export function Progress({ percentuale, colore, alta = false }: {
  percentuale: number;
  colore?: string;
  alta?: boolean;
}) {
  const larghezza = Math.max(0, Math.min(100, percentuale));
  return (
    <View style={[styles.fondo, alta && styles.alta]}>
      <View
        style={[
          styles.riempimento,
          alta && styles.alta,
          { width: `${larghezza}%`, backgroundColor: colore || colors.primary },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundAlt,
    overflow: 'hidden',
  },
  alta: { height: 10 },
  riempimento: { height: 6, borderRadius: radius.full },
});
