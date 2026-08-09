/**
 * Beauty Club: dove sono e cosa ottengo salendo.
 *
 * I livelli e i vantaggi arrivano dal gestionale: qui non c'è nessuna soglia
 * scritta nel codice, così il centro può ritoccarli quando vuole senza toccare
 * l'app.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { homeService, type DatiHome } from '@/api';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { useAuth } from '@/hooks/useAuth';
import { colors, spacing, typography } from '@/theme';

const eur = (n: number) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 0 })} €`;

export default function ClubScreen() {
  const { token } = useAuth();
  const [d, setD] = useState<DatiHome | null>(null);

  const carica = useCallback(async () => {
    if (!token) return;
    setD(await homeService.home(token).catch(() => null));
  }, [token]);

  useFocusEffect(useCallback(() => { void carica(); }, [carica]));

  if (!d) return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;

  const club = d.club;

  return (
    <ScrollView style={styles.schermo} contentContainerStyle={styles.contenuto}>
      <Card tone="primary">
        <Text style={styles.etichetta}>Il tuo livello</Text>
        <View style={styles.rigaLivello}>
          <View style={[styles.pallone, { backgroundColor: club?.attuale?.color ?? colors.disabled }]} />
          <Text style={styles.livello}>{club?.attuale?.name ?? 'Nessun livello'}</Text>
        </View>
        <Text style={styles.piccolo}>Hai speso {eur(club?.spesaTotale ?? 0)} da quando sei nostra cliente.</Text>
      </Card>

      {club?.prossimo ? (
        <Card style={styles.spazio}>
          <Text style={styles.titoletto}>Ti mancano {eur(club.prossimo.mancaSpesa)} per {club.prossimo.name}</Text>
          <View style={styles.barra}>
            <Progress percentuale={club.avanzamento} colore={club.prossimo.color} alta />
          </View>
          <Text style={styles.piccolo}>Sei al {club.avanzamento}% del percorso.</Text>
        </Card>
      ) : null}

      {club?.attuale?.perks?.length ? (
        <>
          <Text style={styles.sezione}>I tuoi vantaggi</Text>
          {club.attuale.perks.map((v, i) => (
            <Card key={i} style={styles.spazioMini}>
              <View style={styles.rigaVantaggio}>
                <Text style={styles.spunta}>✓</Text>
                <Text style={styles.vantaggio}>{v}</Text>
              </View>
            </Card>
          ))}
        </>
      ) : null}
      <View style={styles.fondo} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  schermo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.md },
  etichetta: { ...typography.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },
  rigaLivello: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
  pallone: { width: 26, height: 26, borderRadius: 13 },
  livello: { ...typography.title, color: colors.textPrimary },
  titoletto: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  barra: { marginVertical: spacing.sm },
  piccolo: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  spazio: { marginTop: spacing.md },
  spazioMini: { marginTop: spacing.sm },
  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.lg },
  rigaVantaggio: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  spunta: { color: colors.success, fontWeight: '700' },
  vantaggio: { ...typography.body, color: colors.textPrimary, flex: 1 },
  fondo: { height: spacing.xl },
});
