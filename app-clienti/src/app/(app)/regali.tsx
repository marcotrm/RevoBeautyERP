/**
 * La vetrina dei regali: prodotti veri dello scaffale, coi punti.
 *
 * Riscatti → i punti scendono subito e nasce un codice da mostrare al
 * banco: il prodotto ti aspetta lì. Niente spedizioni, niente attese —
 * il regalo è a due passi, come tutto il resto del centro.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';

import { ApiError, PremioVetrina, regaliService } from '@/api';
import { FormError } from '@/components/ui/FormError';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';
import { confirmAsync } from '@/utils/confirm';

const STATI: Record<string, { testo: string; colore: string }> = {
  da_ritirare: { testo: 'Ti aspetta al banco', colore: colors.primaryDark },
  consegnato: { testo: 'Ritirato', colore: colors.success },
  annullato: { testo: 'Annullato · punti restituiti', colore: colors.textSecondary },
};

export default function RegaliScreen() {
  const { token } = useAuth();
  const { data, isLoading, isRefreshing, refresh } = useApiData((t) => regaliService.vetrina(t));
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const riscatta = async (p: PremioVetrina) => {
    if (!token || inCorso) return;
    const conferma = await confirmAsync(
      'Riscattare questo regalo?',
      `${p.brand ? `${p.brand} ` : ''}${p.nome}\nCosta ${p.punti} punti: te li togliamo subito e il prodotto ti aspetta al banco.`,
      'Riscatta'
    );
    if (!conferma) return;
    setErrore(null);
    setInCorso(p.premioId);
    try {
      await regaliService.riscatta(token, p.premioId);
      refresh();
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Riscatto non riuscito. Riprova.');
    } finally {
      setInCorso(null);
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
      {/* ── Il saldo, in chiaro ── */}
      <View style={styles.saldo}>
        <Ionicons name="star" size={16} color={colors.primaryLight} />
        <Text style={styles.saldoTesto}>
          Hai <Text style={styles.saldoForte}>{data.punti}</Text> punti da spendere
        </Text>
      </View>

      <FormError message={errore} />

      {/* ── I regali da ritirare ── */}
      {data.riscatti.filter((r) => r.stato === 'da_ritirare').map((r) => (
        <View key={r.id} style={styles.ritiro}>
          <View style={styles.cardTesti}>
            <Text style={styles.ritiroOcchiello}>MOSTRA QUESTO CODICE AL BANCO</Text>
            <Text style={styles.ritiroCodice}>{r.codice}</Text>
            <Text style={styles.piccolo}>{r.nomeProdotto}</Text>
          </View>
          <Ionicons name="gift" size={28} color={colors.primaryDark} />
        </View>
      ))}

      {/* ── La vetrina ── */}
      {data.premi.length === 0 ? (
        <View style={styles.vuoto}>
          <Ionicons name="gift-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.vuotoTesto}>
            La vetrina si sta riempiendo:{'\n'}presto qui troverai i regali coi punti.
          </Text>
        </View>
      ) : (
        <View style={styles.griglia}>
          {data.premi.map((p) => {
            const bastano = data.punti >= p.punti;
            return (
              <View key={p.premioId} style={styles.premio}>
                {p.image ? (
                  <Image source={{ uri: p.image }} style={styles.premioFoto} />
                ) : (
                  <View style={styles.premioFotoVuota}>
                    <Ionicons name="gift-outline" size={26} color={colors.primaryDark} />
                  </View>
                )}
                {p.brand ? <Text style={styles.premioBrand}>{p.brand}</Text> : null}
                <Text style={styles.premioNome} numberOfLines={2}>{p.nome}</Text>
                <Pressable
                  style={[styles.premioBottone, (!bastano || !p.disponibile) && styles.premioBottoneSpento]}
                  disabled={!bastano || !p.disponibile || inCorso === p.premioId}
                  onPress={() => void riscatta(p)}
                >
                  {inCorso === p.premioId ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.premioBottoneTesto}>
                      {!p.disponibile ? 'Esaurito' : `${p.punti} punti`}
                    </Text>
                  )}
                </Pressable>
                {!bastano && p.disponibile ? (
                  <Text style={styles.mancano}>te ne mancano {p.punti - data.punti}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* ── Lo storico ── */}
      {data.riscatti.filter((r) => r.stato !== 'da_ritirare').length > 0 ? (
        <>
          <Text style={styles.sezione}>I tuoi regali</Text>
          {data.riscatti.filter((r) => r.stato !== 'da_ritirare').map((r) => (
            <View key={r.id} style={styles.storicoRiga}>
              <View style={styles.cardTesti}>
                <Text style={styles.storicoNome}>{r.nomeProdotto}</Text>
                <Text style={[styles.piccolo, { color: STATI[r.stato]?.colore }]}>
                  {STATI[r.stato]?.testo ?? r.stato} · {r.punti} punti
                </Text>
              </View>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl },
  saldo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.textPrimary, borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2, marginBottom: spacing.md,
  },
  saldoTesto: { ...typography.body, fontSize: 14.5, color: colors.white },
  saldoForte: { fontFamily: fonts.w800, fontSize: 16, color: colors.primaryLight },
  cardTesti: { flex: 1, minWidth: 0 },
  ritiro: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primarySoft, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md,
  },
  ritiroOcchiello: { ...typography.captionForte, fontSize: 10, letterSpacing: 1.2, color: colors.primaryDark },
  ritiroCodice: { fontFamily: fonts.w800, fontSize: 28, letterSpacing: 4, color: colors.textPrimary, marginVertical: 2 },
  piccolo: { ...typography.caption, color: colors.textSecondary },
  vuoto: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  vuotoTesto: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  griglia: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  premio: {
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center',
  },
  premioFoto: { width: '100%', aspectRatio: 1, borderRadius: radius.md },
  premioFotoVuota: {
    width: '100%', aspectRatio: 1, borderRadius: radius.md,
    backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  premioBrand: { ...typography.captionForte, fontSize: 10, letterSpacing: 1, color: colors.textSecondary, marginTop: spacing.sm, textTransform: 'uppercase' },
  premioNome: { fontFamily: fonts.w700, fontSize: 13.5, color: colors.textPrimary, textAlign: 'center', marginTop: 2, minHeight: 34 },
  premioBottone: {
    alignSelf: 'stretch', alignItems: 'center', marginTop: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.full, paddingVertical: 8,
  },
  premioBottoneSpento: { backgroundColor: colors.disabled },
  premioBottoneTesto: { ...typography.labelForte, fontSize: 13, color: colors.white },
  mancano: { ...typography.caption, fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  storicoRiga: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm,
  },
  storicoNome: { ...typography.body, fontSize: 14.5, color: colors.textPrimary },
});
