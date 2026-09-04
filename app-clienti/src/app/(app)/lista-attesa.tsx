/**
 * Lista d'attesa intelligente: "se si libera un posto così, avvisami".
 *
 * Tre scelte semplici — trattamento, giorni, fascia oraria — e da lì in poi
 * ci pensa il server: quando qualcuna disdice un posto compatibile, parte la
 * notifica push. Massimo 3 avvisi attivi (regola del server).
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';

import {
  ApiError, CatalogTreatment, DesiderioAttesa,
  catalogService, waitlistService,
} from '@/api';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

const GIORNI = [
  { n: 1, label: 'Lun' }, { n: 2, label: 'Mar' }, { n: 3, label: 'Mer' },
  { n: 4, label: 'Gio' }, { n: 5, label: 'Ven' }, { n: 6, label: 'Sab' },
];

const FASCE = [
  { label: 'Mattina', dalle: '09:00', alle: '13:00' },
  { label: 'Pomeriggio', dalle: '13:00', alle: '16:30' },
  { label: 'Tardo pomeriggio', dalle: '16:30', alle: '19:30' },
  { label: 'Qualsiasi ora', dalle: '09:00', alle: '19:30' },
];

function descriviGiorni(giorni: number[]): string {
  if (giorni.length === 0) return 'qualsiasi giorno';
  return giorni.map((g) => GIORNI.find((x) => x.n === g)?.label ?? '').filter(Boolean).join(', ');
}

export default function ListaAttesaScreen() {
  const { token } = useAuth();
  const { data, isLoading, isRefreshing, refresh } = useApiData((t) => waitlistService.list(t));
  const { data: listino } = useApiData((t) => catalogService.getListino(t));

  const [trattamento, setTrattamento] = useState<CatalogTreatment | null>(null);
  const [giorni, setGiorni] = useState<number[]>([]);
  const [fascia, setFascia] = useState(FASCE[3]);
  const [sceltaAperta, setSceltaAperta] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const alternaGiorno = (n: number) =>
    setGiorni((prev) => (prev.includes(n) ? prev.filter((g) => g !== n) : [...prev, n]));

  const crea = async () => {
    if (!token || !trattamento) return;
    setErrore(null);
    setCreando(true);
    try {
      await waitlistService.crea(token, {
        treatmentId: trattamento.id,
        giorni,
        dalleOre: fascia.dalle,
        alleOre: fascia.alle,
      });
      setTrattamento(null);
      setGiorni([]);
      setFascia(FASCE[3]);
      refresh();
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Non siamo riusciti a creare l\'avviso.');
    } finally {
      setCreando(false);
    }
  };

  const cambiaStato = async (d: DesiderioAttesa) => {
    if (!token) return;
    try {
      if (d.stato === 'attiva') await waitlistService.annulla(token, d.id);
      else await waitlistService.riattiva(token, d.id);
      refresh();
    } catch {
      // il refresh mostrerà comunque lo stato vero
    }
  };

  if (isLoading) {
    return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;
  }

  const desideri = data?.desideri ?? [];

  return (
    <ScrollView
      style={styles.sfondo}
      contentContainerStyle={styles.contenuto}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Text style={styles.spiega}>
        Scegli cosa aspetti: appena si libera un posto compatibile ti mandiamo
        una notifica, prima di tutte.
      </Text>

      {/* ── Nuovo avviso ── */}
      <Text style={styles.etichetta}>Trattamento</Text>
      <Pressable style={styles.selettore} onPress={() => setSceltaAperta(true)}>
        <Text style={trattamento ? styles.selTesto : styles.selVuoto}>
          {trattamento?.name ?? 'Scegli il trattamento…'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>

      <Text style={styles.etichetta}>Nei giorni (vuoto = tutti)</Text>
      <View style={styles.riga}>
        {GIORNI.map((g) => {
          const attivo = giorni.includes(g.n);
          return (
            <Pressable
              key={g.n}
              style={[styles.chip, attivo && styles.chipAttivo]}
              onPress={() => alternaGiorno(g.n)}
            >
              <Text style={[styles.chipTesto, attivo && styles.chipTestoAttivo]}>{g.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.etichetta}>Fascia oraria</Text>
      <View style={styles.riga}>
        {FASCE.map((f) => {
          const attiva = f.label === fascia.label;
          return (
            <Pressable
              key={f.label}
              style={[styles.chip, attiva && styles.chipAttivo]}
              onPress={() => setFascia(f)}
            >
              <Text style={[styles.chipTesto, attiva && styles.chipTestoAttivo]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FormError message={errore} />
      <Button
        title="Attiva l'avviso"
        onPress={crea}
        loading={creando}
        disabled={!trattamento}
        style={{ marginTop: spacing.sm }}
      />

      {/* ── Avvisi esistenti ── */}
      {desideri.length > 0 && <Text style={styles.sezione}>I tuoi avvisi</Text>}
      {desideri.map((d) => (
        <View key={d.id} style={styles.card}>
          <View style={styles.cardTesto}>
            <Text style={styles.cardTitolo}>{d.treatmentName}</Text>
            <Text style={styles.cardDettagli}>
              {descriviGiorni(d.giorni)} · {d.dalleOre}–{d.alleOre}
            </Text>
            <Text style={[styles.cardStato, d.stato === 'avvisata' && { color: colors.primaryDark }]}>
              {d.stato === 'attiva' ? 'In ascolto' : 'Avvisata — posto proposto'}
            </Text>
          </View>
          <Pressable onPress={() => cambiaStato(d)} hitSlop={8}>
            <Text style={styles.azione}>{d.stato === 'attiva' ? 'Annulla' : 'Riattiva'}</Text>
          </Pressable>
        </View>
      ))}

      {/* ── Scelta trattamento ── */}
      <Modal visible={sceltaAperta} animationType="slide" onRequestClose={() => setSceltaAperta(false)}>
        <View style={styles.modale}>
          <View style={styles.modaleTesta}>
            <Text style={styles.modaleTitolo}>Che trattamento aspetti?</Text>
            <Pressable onPress={() => setSceltaAperta(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
            {(listino?.categories ?? []).map((cat) => (
              <View key={cat.name}>
                <Text style={styles.modaleCategoria}>{cat.name}</Text>
                {cat.treatments.map((t) => (
                  <Pressable
                    key={t.id}
                    style={styles.modaleVoce}
                    onPress={() => { setTrattamento(t); setSceltaAperta(false); }}
                  >
                    <Text style={styles.modaleVoceTesto}>{t.name}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl },
  spiega: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  etichetta: { ...typography.label, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs },
  selettore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14,
  },
  selTesto: { ...typography.body, color: colors.textPrimary, flex: 1 },
  selVuoto: { ...typography.body, color: colors.textSecondary, flex: 1 },
  riga: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipAttivo: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipTesto: { ...typography.label, color: colors.textSecondary },
  chipTestoAttivo: { color: colors.primaryDark, fontFamily: fonts.w700 },
  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  cardTesto: { flex: 1 },
  cardTitolo: { ...typography.bodyForte, color: colors.textPrimary },
  cardDettagli: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  cardStato: { ...typography.caption, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  azione: { ...typography.label, color: colors.primaryDark, fontFamily: fonts.w700 },
  modale: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.xxl },
  modaleTesta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modaleTitolo: { ...typography.subtitle, color: colors.textPrimary },
  modaleCategoria: {
    ...typography.label, color: colors.primaryDark, textTransform: 'uppercase',
    letterSpacing: 0.8, paddingHorizontal: spacing.lg,
    marginTop: spacing.lg, marginBottom: spacing.xs,
  },
  modaleVoce: {
    paddingVertical: 13, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modaleVoceTesto: { ...typography.body, color: colors.textPrimary },
});
