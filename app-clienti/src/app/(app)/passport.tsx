/**
 * Beauty Passport: l'anno della cliente, come un passaporto dei viaggi
 * — solo che i viaggi sono sedute, aree scoperte, traguardi.
 */
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { beautyService } from '@/api';
import { useApiData } from '@/hooks/useApiData';
import { colors, fonts, radius, spacing, typography } from '@/theme';

export default function PassportScreen() {
  const { data, isLoading, isRefreshing, refresh } = useApiData((t) => beautyService.passport(t));

  if (isLoading || !data) {
    return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;
  }

  const massimo = Math.max(...data.perArea.map((a) => a.volte), 1);
  const numeri = [
    { valore: data.sedute, testo: 'sedute' },
    { valore: data.serviziProvati, testo: 'servizi provati' },
    { valore: data.puntiGuadagnati, testo: 'punti guadagnati' },
    { valore: data.amichePortate, testo: 'amiche portate' },
  ];

  return (
    <ScrollView
      style={styles.sfondo}
      contentContainerStyle={styles.contenuto}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Text style={styles.anno}>IL MIO {data.anno}</Text>
      {data.clienteDal ? (
        <Text style={styles.dal}>Cliente RevoBeauty dal {data.clienteDal.slice(0, 4)}</Text>
      ) : null}

      <View style={styles.griglia}>
        {numeri.map((n) => (
          <View key={n.testo} style={styles.numero}>
            <Text style={styles.numeroValore}>{n.valore}</Text>
            <Text style={styles.numeroTesto}>{n.testo}</Text>
          </View>
        ))}
      </View>

      {data.perArea.length > 0 ? (
        <>
          <Text style={styles.sezione}>Le tue aree</Text>
          {data.perArea.map((a) => (
            <View key={a.area} style={styles.area}>
              <View style={styles.areaTesta}>
                <Text style={styles.areaNome}>{a.area}</Text>
                <Text style={styles.areaVolte}>{a.volte}</Text>
              </View>
              <View style={styles.barra}>
                <View style={[styles.barraPieno, { width: `${(a.volte / massimo) * 100}%` }]} />
              </View>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.vuoto}>
          Il tuo {data.anno} è ancora tutto da scrivere: la prima seduta apre il passaporto.
        </Text>
      )}

      {data.badge.length > 0 ? (
        <>
          <Text style={styles.sezione}>Traguardi</Text>
          <View style={styles.bacheca}>
            {data.badge.map((b) => (
              <View key={b.codice} style={styles.badge}>
                <Ionicons name="ribbon" size={20} color={colors.primaryDark} />
                <Text style={styles.badgeNome}>{b.nome}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {data.percorsiCompletati > 0 ? (
        <Text style={styles.percorsi}>
          🏁 {data.percorsiCompletati} {data.percorsiCompletati === 1 ? 'percorso completato' : 'percorsi completati'}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl },
  anno: { fontFamily: fonts.serif600, fontSize: 30, letterSpacing: 2, color: colors.textPrimary, textAlign: 'center' },
  dal: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },
  griglia: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  numero: {
    flexBasis: '47%', flexGrow: 1, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingVertical: spacing.md,
  },
  numeroValore: { fontFamily: fonts.serif600, fontSize: 30, color: colors.primaryDark },
  numeroTesto: { ...typography.caption, color: colors.textSecondary },
  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  area: { marginBottom: spacing.md },
  areaTesta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  areaNome: { ...typography.label, color: colors.textPrimary, textTransform: 'capitalize' },
  areaVolte: { ...typography.label, color: colors.textSecondary },
  barra: { height: 8, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  barraPieno: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  vuoto: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  bacheca: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    alignItems: 'center', gap: 4, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  badgeNome: { ...typography.caption, color: colors.textPrimary },
  percorsi: { ...typography.body, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg },
});
