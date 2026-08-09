/**
 * Riquadro base dell'app.
 *
 * Tutte le superfici passano da qui: senza un contenitore unico ogni schermata
 * finisce per avere ombre e raggi leggermente diversi, ed è quello che fa
 * sembrare un'app "fatta a pezzi" anche quando i colori sono giusti.
 */
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

export function Card({
  children, onPress, style, tone = 'surface', padded = true,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  /** Colore di fondo: serve a distinguere urgenze, occasioni e premi. */
  tone?: 'surface' | 'primary' | 'urgent' | 'flash' | 'reward' | 'success';
  padded?: boolean;
}) {
  const fondi: Record<string, string> = {
    surface: colors.surface,
    primary: colors.primarySoft,
    urgent: colors.urgentSoft,
    flash: colors.flashSoft,
    reward: colors.rewardSoft,
    success: colors.successSoft,
  };

  const contenuto = (
    <View
      style={[
        styles.card,
        { backgroundColor: fondi[tone] ?? colors.surface },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return contenuto;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.premuto}>
      {contenuto}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    // Ombra appena accennata: su fondo caldo un'ombra marcata sporca
    shadowColor: '#3A2E30',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  padded: { padding: spacing.md },
  premuto: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
