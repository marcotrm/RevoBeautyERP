/** Etichetta breve: livello del Club, stato, conto alla rovescia. */
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

export function Chip({ testo, colore, sfondo }: { testo: string; colore?: string; sfondo?: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: sfondo || colors.primarySoft }]}>
      <Text style={[styles.testo, { color: colore || colors.primaryDark }]}>{testo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  testo: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
});
