/**
 * Premi: Beauty Box da aprire, sfide in corso e scorciatoie a Club e Wallet.
 *
 * Le box chiuse stanno in cima e si aprono con un tocco: il premio è già
 * stato estratto quando la box è stata assegnata, qui si scarta soltanto —
 * altrimenti due tocchi ravvicinati potrebbero estrarre due premi.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, homeService, type DatiHome } from '@/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Progress } from '@/components/ui/Progress';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, spacing, typography } from '@/theme';

const eur = (n: number) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })} €`;

export default function PremiScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [d, setD] = useState<DatiHome | null>(null);
  const [aggiornando, setAggiornando] = useState(false);
  const [apro, setApro] = useState('');

  const carica = useCallback(async () => {
    if (!token) return;
    setD(await homeService.home(token).catch(() => null));
  }, [token]);

  useFocusEffect(useCallback(() => { void carica(); }, [carica]));

  const apri = async (winId: string) => {
    if (!token) return;
    setApro(winId);
    try {
      const r = await homeService.apriPremio(token, winId);
      Alert.alert(
        '🎁 Hai vinto!',
        r.premio.kind === 'credit' ? `${r.premio.nome}: ${eur(r.premio.valore)} accreditati nel tuo wallet.`
          : r.premio.kind === 'points' ? `${r.premio.nome}: ${r.premio.valore} punti accreditati.`
          : `${r.premio.nome}. Mostralo in centro alla prossima visita.`
      );
      await carica();
    } catch (e) {
      Alert.alert('Non è andata', e instanceof ApiError ? e.message : 'Riprova.');
    } finally {
      setApro('');
    }
  };

  if (!d) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const box = d.proposte.filter(p => p.tipo === 'premio');
  const sfide = d.proposte.filter(p => p.tipo === 'challenge');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.contenuto}
        refreshControl={
          <RefreshControl refreshing={aggiornando} tintColor={colors.primary}
            onRefresh={async () => { setAggiornando(true); await carica(); setAggiornando(false); }} />
        }
      >
        <Text style={styles.titolo}>Premi</Text>

        {box.map(p => (
          <Card key={p.id} tone="reward" style={styles.spazio}>
            <Text style={styles.boxIcona}>🎁</Text>
            <Text style={styles.boxTitolo}>{p.titolo}</Text>
            <Text style={styles.piccolo}>{p.sottotitolo}</Text>
            <View style={styles.spazio}>
              <Button
                title={apro === p.azione.winId ? 'Apro…' : p.azione.label}
                onPress={() => p.azione.winId && apri(p.azione.winId)}
                loading={apro === p.azione.winId}
              />
            </View>
          </Card>
        ))}

        {/* Club e wallet a portata di mano */}
        <View style={styles.duo}>
          <Card style={styles.meta} onPress={() => router.push('/club')}>
            <Text style={styles.metaTitolo}>{d.club?.attuale?.name ?? 'Beauty Club'}</Text>
            <Text style={styles.piccolo}>
              {d.club?.prossimo ? `${eur(d.club.prossimo.mancaSpesa)} a ${d.club.prossimo.name}` : 'Il tuo livello'}
            </Text>
            {d.club ? (
              <View style={styles.barra}><Progress percentuale={d.club.avanzamento} colore={d.club.prossimo?.color} /></View>
            ) : null}
          </Card>
          <Card style={styles.meta} onPress={() => router.push('/wallet')}>
            <Text style={styles.metaTitolo}>{eur(d.wallet?.totale ?? 0)}</Text>
            <Text style={styles.piccolo}>Beauty Credit · {d.punti} punti</Text>
          </Card>
        </View>

        {sfide.length ? (
          <>
            <Text style={styles.sezione}>Le tue sfide</Text>
            {sfide.map(s => (
              <Card key={s.id} style={styles.spazioMini}>
                <Text style={styles.sfidaTitolo}>{s.titolo}</Text>
                <Text style={styles.piccolo}>{s.sottotitolo}</Text>
              </Card>
            ))}
          </>
        ) : null}

        <Card style={styles.spazio} onPress={() => router.push('/invita')}>
          <View style={styles.rigaTop}>
            <View style={styles.testi}>
              <Text style={styles.metaTitolo}>Porta un&apos;amica</Text>
              <Text style={styles.piccolo}>Credito per te e per lei alla sua prima visita.</Text>
            </View>
            <Chip testo="invita" />
          </View>
        </Card>

        {!box.length && !sfide.length ? (
          <Card style={styles.spazio}>
            <Text style={styles.piccolo}>
              Qui arrivano le Beauty Box e le sfide. Si sbloccano venendo in centro,
              prenotando dall&apos;app e portando le amiche.
            </Text>
          </Card>
        ) : null}
        <View style={styles.fondo} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenuto: { padding: spacing.md, paddingBottom: spacing.xxl },
  titolo: { ...typography.title, color: colors.textPrimary },
  spazio: { marginTop: spacing.md },
  spazioMini: { marginTop: spacing.sm },
  boxIcona: { fontSize: 34 },
  boxTitolo: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.xs },
  piccolo: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  duo: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  meta: { flex: 1 },
  metaTitolo: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.w700 },
  barra: { marginTop: spacing.sm },
  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.lg },
  sfidaTitolo: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.w600 },
  rigaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  testi: { flex: 1, paddingRight: spacing.sm },
  fondo: { height: spacing.xl },
});
