/**
 * Tab Pacchetti: pacchetti del centro + listino trattamenti,
 * con prezzi già personalizzati per la cliente (donna/uomo).
 * I dati arrivano dal gestionale via /api/mobile/listino.
 */
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { catalogService } from '@/api';
import { Button } from '@/components/ui/Button';
import { useApiData } from '@/hooks/useApiData';
import { colors, fonts, radius, spacing, typography } from '@/theme';
import { formatDuration, formatPrice } from '@/utils/format';

export default function PacchettiScreen() {
  const { data, isLoading, isRefreshing, error, refresh } = useApiData((token) =>
    catalogService.getListino(token)
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Nessun dato disponibile.'}</Text>
          <Button title="Riprova" variant="secondary" onPress={refresh} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <Text style={styles.screenTitle}>Pacchetti</Text>

        {/* ---------- Pacchetti ---------- */}
        {data.packages.map((pkg) => (
          <View key={pkg.id} style={styles.packageCard}>
            <View style={[styles.packageAccent, { backgroundColor: pkg.color }]} />
            <View style={styles.packageBody}>
              <Text style={styles.packageName}>{pkg.name}</Text>
              {!!pkg.treatmentName && (
                <Text style={styles.packageTreatment}>{pkg.treatmentName}</Text>
              )}
              {!!pkg.description && (
                <Text style={styles.packageDescription}>{pkg.description}</Text>
              )}
              <View style={styles.packageFooter}>
                <Text style={styles.packageSessions}>{pkg.totalSessions} sedute</Text>
                <Text style={styles.packagePrice}>{formatPrice(pkg.price)}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* ---------- Listino trattamenti ---------- */}
        <Text style={styles.sectionTitle}>Listino trattamenti</Text>
        {data.gender && (
          <Text style={styles.sectionHint}>
            Prezzi {data.gender === 'F' ? 'donna' : 'uomo'} personalizzati per te
          </Text>
        )}

        {data.categories.map((category) => (
          <View key={category.name} style={styles.category}>
            <Text style={styles.categoryName}>{category.name}</Text>
            {category.treatments.map((treatment) => (
              <View key={treatment.id} style={styles.treatmentRow}>
                <View style={styles.treatmentInfo}>
                  <Text style={styles.treatmentName}>{treatment.name}</Text>
                  <Text style={styles.treatmentDuration}>
                    {formatDuration(treatment.duration)}
                  </Text>
                </View>
                <Text style={styles.treatmentPrice}>{formatPrice(treatment.price)}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  screenTitle: {
    ...typography.title,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  // ----- Pacchetti -----
  packageCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  packageAccent: {
    width: 6,
  },
  packageBody: {
    flex: 1,
    padding: spacing.md,
  },
  packageName: {
    ...typography.subtitle,
    fontSize: 17,
    color: colors.textPrimary,
  },
  packageTreatment: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  packageDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  packageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  packageSessions: {
    ...typography.label,
    color: colors.secondary,
  },
  packagePrice: {
    ...typography.subtitle,
    color: colors.primary,
  },
  // ----- Listino -----
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  category: {
    marginTop: spacing.md,
  },
  categoryName: {
    ...typography.label,
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  treatmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.md,
  },
  treatmentInfo: {
    flex: 1,
  },
  treatmentName: {
    ...typography.body,
    fontSize: 15,
    color: colors.textPrimary,
  },
  treatmentDuration: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  treatmentPrice: {
    ...typography.label,
    fontSize: 15,
    color: colors.primary,
    fontFamily: fonts.w700,
  },
});
