/**
 * La prima cosa dopo il primo accesso: creare la password.
 *
 * Il numero da solo dice chi sei, non che sei tu — chiunque lo conosca
 * potrebbe entrare. Da qui in poi si entra con numero + password, e
 * questa schermata non si può saltare: è la serratura della porta.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { ApiError } from '@/api';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, spacing, typography } from '@/theme';

export function CreaPassword() {
  const { creaPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salva = async () => {
    setErrore(null);
    if (password.length < 8) {
      setErrore('La password deve avere almeno 8 caratteri.');
      return;
    }
    if (password !== conferma) {
      setErrore('Le due password non coincidono.');
      return;
    }
    setSalvando(true);
    try {
      await creaPassword(password);
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Non siamo riusciti a salvarla. Riprova.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.sfondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenuto} keyboardShouldPersistTaps="handled">
        <Ionicons name="key-outline" size={40} color={colors.primary} style={styles.icona} />
        <Text style={styles.titolo}>Crea la tua password</Text>
        <Text style={styles.testo}>
          Da oggi il tuo account è protetto: entrerai con il tuo numero e questa
          password, che conosci solo tu.
        </Text>

        <FormError message={errore} />

        <TextField
          label="Password"
          placeholder="Almeno 8 caratteri"
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
          editable={!salvando}
        />
        <TextField
          label="Ripeti la password"
          placeholder="Di nuovo, per sicurezza"
          secureTextEntry
          autoComplete="new-password"
          value={conferma}
          onChangeText={setConferma}
          editable={!salvando}
        />

        <Button title="Proteggi il mio account" onPress={() => void salva()} loading={salvando} />
        <Text style={styles.nota}>
          Se un giorno la dimentichi, il centro potrà azzerarla e ne creerai una nuova.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  contenuto: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  icona: { alignSelf: 'center', marginBottom: spacing.sm },
  titolo: { fontFamily: fonts.w800, fontSize: 24, color: colors.textPrimary, textAlign: 'center' },
  testo: {
    ...typography.body, color: colors.textSecondary, textAlign: 'center',
    marginTop: spacing.xs, marginBottom: spacing.lg,
  },
  nota: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
});
