/**
 * Missioni e badge: gesti veri che diventano punti.
 * L'avanzamento arriva dal server, calcolato dai dati dell'agenda.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';

import { ApiError, Missione, beautyService } from '@/api';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

export default function MissioniScreen() {
  const { token } = useAuth();
  const { data, isLoading, isRefreshing, refresh } = useApiData((t) => beautyService.missioni(t));
  const [riscattando, setRiscattando] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const riscatta = async (m: Missione) => {
    if (!token) return;
    setErrore(null);
    setRiscattando(m.codice);
    try {
      await beautyService.riscatta(token, m.codice);
      refresh();
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Riscatto non riuscito. Riprova.');
    } finally {
      setRiscattando(null);
    }
  };

  if (isLoading || !data) {
    return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.sfondo}
      contentContainerStyle={styles.contenuto}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      {errore ? <Text style={styles.errore}>{errore}</Text> : null}

      {data.missioni.map((m) => (
        <View key={m.codice} style={[styles.card, m.riscattata && styles.cardFatta]}>
          <View style={styles.cardTesta}>
            <Text style={styles.titolo}>{m.titolo}</Text>
            <Text style={styles.premio}>+{m.premioPunti} pt</Text>
          </View>
          <Text style={styles.descrizione}>{m.descrizione}</Text>
          <View style={styles.barra}>
            <View style={[styles.barraPieno, { width: `${(m.avanzamento / m.target) * 100}%` }]} />
          </View>
          <View style={styles.cardPiedi}>
            <Text style={styles.avanzamento}>{m.avanzamento} di {m.target}</Text>
            {m.riscattata ? (
              <Text style={styles.fatta}>✓ Riscattata</Text>
            ) : m.completata ? (
              <Pressable
                style={styles.bottone}
                onPress={() => void riscatta(m)}
                disabled={riscattando === m.codice}
              >
                {riscattando === m.codice ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.bottoneTesto}>Riscatta</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}

      {data.badge.length > 0 ? (
        <>
          <Text style={styles.sezione}>I tuoi badge</Text>
          <View style={styles.bacheca}>
            {data.badge.map((b) => (
              <View key={b.codice} style={styles.badge}>
                <Ionicons name="ribbon" size={22} color={colors.primaryDark} />
                <Text style={styles.badgeNome}>{b.nome}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl },
  errore: { ...typography.label, color: colors.error, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  cardFatta: { opacity: 0.65 },
  cardTesta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  titolo: { ...typography.bodyForte, color: colors.textPrimary },
  premio: { fontFamily: fonts.serif600, fontSize: 16, color: colors.primaryDark },
  descrizione: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  barra: {
    height: 5, borderRadius: radius.full, backgroundColor: colors.border,
    overflow: 'hidden', marginTop: spacing.sm,
  },
  barraPieno: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  cardPiedi: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.sm,
  },
  avanzamento: { ...typography.caption, color: colors.textSecondary },
  fatta: { ...typography.label, color: colors.success },
  bottone: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: 7, minWidth: 84, alignItems: 'center',
  },
  bottoneTesto: { ...typography.labelForte, color: colors.white },
  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  bacheca: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    alignItems: 'center', gap: 4, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minWidth: 100,
  },
  badgeNome: { ...typography.caption, color: colors.textPrimary, textAlign: 'center' },
});
