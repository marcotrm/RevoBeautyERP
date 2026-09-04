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

import { ApiError, PremioVetrina, TrattamentoVetrina, regaliService } from '@/api';
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
  const [vista, setVista] = useState<'prodotti' | 'trattamenti'>('prodotti');
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const riscatta = async (premioId: string, tipo: 'prodotto' | 'trattamento', nome: string, punti: number) => {
    if (!token || inCorso) return;
    const conferma = await confirmAsync(
      'Riscattare questo regalo?',
      tipo === 'prodotto'
        ? `${nome}\nCosta ${punti} punti: te li togliamo subito e il prodotto ti aspetta al banco.`
        : `${nome}\nCosta ${punti} punti: te li togliamo subito, poi chiamaci o scrivici per prenotare la tua seduta in omaggio.`,
      'Riscatta'
    );
    if (!conferma) return;
    setErrore(null);
    setInCorso(premioId);
    try {
      await regaliService.riscatta(token, premioId, tipo);
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

      {/* ── Prodotti | Trattamenti ── */}
      <View style={styles.divisore}>
        {([['prodotti', 'Prodotti'], ['trattamenti', 'Trattamenti']] as const).map(([id, label]) => {
          const on = vista === id;
          return (
            <Pressable key={id} style={[styles.divisoreTasto, on && styles.divisoreTastoOn]}
              onPress={() => setVista(id)}
              accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text style={[styles.divisoreTxt, on && styles.divisoreTxtOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

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

      {/* ── La vetrina dei prodotti ── */}
      {vista === 'prodotti' && (data.premi.length === 0 ? (
        <View style={styles.vuoto}>
          <Ionicons name="gift-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.vuotoTesto}>
            La vetrina si sta riempiendo:{'\n'}presto qui troverai i regali coi punti.
          </Text>
        </View>
      ) : (
        <View style={styles.griglia}>
          {data.premi.map((p: PremioVetrina) => {
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
                  onPress={() => void riscatta(p.premioId, 'prodotto', `${p.brand ? `${p.brand} ` : ''}${p.nome}`, p.punti)}
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
      ))}

      {/* ── La vetrina dei trattamenti ── */}
      {vista === 'trattamenti' && ((data.trattamenti ?? []).length === 0 ? (
        <View style={styles.vuoto}>
          <Ionicons name="sparkles-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.vuotoTesto}>
            Presto qui troverai anche i trattamenti{'\n'}da regalarti coi punti.
          </Text>
        </View>
      ) : (
        <View>
          {(data.trattamenti ?? []).map((t: TrattamentoVetrina) => {
            const bastano = data.punti >= t.punti;
            return (
              <View key={t.premioId} style={styles.trattRiga}>
                <View style={styles.trattIcona}>
                  <Ionicons name="sparkles" size={18} color={colors.primaryDark} />
                </View>
                <View style={styles.cardTesti}>
                  <Text style={styles.trattNome} numberOfLines={2}>{t.nome}</Text>
                  <Text style={styles.piccolo}>{t.categoria} · {t.durata} min</Text>
                  {!bastano ? (
                    <Text style={styles.mancano}>te ne mancano {t.punti - data.punti}</Text>
                  ) : null}
                </View>
                <Pressable
                  style={[styles.trattBottone, !bastano && styles.premioBottoneSpento]}
                  disabled={!bastano || inCorso === t.premioId}
                  onPress={() => void riscatta(t.premioId, 'trattamento', t.nome, t.punti)}
                >
                  {inCorso === t.premioId ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.premioBottoneTesto}>{t.punti} punti</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}

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
  divisore: {
    flexDirection: 'row', backgroundColor: colors.backgroundAlt,
    borderRadius: radius.full, padding: 3, marginBottom: spacing.md,
  },
  divisoreTasto: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.full },
  divisoreTastoOn: {
    backgroundColor: colors.surface,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  divisoreTxt: { ...typography.label, color: colors.textSecondary },
  divisoreTxtOn: { color: colors.textPrimary, fontFamily: fonts.w700 },
  trattRiga: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  trattIcona: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  trattNome: { fontFamily: fonts.w700, fontSize: 14.5, color: colors.textPrimary },
  trattBottone: {
    alignItems: 'center', backgroundColor: colors.primary,
    borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: spacing.md,
  },
  storicoRiga: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm,
  },
  storicoNome: { ...typography.body, fontSize: 14.5, color: colors.textPrimary },
});
