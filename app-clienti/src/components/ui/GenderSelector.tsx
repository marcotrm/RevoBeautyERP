/**
 * Selettore Donna/Uomo per la registrazione.
 * Il valore determina i prezzi personalizzati del listino.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing, typography } from '@/theme';

interface GenderSelectorProps {
  value: 'F' | 'M' | undefined;
  onChange: (value: 'F' | 'M') => void;
  error?: string;
  disabled?: boolean;
}

const OPTIONS: { value: 'F' | 'M'; label: string }[] = [
  { value: 'F', label: 'Donna' },
  { value: 'M', label: 'Uomo' },
];

export function GenderSelector({ value, onChange, error, disabled }: GenderSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Sesso</Text>
      <View style={styles.row}>
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              onPress={() => onChange(option.value)}
              disabled={disabled}
              style={[styles.pill, selected && styles.pillSelected]}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pillText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  pillTextSelected: {
    color: colors.primaryDark,
    fontFamily: fonts.w700,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
