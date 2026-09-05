/**
 * Cosa vuoi ricevere: promo, auguri e occasioni si spengono da qui,
 * famiglia per famiglia. I promemoria dei TUOI appuntamenti e la chat
 * restano sempre attivi: sono servizio, non pubblicità.
 */
import { useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';

import { ApiError } from '@/api';
import { apiRequest } from '@/api/http';
import { FormError } from '@/components/ui/FormError';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

interface Preferenze { promo: boolean; auguri: boolean; occasioni: boolean }

const VOCI: { chiave: keyof Preferenze; nome: string; spiega: string }[] = [
  { chiave: 'promo', nome: 'Promo e novità', spiega: 'Le promo del giorno e i lavori del salone.' },
  { chiave: 'auguri', nome: 'Auguri di compleanno', spiega: 'Il pensiero (e il regalo) nel tuo giorno.' },
  { chiave: 'occasioni', nome: 'Occasioni per te', spiega: 'Posti liberi all\'ultimo, momenti giusti per tornare, promemoria se non prenoti da un po\'.' },
];

export default function PreferenzeNotificheScreen() {
  const { token } = useAuth();
  const { data, isLoading, refresh } = useApiData((t) =>
    apiRequest<{ preferenze: Preferenze }>('/api/mobile/notifiche-preferenze', { token: t })
  );
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState<string | null>(null);

  const cambia = async (chiave: keyof Preferenze, valore: boolean) => {
    if (!token || inCorso) return;
    setErrore(null);
    setInCorso(chiave);
    try {
      await apiRequest('/api/mobile/notifiche-preferenze', {
        method: 'POST', token, body: { [chiave]: valore },
      });
      refresh();
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Salvataggio non riuscito. Riprova.');
    } finally {
      setInCorso(null);
    }
  };

  if (isLoading || !data) {
    return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.sfondo} contentContainerStyle={styles.contenuto}>
      <Text style={styles.intro}>
        Scegli cosa ricevere. I promemoria dei tuoi appuntamenti e le risposte
        in chat arrivano sempre: quelli non sono pubblicità, sono servizio.
      </Text>
      <FormError message={errore} />

      {VOCI.map((v) => (
        <View key={v.chiave} style={styles.riga}>
          <View style={styles.testi}>
            <Text style={styles.nome}>{v.nome}</Text>
            <Text style={styles.spiega}>{v.spiega}</Text>
          </View>
          <Switch
            value={data.preferenze[v.chiave]}
            disabled={inCorso === v.chiave}
            onValueChange={(x) => void cambia(v.chiave, x)}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={`Notifiche: ${v.nome}`}
          />
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
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  testi: { flex: 1, minWidth: 0 },
  nome: { fontFamily: fonts.w700, fontSize: 15, color: colors.textPrimary },
  spiega: { ...typography.caption, fontSize: 12.5, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
});
