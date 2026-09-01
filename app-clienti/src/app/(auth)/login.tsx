/**
 * Accesso all'app: numero di telefono e codice ricevuto su WhatsApp.
 *
 * Due passi in una schermata sola invece di due pagine: chi ha appena scritto
 * il numero deve solo digitare sei cifre, e mandarla avanti e indietro fra
 * schermate diverse è il modo migliore per farle perdere il filo (e il codice,
 * che nel frattempo è arrivato come notifica).
 *
 * Non c'è registrazione: l'account nasce da solo per chi è già cliente del
 * centro. Chi non lo è viene invitata a farsi registrare in negozio.
 */
import { useEffect, useRef, useState } from 'react';
import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, spacing, typography } from '@/theme';

type Passo = 'numero' | 'codice';

/** Numero leggibile mentre si digita: 340 123 4567 */
function formattaTelefono(grezzo: string): string {
  const cifre = grezzo.replace(/\D/g, '').slice(0, 10);
  const pezzi = [cifre.slice(0, 3), cifre.slice(3, 6), cifre.slice(6)].filter(Boolean);
  return pezzi.join(' ');
}

export default function LoginScreen() {
  const { richiediCodice, verificaCodice, introVista } = useAuth();

  const [passo, setPasso] = useState<Passo>('numero');
  const [telefono, setTelefono] = useState('');
  const [codice, setCodice] = useState('');
  const [nome, setNome] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [occupato, setOccupato] = useState(false);
  /** Secondi che mancano prima di poter richiedere un altro codice. */
  const [attesa, setAttesa] = useState(0);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (attesa <= 0) return;
    timer.current = setInterval(() => setAttesa((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [attesa]);

  const soloCifre = telefono.replace(/\D/g, '');

  // Prima apertura su questo telefono: si spiega cos'è l'app prima di chiedere
  // il numero. La redirezione sta qui e non nel layout radice perché lassù non
  // esiste ancora un navigatore e la schermata resterebbe appesa allo splash.
  if (!introVista) return <Redirect href="/intro" />;

  const chiediCodice = async () => {
    setErrore(null);
    setAvviso(null);
    setOccupato(true);
    try {
      const esito = await richiediCodice(soloCifre);
      setNome(esito.nome ?? null);
      // Accesso col solo numero: siamo gia' dentro, e il layout radice sta per
      // portarci alla home. Passare alla schermata del codice farebbe comparire
      // per un istante una domanda a cui nessuno deve rispondere.
      if (esito.accessoDiretto) return;
      setPasso('codice');
      setAttesa(60);
      // Sui server di sviluppo WhatsApp non è configurato e il codice torna
      // nella risposta: senza mostrarlo non si potrebbe provare nulla.
      if (esito.codiceDiProva) {
        setCodice(esito.codiceDiProva);
        setAvviso(`Server di prova: il codice è ${esito.codiceDiProva}`);
      }
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setErrore(err?.message ?? 'Non siamo riusciti a mandarti il codice. Riprova.');
      if (err?.code === 'TOO_MANY') {
        setPasso('codice');
        setAttesa(60);
      }
    } finally {
      setOccupato(false);
    }
  };

  const entra = async () => {
    setErrore(null);
    setOccupato(true);
    try {
      await verificaCodice(soloCifre, codice);
      // Nessuna navigazione manuale: il redirect lo fa il root layout
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Si è verificato un errore. Riprova.');
    } finally {
      setOccupato(false);
    }
  };

  const cambiaNumero = () => {
    setPasso('numero');
    setCodice('');
    setErrore(null);
    setAvviso(null);
    setNome(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>RevoBeauty</Text>

          {passo === 'numero' ? (
            <>
              <Text style={styles.subtitle}>
                Scrivi il tuo numero: ti mandiamo un codice su WhatsApp.
              </Text>

              <FormError message={errore} />

              <TextField
                label="Numero di cellulare"
                placeholder="340 123 4567"
                keyboardType="phone-pad"
                autoComplete="tel"
                value={telefono}
                onChangeText={(t) => setTelefono(formattaTelefono(t))}
                editable={!occupato}
              />

              <Button
                title="Mandami il codice"
                onPress={chiediCodice}
                loading={occupato}
                disabled={soloCifre.length < 9}
              />

              <Text style={styles.nota}>
                L&apos;app è per le clienti del centro. Se il tuo numero non viene riconosciuto,
                chiedi in negozio di essere registrata.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>
                {nome ? `Ciao ${nome}! ` : ''}Abbiamo mandato un codice su WhatsApp al numero{' '}
                <Text style={styles.numero}>{telefono}</Text>.
              </Text>

              <FormError message={errore} />
              {avviso ? <Text style={styles.avviso}>{avviso}</Text> : null}

              <TextField
                label="Codice a 6 cifre"
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
                value={codice}
                onChangeText={(t) => setCodice(t.replace(/\D/g, '').slice(0, 6))}
                editable={!occupato}
              />

              <Button
                title="Entra"
                onPress={entra}
                loading={occupato}
                disabled={codice.length !== 6}
              />

              <View style={styles.azioni}>
                {attesa > 0 ? (
                  <Text style={styles.attesa}>
                    Puoi richiedere un altro codice fra {attesa}s
                    {occupato ? <ActivityIndicator size="small" /> : null}
                  </Text>
                ) : (
                  <Pressable onPress={chiediCodice} disabled={occupato}>
                    <Text style={styles.link}>Non è arrivato? Rimandalo</Text>
                  </Pressable>
                )}

                <Pressable onPress={cambiaNumero} disabled={occupato}>
                  <Text style={styles.linkTenue}>Cambia numero</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  title: { ...typography.title, color: colors.primary, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  numero: { color: colors.textPrimary, fontFamily: fonts.w700 },
  nota: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  avviso: {
    ...typography.label,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  azioni: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  attesa: { ...typography.label, color: colors.textSecondary },
  link: { ...typography.label, color: colors.primary, fontFamily: fonts.w700 },
  linkTenue: { ...typography.label, color: colors.textSecondary },
});
