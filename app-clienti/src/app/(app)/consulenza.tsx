/**
 * La consulenza iniziale digitale: dimmi cosa vorresti migliorare.
 *
 * Non prescrive trattamenti: raccoglie il desiderio e lo porta al centro,
 * che risponde con una consulenza vera. La macchina fa il postino,
 * la professionista fa la professionista.
 */
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError, esteticaService } from '@/api';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

const STATI: Record<string, string> = {
  nuova: 'Inviata, in attesa di risposta',
  in_carico: 'Presa in carico dal centro',
  trasformata: 'Trasformata in percorso ✨',
  chiusa: 'Conclusa',
};

export default function ConsulenzaScreen() {
  const { token } = useAuth();
  const altezzaHeader = useHeaderHeight();
  const router = useRouter();
  const { data, isLoading, refresh } = useApiData((t) => esteticaService.consulenza(t));

  const [aree, setAree] = useState<string[]>([]);
  const [desiderio, setDesiderio] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [inviando, setInviando] = useState(false);
  const [inviata, setInviata] = useState(false);

  const invia = async () => {
    if (!token || aree.length === 0) return;
    setErrore(null);
    setInviando(true);
    try {
      await esteticaService.inviaConsulenza(token, aree, desiderio);
      setInviata(true);
      refresh();
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Invio non riuscito. Riprova.');
    } finally {
      setInviando(false);
    }
  };

  if (isLoading || !data) {
    return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (inviata) {
    return (
      <View style={styles.centro}>
        <Ionicons name="sparkles" size={52} color={colors.primary} />
        <Text style={styles.grazieTitolo}>Richiesta inviata 💛</Text>
        <Text style={styles.grazieTesto}>
          Una nostra operatrice la leggerà e ti proporrà una consulenza di persona:
          è lì che nasce il percorso giusto per te.
        </Text>
        <Button title="Prenota intanto un appuntamento" onPress={() => router.replace('/(tabs)/prenota')} style={{ alignSelf: 'stretch' }} />
        <Button title="Torna indietro" variant="secondary" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const aperta = data.richieste.find((r) => r.stato === 'nuova' || r.stato === 'in_carico');

  return (
    <KeyboardAvoidingView style={styles.sfondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? altezzaHeader : 0}>
      <ScrollView contentContainerStyle={styles.contenuto} keyboardShouldPersistTaps="handled">
        {aperta ? (
          <View style={styles.info}>
            <Ionicons name="hourglass-outline" size={20} color={colors.primaryDark} />
            <Text style={styles.infoTesto}>
              Hai già una richiesta in lavorazione ({STATI[aperta.stato]}). Ti risponderemo a breve:
              se hai fretta, scrivici in chat!
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.etichetta}>Cosa vorresti migliorare?</Text>
            <View style={styles.griglia}>
              {data.aree.map((a) => {
                const attiva = aree.includes(a);
                return (
                  <Pressable
                    key={a}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: attiva }}
                    style={[styles.chip, attiva && styles.chipAttiva]}
                    onPress={() => setAree(attiva ? aree.filter((x) => x !== a) : [...aree, a])}
                  >
                    <Text style={[styles.chipTesto, attiva && styles.chipTestoAttivo]}>{a}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.etichetta}>Raccontaci con parole tue</Text>
            <TextInput
              style={styles.area} value={desiderio} onChangeText={setDesiderio}
              placeholder="Es. vorrei sentirmi più tonica per l'estate, oppure risolvere la pelle spenta…"
              placeholderTextColor={colors.textSecondary} multiline textAlignVertical="top"
            />

            <FormError message={errore} />
            <Button
              title="Invia la richiesta al centro"
              onPress={() => void invia()}
              loading={inviando}
              disabled={aree.length === 0}
            />
            <Text style={styles.nota}>
              Nessun trattamento ti verrà prescritto in automatico: la tua richiesta arriva a una
              persona vera, che ti proporrà una consulenza professionale.
            </Text>
          </>
        )}

        {data.richieste.length > 0 && (
          <>
            <Text style={styles.sezione}>Le tue richieste</Text>
            {data.richieste.map((r) => (
              <View key={r.id} style={styles.riga}>
                <Text style={styles.rigaTitolo}>{(r.aree ?? []).join(', ')}</Text>
                <Text style={styles.rigaSotto}>{STATI[r.stato] ?? r.stato} · {r.createdAt.slice(0, 10)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md,
  },
  grazieTitolo: { fontFamily: fonts.w800, fontSize: 22, color: colors.textPrimary },
  grazieTesto: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl },
  info: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.primarySoft, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  infoTesto: { ...typography.caption, fontSize: 13, color: colors.textPrimary, flex: 1, lineHeight: 18 },
  etichetta: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs },
  griglia: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipAttiva: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipTesto: { ...typography.label, color: colors.textSecondary },
  chipTestoAttivo: { color: colors.primaryDark, fontFamily: fonts.w700 },
  area: {
    ...typography.body, minHeight: 110, color: colors.textPrimary,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
  },
  nota: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 17 },
  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  riga: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  rigaTitolo: { ...typography.body, fontSize: 14.5, color: colors.textPrimary },
  rigaSotto: { ...typography.caption, color: colors.textSecondary },
});
