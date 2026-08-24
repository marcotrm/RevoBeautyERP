/**
 * Tab Appuntamenti: prossimi appuntamenti dall'agenda del gestionale,
 * con disdetta consentita fino a 24 ore prima (regola applicata dal server),
 * e storico recente.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, Appointment, appointmentsService } from '@/api';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';
import { confirmAsync } from '@/utils/confirm';
import { formatDate, formatPrice } from '@/utils/format';

/** Etichette italiane per gli stati dell'agenda */
const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confermato',
  pending: 'In attesa',
  in_progress: 'In corso',
  in_cabin: 'In corso',
  completed: 'Completato',
  cancelled: 'Disdetto',
  no_show: 'Non presentata',
};

function AppointmentCard({
  appointment,
  onCancel,
  cancelling,
}: {
  appointment: Appointment;
  onCancel?: (a: Appointment) => void;
  cancelling?: boolean;
}) {
  const isCancelled = appointment.status === 'cancelled';

  return (
    <View style={[styles.card, isCancelled && styles.cardCancelled]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>
          {formatDate(appointment.date)} · {appointment.startTime}
        </Text>
        <Text style={[styles.cardStatus, isCancelled && styles.cardStatusCancelled]}>
          {STATUS_LABELS[appointment.status] ?? appointment.status}
        </Text>
      </View>
      <Text style={styles.cardTreatment}>{appointment.treatmentName}</Text>
      <Text style={styles.cardMeta}>
        con {appointment.operatorName} · {formatPrice(appointment.price)}
      </Text>

      {onCancel && appointment.canCancel && (
        <Pressable
          accessibilityRole="button"
          onPress={() => onCancel(appointment)}
          disabled={cancelling}
          style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}
        >
          {cancelling ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Text style={styles.cancelButtonText}>Disdici appuntamento</Text>
          )}
        </Pressable>
      )}
      {onCancel && !appointment.canCancel && !isCancelled && (
        <Text style={styles.cannotCancelHint}>
          Disdetta dall&apos;app non disponibile per questo appuntamento: contatta il centro.
        </Text>
      )}
    </View>
  );
}

export default function AppuntamentiScreen() {
  const { token } = useAuth();
  const { data, isLoading, isRefreshing, error, refresh } = useApiData((t) =>
    appointmentsService.list(t)
  );
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = async (appointment: Appointment) => {
    if (!token) return;

    const confirmed = await confirmAsync(
      'Disdire l\'appuntamento?',
      `${appointment.treatmentName}\n${formatDate(appointment.date)} alle ${appointment.startTime}`,
      'Disdici'
    );
    if (!confirmed) return;

    setCancelError(null);
    setCancellingId(appointment.id);
    try {
      await appointmentsService.cancel(token, appointment.id);
      refresh();
    } catch (err) {
      setCancelError(
        err instanceof ApiError ? err.message : 'Si è verificato un errore. Riprova.'
      );
    } finally {
      setCancellingId(null);
    }
  };

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
          <Text style={styles.emptyText}>{error ?? 'Nessun dato disponibile.'}</Text>
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
        <Text style={styles.screenTitle}>Appuntamenti</Text>

        <FormError message={cancelError} />

        {/* ---------- Prossimi ---------- */}
        {data.upcoming.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Non hai appuntamenti in programma.{'\n'}Chiama il centro per prenotare!
            </Text>
          </View>
        ) : (
          data.upcoming.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onCancel={handleCancel}
              cancelling={cancellingId === appointment.id}
            />
          ))
        )}

        {/* ---------- Storico ---------- */}
        {data.past.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Storico</Text>
            {data.past.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </>
        )}
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
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  screenTitle: {
    ...typography.title,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardCancelled: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  cardDate: {
    ...typography.label,
    color: colors.primaryDark,
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  cardStatus: {
    ...typography.caption,
    color: colors.success,
    fontFamily: fonts.w600,
  },
  cardStatusCancelled: {
    color: colors.error,
  },
  cardTreatment: {
    ...typography.subtitle,
    fontSize: 17,
    color: colors.textPrimary,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cancelButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.error,
    minHeight: 32,
    justifyContent: 'center',
  },
  cancelButtonText: {
    ...typography.caption,
    fontFamily: fonts.w600,
    color: colors.error,
  },
  cannotCancelHint: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});
