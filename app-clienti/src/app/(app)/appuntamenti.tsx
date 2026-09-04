/**
 * Tab Appuntamenti: prossimi appuntamenti dall'agenda del gestionale,
 * con disdetta consentita fino a 24 ore prima (regola applicata dal server),
 * e storico recente.
 */
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

/**
 * Come prepararsi: le istruzioni del trattamento, dentro la scheda
 * dell'appuntamento. Configurate dal centro, uguali per tutte, col
 * pulsante per scrivere in chat se resta un dubbio.
 */
function PreparazioneBlocco({ prep }: { prep: NonNullable<Appointment['preparazione']> }) {
  const router = useRouter();
  return (
    <View style={styles.prep}>
      <Text style={styles.prepTitolo}>🌿 COME PREPARARSI</Text>
      {prep.comePrepararsi ? <Text style={styles.prepRiga}>{prep.comePrepararsi}</Text> : null}
      {prep.cosaEvitare ? <Text style={styles.prepRiga}>✋ Da evitare: {prep.cosaEvitare}</Text> : null}
      {prep.cosaPortare ? <Text style={styles.prepRiga}>👜 Da portare: {prep.cosaPortare}</Text> : null}
      {prep.avvertenze ? <Text style={styles.prepAvvertenza}>⚠️ {prep.avvertenze}</Text> : null}
      {prep.oreAnticipo > 0 ? (
        <Text style={styles.prepRiga}>⏰ Inizia la preparazione almeno {prep.oreAnticipo} ore prima.</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/contatti')}
        style={({ pressed }) => [styles.prepBottone, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.prepBottoneTesto}>Hai dubbi? Scrivici</Text>
      </Pressable>
    </View>
  );
}

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

      {appointment.preparazione && <PreparazioneBlocco prep={appointment.preparazione} />}

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
  const router = useRouter();
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

        {/* ---------- Lista d'attesa ---------- */}
        <Pressable style={styles.attesaRiga} onPress={() => router.push('/lista-attesa')}>
          <Ionicons name="notifications-outline" size={19} color={colors.primaryDark} />
          <Text style={styles.attesaTesto}>Avvisami se si libera un posto</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
        </Pressable>

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
  attesaRiga: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  attesaTesto: { ...typography.labelForte, color: colors.textPrimary, flex: 1 },
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
  prep: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 4,
  },
  prepTitolo: { ...typography.captionForte, fontSize: 10, letterSpacing: 1.2, color: colors.primaryDark },
  prepRiga: { ...typography.caption, fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  prepAvvertenza: { ...typography.caption, fontSize: 13, color: colors.textPrimary, fontFamily: fonts.w700, lineHeight: 18 },
  prepBottone: { alignSelf: 'flex-start', marginTop: spacing.xs },
  prepBottoneTesto: { ...typography.labelForte, fontSize: 13, color: colors.primaryDark, textDecorationLine: 'underline' },
});
