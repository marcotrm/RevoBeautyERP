/**
 * La scheda Listino: trattamenti e pacchetti, divisi da due tasti.
 *
 * In alto la ricerca, poi i segmenti per categoria come nella prenotazione
 * (unghie, massaggi…): stessa lingua visiva, stesse icone. I prezzi arrivano
 * già personalizzati per la cliente (donna/uomo) da /api/mobile/listino.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { catalogService } from '@/api';
import { Button } from '@/components/ui/Button';
import { Icona } from '@/components/ui/Icona';
import { useApiData } from '@/hooks/useApiData';
import { colors, fonts, radius, spacing, typography } from '@/theme';
import { metaCategoria } from '@/utils/categorie';
import { formatDuration, formatPrice } from '@/utils/format';

export default function ListinoScreen() {
  const { data, isLoading, isRefreshing, error, refresh } = useApiData((token) =>
    catalogService.getListino(token)
  );
  const [vista, setVista] = useState<'trattamenti' | 'pacchetti'>('trattamenti');
  const [cerca, setCerca] = useState('');
  const [categoria, setCategoria] = useState('');

  const q = cerca.trim().toLowerCase();

  /** Le categorie presenti davvero nel listino, nell'ordine del centro. */
  const categorie = useMemo(
    () => (data?.categories ?? []).map((c) => metaCategoria(c.name)),
    [data]
  );

  const trattamentiFiltrati = useMemo(() => {
    if (!data) return [];
    return data.categories
      .filter((c) => !categoria || c.name === categoria)
      .map((c) => ({
        meta: metaCategoria(c.name),
        treatments: c.treatments.filter((t) => !q || t.name.toLowerCase().includes(q)),
      }))
      .filter((c) => c.treatments.length > 0);
  }, [data, categoria, q]);

  const pacchettiFiltrati = useMemo(() => {
    if (!data) return [];
    return data.packages.filter(
      (p) => !q
        || p.name.toLowerCase().includes(q)
        || (p.treatmentName ?? '').toLowerCase().includes(q)
    );
  }, [data, q]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centro}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }
  if (error || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centro}>
          <Text style={styles.erroreTxt}>{error ?? 'Nessun dato disponibile.'}</Text>
          <Button title="Riprova" variant="secondary" onPress={refresh} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.contenuto}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <Text style={styles.titolo}>Listino</Text>
        {data.gender ? (
          <Text style={styles.sottotitolo}>Prezzi {data.gender === 'F' ? 'donna' : 'uomo'}, personalizzati per te</Text>
        ) : null}

        {/* ── La ricerca ── */}
        <View style={styles.cerca}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.cercaCampo}
            value={cerca}
            onChangeText={setCerca}
            placeholder={vista === 'trattamenti' ? 'Cerca un trattamento…' : 'Cerca un pacchetto…'}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            accessibilityLabel="Cerca nel listino"
          />
          {cerca ? (
            <Pressable hitSlop={8} onPress={() => setCerca('')} accessibilityLabel="Pulisci ricerca">
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {/* ── Trattamenti | Pacchetti ── */}
        <View style={styles.divisore}>
          {([['trattamenti', 'Trattamenti'], ['pacchetti', 'Pacchetti']] as const).map(([id, label]) => {
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

        {/* ── I segmenti per categoria, come nella prenotazione ── */}
        {vista === 'trattamenti' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmenti}>
            <Pressable style={[styles.segmento, !categoria && styles.segmentoOn]} onPress={() => setCategoria('')}>
              <Text style={[styles.segmentoTxt, !categoria && styles.segmentoTxtOn]}>Tutti</Text>
            </Pressable>
            {categorie.map((c) => {
              const on = categoria === c.key;
              return (
                <Pressable key={c.key} style={[styles.segmento, on && styles.segmentoOn]}
                  onPress={() => setCategoria(on ? '' : c.key)}>
                  <Icona nome={c.icona} misura={16} colore={on ? colors.primaryDark : colors.textSecondary} />
                  <Text style={[styles.segmentoTxt, on && styles.segmentoTxtOn]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ── Trattamenti ── */}
        {vista === 'trattamenti' && (
          trattamentiFiltrati.length === 0 ? (
            <Text style={styles.vuoto}>
              {q ? `Niente che assomigli a «${cerca.trim()}».` : 'Nessun trattamento in questa categoria.'}
            </Text>
          ) : (
            trattamentiFiltrati.map((c) => (
              <View key={c.meta.key} style={styles.blocco}>
                <View style={styles.bloccoTitolo}>
                  <Icona nome={c.meta.icona} misura={18} colore={colors.primaryDark} />
                  <Text style={styles.bloccoNome}>{c.meta.label}</Text>
                </View>
                {c.treatments.map((t) => (
                  <View key={t.id} style={styles.riga}>
                    <View style={styles.rigaTesti}>
                      <Text style={styles.rigaNome}>{t.name}</Text>
                      <Text style={styles.rigaSotto}>{formatDuration(t.duration)}</Text>
                    </View>
                    <Text style={styles.rigaPrezzo}>{formatPrice(t.price)}</Text>
                  </View>
                ))}
              </View>
            ))
          )
        )}

        {/* ── Pacchetti ── */}
        {vista === 'pacchetti' && (
          pacchettiFiltrati.length === 0 ? (
            <Text style={styles.vuoto}>
              {q ? `Nessun pacchetto che assomigli a «${cerca.trim()}».` : 'Nessun pacchetto disponibile al momento.'}
            </Text>
          ) : (
            pacchettiFiltrati.map((p) => (
              <View key={p.id} style={styles.pacchetto}>
                <View style={[styles.pacchettoBordo, { backgroundColor: p.color }]} />
                <View style={styles.pacchettoCorpo}>
                  <Text style={styles.pacchettoNome}>{p.name}</Text>
                  {p.treatmentName ? <Text style={styles.rigaSotto}>{p.treatmentName}</Text> : null}
                  {p.description ? <Text style={styles.pacchettoDesc}>{p.description}</Text> : null}
                  <View style={styles.pacchettoFondo}>
                    <Text style={styles.pacchettoSedute}>{p.totalSessions} sedute</Text>
                    <Text style={styles.pacchettoPrezzo}>{formatPrice(p.price)}</Text>
                  </View>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  erroreTxt: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  contenuto: { padding: spacing.md, paddingBottom: spacing.xxl },
  titolo: { ...typography.title, color: colors.primary },
  sottotitolo: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  cerca: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 9,
    marginTop: spacing.md,
  },
  cercaCampo: { ...typography.body, fontSize: 14.5, color: colors.textPrimary, flex: 1, padding: 0 },

  divisore: {
    flexDirection: 'row', backgroundColor: colors.backgroundAlt,
    borderRadius: radius.full, padding: 3, marginTop: spacing.sm,
  },
  divisoreTasto: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.full },
  divisoreTastoOn: {
    backgroundColor: colors.surface,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  divisoreTxt: { ...typography.label, color: colors.textSecondary },
  divisoreTxtOn: { color: colors.textPrimary, fontFamily: fonts.w700 },

  segmenti: { gap: spacing.xs, paddingVertical: spacing.sm },
  segmento: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segmentoOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  segmentoTxt: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  segmentoTxtOn: { color: colors.primaryDark, fontFamily: fonts.w700 },

  vuoto: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },

  blocco: { marginTop: spacing.md },
  bloccoTitolo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  bloccoNome: {
    ...typography.label, color: colors.primaryDark,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  riga: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.xs, gap: spacing.md,
  },
  rigaTesti: { flex: 1, minWidth: 0 },
  rigaNome: { ...typography.body, fontSize: 15, color: colors.textPrimary },
  rigaSotto: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  rigaPrezzo: { ...typography.label, fontSize: 15, color: colors.primary, fontFamily: fonts.w700 },

  pacchetto: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm, overflow: 'hidden',
  },
  pacchettoBordo: { width: 6 },
  pacchettoCorpo: { flex: 1, padding: spacing.md },
  pacchettoNome: { ...typography.subtitle, fontSize: 17, color: colors.textPrimary },
  pacchettoDesc: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  pacchettoFondo: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm,
  },
  pacchettoSedute: { ...typography.label, color: colors.textSecondary },
  pacchettoPrezzo: { ...typography.subtitle, color: colors.primary },
});
