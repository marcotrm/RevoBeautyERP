/**
 * I consensi, in mano alla cliente: si leggono per intero, si danno e si
 * revocano con un interruttore. Revocare è facile quanto concedere.
 */
import { useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';

import { ApiError, esteticaService } from '@/api';
import { FormError } from '@/components/ui/FormError';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

export default function ConsensiScreen() {
  const { token } = useAuth();
  const { data, isLoading, isRefreshing, refresh } = useApiData((t) => esteticaService.consensi(t));
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState<string | null>(null);

  const cambia = async (tipo: string, concesso: boolean) => {
    if (!token || inCorso) return;
    setErrore(null);
    setInCorso(tipo);
    try {
      await esteticaService.impostaConsenso(token, tipo, concesso);
      refresh();
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Operazione non riuscita. Riprova.');
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
      <Text style={styles.intro}>
        Qui decidi tu. Ogni consenso si può revocare in ogni momento: da quel
        momento il centro smette di usare quei dati.
      </Text>
      <FormError message={errore} />

      {data.consensi.map((c) => (
        <View key={c.tipo} style={styles.riga}>
          <View style={styles.rigaTesta}>
            <Text style={styles.nome}>{c.nome}</Text>
            <Switch
              value={c.concesso}
              disabled={inCorso === c.tipo}
              onValueChange={(v) => void cambia(c.tipo, v)}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={`Consenso: ${c.nome}`}
            />
          </View>
          <Text style={styles.testo}>{c.testo}</Text>
          <Text style={styles.quando}>
            {c.concesso && c.concessoIl
              ? `Concesso il ${c.concessoIl.slice(0, 10).split('-').reverse().join('/')}`
              : c.revocatoIl
                ? `Revocato il ${c.revocatoIl.slice(0, 10).split('-').reverse().join('/')}`
                : 'Mai concesso'}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 20 },
  riga: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  rigaTesta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  nome: { fontFamily: fonts.w700, fontSize: 15, color: colors.textPrimary, flex: 1 },
  testo: { ...typography.caption, fontSize: 12.5, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 17 },
  quando: { ...typography.caption, fontSize: 11, color: colors.textSecondary, marginTop: spacing.xs },
});
