/**
 * Il Revo Score da vicino: l'anello, i quattro componenti spiegati,
 * l'evoluzione. Misura il percorso, mai la persona.
 */
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { beautyService } from '@/api';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { useApiData } from '@/hooks/useApiData';
import { colors, fonts, radius, spacing, typography } from '@/theme';

export default function ScoreScreen() {
  const { data, isLoading, isRefreshing, refresh } = useApiData((t) => beautyService.score(t));

  if (isLoading || !data) {
    return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.sfondo}
      contentContainerStyle={styles.contenuto}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={styles.testa}>
        <ScoreRing valore={data.totale} misura={132} spessore={9} />
        <Text style={styles.livello}>{data.livello}</Text>
        {data.delta30 !== 0 ? (
          <Text style={[styles.delta, data.delta30 > 0 ? styles.deltaSu : styles.deltaGiu]}>
            {data.delta30 > 0 ? '↑' : '↓'} {Math.abs(data.delta30)} punti negli ultimi 30 giorni
          </Text>
        ) : (
          <Text style={styles.deltaNeutro}>Il tuo punteggio cresce con il tuo percorso</Text>
        )}
      </View>

      {data.componenti.map((c) => (
        <View key={c.codice} style={styles.componente}>
          <View style={styles.compTesta}>
            <Text style={styles.compNome}>{c.nome}</Text>
            <Text style={styles.compPunti}>
              {c.punti}<Text style={styles.compMax}>/{c.massimo}</Text>
            </Text>
          </View>
          <View style={styles.barra}>
            <View style={[styles.barraPieno, { width: `${(c.punti / c.massimo) * 100}%` }]} />
          </View>
          <Text style={styles.compSpiega}>{c.spiegazione}</Text>
        </View>
      ))}

      <Text style={styles.nota}>
        Il Revo Score misura il tuo percorso di bellezza — costanza, cura, partecipazione —
        e sale facendo, mai giudicando. Livelli: Starter · Silver (40) · Gold (60) ·
        Platinum (75) · Diamond (90).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl },
  testa: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xl },
  livello: { fontFamily: fonts.serif600, fontSize: 22, color: colors.primaryDark, letterSpacing: 1 },
  delta: { ...typography.label },
  deltaSu: { color: colors.success },
  deltaGiu: { color: colors.error },
  deltaNeutro: { ...typography.caption, color: colors.textSecondary },
  componente: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  compTesta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  compNome: { ...typography.bodyForte, color: colors.textPrimary },
  compPunti: { fontFamily: fonts.serif600, fontSize: 20, color: colors.primaryDark },
  compMax: { fontSize: 13, color: colors.textSecondary },
  barra: {
    height: 5, borderRadius: radius.full, backgroundColor: colors.border,
    overflow: 'hidden', marginTop: spacing.sm,
  },
  barraPieno: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  compSpiega: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  nota: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.lg, textAlign: 'center' },
});
