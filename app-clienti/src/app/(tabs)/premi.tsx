/**
 * Premi: Beauty Box da aprire, sfide in corso e scorciatoie a Club e Wallet.
 *
 * Le box chiuse stanno in cima e si aprono con un tocco: il premio è già
 * stato estratto quando la box è stata assegnata, qui si scarta soltanto —
 * altrimenti due tocchi ravvicinati potrebbero estrarre due premi.
 *
 * La box è l'unica cosa colorata della schermata, ed è giusto così: è un
 * regalo da scartare, deve saltare all'occhio. Livello, credito e sfide
 * scendono a righe — sono informazioni, non inviti.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, homeService, type DatiHome } from '@/api';
import { Button } from '@/components/ui/Button';
import { Icona } from '@/components/ui/Icona';
import { Progress } from '@/components/ui/Progress';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

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

        {/* ── La box da scartare: l'unico blocco colorato ── */}
        {box.map(p => (
          <View key={p.id} style={styles.box}>
            <Text style={styles.occhielloPremio}>{p.titolo}</Text>
            <Text style={styles.boxTitolo}>Da aprire</Text>
            <Text style={styles.piccolo}>{p.sottotitolo}</Text>
            <Button
              title={apro === p.azione.winId ? 'Apro…' : p.azione.label}
              onPress={() => p.azione.winId && apri(p.azione.winId)}
              loading={apro === p.azione.winId}
              style={styles.bottone}
            />
          </View>
        ))}

        {/* ── Livello e credito: righe, non riquadri ── */}
        {d.club?.attuale ? (
          <Pressable style={styles.blocco} onPress={() => router.push('/club')}>
            <View style={styles.rigaTop}>
              <Text style={styles.forte}>{d.club.attuale.name}</Text>
              <Text style={styles.piccolo}>
                {d.club.prossimo ? `${eur(d.club.prossimo.mancaSpesa)} a ${d.club.prossimo.name}` : 'il tuo livello'}
              </Text>
            </View>
            <View style={styles.barra}>
              <Progress percentuale={d.club.avanzamento} colore={d.club.prossimo?.color} />
            </View>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push('/wallet')}>
          <Text style={styles.vita}>
            {d.punti} punti
            {d.wallet ? <Text style={styles.credito}>{`  ·  ${eur(d.wallet.totale)} di credito`}</Text> : null}
          </Text>
        </Pressable>

        {/* ── Le sfide ── */}
        {sfide.length ? (
          <>
            <Text style={styles.sezione}>Le tue sfide</Text>
            <View style={styles.lista}>
              {sfide.map(s => (
                <View key={s.id} style={styles.riga}>
                  <View style={styles.testi}>
                    <Text style={styles.forte}>{s.titolo}</Text>
                    <Text style={styles.piccolo}>{s.sottotitolo}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ── Porta un'amica ── */}
        <Pressable style={styles.riga} onPress={() => router.push('/invita')}>
          <View style={styles.testi}>
            <Text style={styles.forte}>Porta un&apos;amica</Text>
            <Text style={styles.piccolo}>Credito per te e per lei alla sua prima visita.</Text>
          </View>
          <Icona nome="freccia" misura={19} colore={colors.textMuted} />
        </Pressable>

        {!box.length && !sfide.length ? (
          <Text style={styles.vuoto}>
            Qui arrivano le Beauty Box e le sfide. Si sbloccano venendo in centro,
            prenotando dall&apos;app e portando le amiche.
          </Text>
        ) : null}

        <View style={styles.fondo} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenuto: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  titolo: { ...typography.title, color: colors.textPrimary, marginTop: spacing.sm },

  box: {
    marginTop: spacing.lg, padding: spacing.lg,
    backgroundColor: colors.rewardSoft, borderRadius: radius.lg,
  },
  occhielloPremio: { ...typography.occhiello, color: colors.reward },
  boxTitolo: { fontFamily: fonts.serif600, fontSize: 30, color: colors.textPrimary, marginTop: spacing.xs },
  bottone: { marginTop: spacing.md },

  blocco: { marginTop: spacing.lg },
  rigaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  barra: { marginTop: spacing.sm },

  vita: { ...typography.body, color: colors.textPrimary, marginTop: spacing.lg },
  credito: { ...typography.caption, color: colors.primaryDark, fontFamily: fonts.w600 },

  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.xl },
  lista: { marginTop: spacing.sm },
  riga: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  testi: { flex: 1 },
  forte: { ...typography.bodyForte, color: colors.textPrimary },
  piccolo: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },

  vuoto: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xl, lineHeight: 24 },
  fondo: { height: spacing.xl },
});
