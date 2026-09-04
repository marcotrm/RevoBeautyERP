/**
 * Il check-up estetico guidato: obiettivi, aree, abitudini, condizioni.
 *
 * Non è una diagnosi e non lo sembra: raccoglie quello che la cliente vuole
 * raccontare, chiede il consenso in chiaro e — se emergono condizioni da
 * guardare — mostra un avviso neutro: se ne parla in centro, con una persona.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';

import { ApiError, esteticaService } from '@/api';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

function Chips({ opzioni, scelte, cambia }: {
  opzioni: string[]; scelte: string[]; cambia: (v: string[]) => void;
}) {
  return (
    <View style={styles.griglia}>
      {opzioni.map((o) => {
        const attiva = scelte.includes(o);
        return (
          <Pressable
            key={o}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: attiva }}
            style={[styles.chip, attiva && styles.chipAttiva]}
            onPress={() => cambia(attiva ? scelte.filter((s) => s !== o) : [...scelte, o])}
          >
            <Text style={[styles.chipTesto, attiva && styles.chipTestoAttivo]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CheckupScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { data, isLoading } = useApiData((t) => esteticaService.checkup(t));

  const [obiettivi, setObiettivi] = useState<string[]>([]);
  const [aree, setAree] = useState<string[]>([]);
  const [abitudini, setAbitudini] = useState<string[]>([]);
  const [condizioni, setCondizioni] = useState<string[]>([]);
  const [precedenti, setPrecedenti] = useState('');
  const [preferenze, setPreferenze] = useState('');
  const [note, setNote] = useState('');
  const [consenso, setConsenso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inviando, setInviando] = useState(false);
  const [esito, setEsito] = useState<{ daValutare: boolean; avviso: string | null } | null>(null);

  const invia = async () => {
    if (!token || !consenso) return;
    setErrore(null);
    setInviando(true);
    try {
      const r = await esteticaService.inviaCheckup(token, {
        obiettivi, aree, abitudini, condizioni,
        trattamentiPrecedenti: precedenti, preferenze, note, consenso: true,
      });
      setEsito({ daValutare: r.daValutare, avviso: r.avviso });
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Invio non riuscito. Riprova.');
    } finally {
      setInviando(false);
    }
  };

  if (isLoading || !data) {
    return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (esito) {
    return (
      <View style={styles.centro}>
        <Ionicons name="checkmark-circle" size={52} color={colors.success} />
        <Text style={styles.grazieTitolo}>Check-up inviato ✨</Text>
        <Text style={styles.grazieTesto}>
          {esito.avviso ??
            'Grazie! Una nostra operatrice lo leggerà e lo userà per costruire il tuo percorso.'}
        </Text>
        <Button title="Torna indietro" variant="secondary" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const { domande } = data;
  return (
    <KeyboardAvoidingView style={styles.sfondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenuto} keyboardShouldPersistTaps="handled">
        {data.ultimo && (
          <View style={styles.info}>
            <Ionicons name="time-outline" size={20} color={colors.primaryDark} />
            <Text style={styles.infoTesto}>
              Hai già compilato un check-up il {data.ultimo.creatoIl.slice(0, 10)}
              {data.ultimo.verificato ? ', verificato dal centro' : ''}. Compilarne uno nuovo lo aggiorna.
            </Text>
          </View>
        )}

        <Text style={styles.etichetta}>Cosa vorresti ottenere?</Text>
        <Chips opzioni={domande.obiettivi} scelte={obiettivi} cambia={setObiettivi} />

        <Text style={styles.etichetta}>Su quali zone?</Text>
        <Chips opzioni={domande.aree} scelte={aree} cambia={setAree} />

        <Text style={styles.etichetta}>Le tue abitudini (se ti riconosci)</Text>
        <Chips opzioni={domande.abitudini} scelte={abitudini} cambia={setAbitudini} />

        <Text style={styles.etichetta}>Trattamenti già fatti in passato</Text>
        <TextInput
          style={styles.campo} value={precedenti} onChangeText={setPrecedenti}
          placeholder="Es. pressoterapia l'anno scorso, laser due anni fa…"
          placeholderTextColor={colors.textSecondary} multiline
        />

        <Text style={styles.etichetta}>Preferenze</Text>
        <TextInput
          style={styles.campo} value={preferenze} onChangeText={setPreferenze}
          placeholder="Es. preferisco il pomeriggio, trattamenti delicati…"
          placeholderTextColor={colors.textSecondary} multiline
        />

        <Text style={styles.etichetta}>C&apos;è qualcosa che dovremmo sapere prima?</Text>
        <Text style={styles.sotto}>
          Non è una diagnosi: serve solo a chi ti seguirà per scegliere con te i trattamenti più adatti.
        </Text>
        <Chips opzioni={domande.condizioni} scelte={condizioni} cambia={setCondizioni} />

        <Text style={styles.etichetta}>Altro che vuoi dirci</Text>
        <TextInput
          style={styles.campo} value={note} onChangeText={setNote}
          placeholder="Scrivi liberamente…" placeholderTextColor={colors.textSecondary} multiline
        />

        <View style={styles.consensoRiga}>
          <Switch
            value={consenso} onValueChange={setConsenso}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel="Consenso al trattamento dei dati del check-up"
          />
          <Text style={styles.consensoTesto}>
            Acconsento a che queste risposte siano conservate nella mia scheda e usate solo per il mio
            percorso. Posso revocare quando voglio dai miei consensi.
          </Text>
        </View>

        <FormError message={errore} />
        <Button
          title="Invia il check-up"
          onPress={() => void invia()}
          loading={inviando}
          disabled={!consenso || (obiettivi.length === 0 && aree.length === 0)}
        />
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
  etichetta: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.md },
  sotto: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  griglia: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipAttiva: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipTesto: { ...typography.label, color: colors.textSecondary },
  chipTestoAttivo: { color: colors.primaryDark, fontFamily: fonts.w700 },
  campo: {
    ...typography.body, minHeight: 60, color: colors.textPrimary,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, textAlignVertical: 'top',
  },
  consensoRiga: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.lg, marginBottom: spacing.md,
  },
  consensoTesto: { ...typography.caption, fontSize: 12.5, color: colors.textSecondary, flex: 1, lineHeight: 17 },
});
