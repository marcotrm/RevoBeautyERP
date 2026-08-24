/**
 * Banner di errore per i form (errori API, non di validazione campo).
 * Non renderizza nulla se `message` è assente.
 */
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FBEAE8', // rosso molto chiaro, placeholder
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  text: {
    ...typography.label,
    color: colors.error,
  },
});
