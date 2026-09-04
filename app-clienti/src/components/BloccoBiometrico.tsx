/**
 * Schermata di sblocco con Face ID / impronta.
 *
 * Compare quando l'app si riapre con una sessione salvata: la richiesta
 * biometrica parte da sola, e la schermata sotto resta coperta finché il
 * telefono non conferma. Se la persona annulla può riprovare col bottone,
 * oppure uscire e rientrare col numero (utile se il telefono è passato di
 * mano: Face ID nuovo, account no).
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, spacing, typography } from '@/theme';

export function BloccoBiometrico() {
  const { sblocca, signOut } = useAuth();
  const [fallita, setFallita] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  const chiediSblocco = useCallback(async () => {
    setInCorso(true);
    try {
      const esito = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sblocca RevoBeauty',
        cancelLabel: 'Annulla',
      });
      if (esito.success) {
        sblocca();
        return;
      }
      setFallita(true);
    } catch {
      // Se la biometria non risponde non si resta chiuse fuori dal
      // proprio account: meglio aprire che bloccare per un guasto.
      sblocca();
    } finally {
      setInCorso(false);
    }
  }, [sblocca]);

  // La richiesta parte appena la schermata compare: il gesto naturale è
  // guardare il telefono, non premere un bottone.
  useEffect(() => {
    void chiediSblocco();
  }, [chiediSblocco]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RevoBeauty</Text>
      <Text style={styles.subtitle}>
        {fallita ? 'Sblocco non riuscito.' : 'Sblocca con Face ID per continuare.'}
      </Text>

      <Button title="Sblocca" onPress={chiediSblocco} loading={inCorso} style={styles.bottone} />

      <Pressable onPress={() => void signOut()} disabled={inCorso}>
        <Text style={styles.esci}>Esci e accedi con un altro numero</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bottone: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  esci: {
    ...typography.label,
    color: colors.textSecondary,
    fontFamily: fonts.w700,
    marginTop: spacing.md,
  },
});
