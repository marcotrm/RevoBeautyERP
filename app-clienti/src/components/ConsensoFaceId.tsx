/**
 * Domanda sullo sblocco con Face ID, una volta sola dopo il primo accesso.
 *
 * Come le app delle banche: si spiega a cosa serve e si lascia scegliere.
 * "Attiva" fa partire subito la verifica biometrica (e quindi, nella build
 * vera, il consenso di sistema di iOS); "Non ora" lascia tutto com'è e la
 * domanda non ricompare più.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, spacing, typography } from '@/theme';

export function ConsensoFaceId() {
  const { rispondiConsensoFaceId } = useAuth();
  const [inCorso, setInCorso] = useState(false);

  const attiva = async () => {
    setInCorso(true);
    try {
      await rispondiConsensoFaceId(true);
    } finally {
      setInCorso(false);
    }
  };

  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed-outline" size={44} color={colors.primary} />
      <Text style={styles.title}>Proteggi il tuo account</Text>
      <Text style={styles.subtitle}>
        Vuoi sbloccare RevoBeauty con Face ID quando riapri l&apos;app? I tuoi
        appuntamenti e i tuoi dati resteranno visibili solo a te.
      </Text>

      <Button title="Attiva Face ID" onPress={attiva} loading={inCorso} style={styles.bottone} />

      <Pressable onPress={() => void rispondiConsensoFaceId(false)} disabled={inCorso}>
        <Text style={styles.nonOra}>Non ora</Text>
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
    textAlign: 'center',
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
  nonOra: {
    ...typography.label,
    color: colors.textSecondary,
    fontFamily: fonts.w700,
    marginTop: spacing.md,
  },
});
