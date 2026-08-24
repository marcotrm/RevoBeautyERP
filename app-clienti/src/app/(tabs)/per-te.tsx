/**
 * "Cosa posso fare oggi": tutte le occasioni realmente disponibili.
 *
 * A differenza della Home, qui non si taglia niente: le proposte ci sono
 * tutte, con in cima i Flash Slot, che hanno un conto alla rovescia e vanno
 * presi al volo.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, homeService, type DatiHome, type FlashSlotApp } from '@/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, spacing, typography } from '@/theme';

const eur = (n: number) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })} €`;

/** mm:ss del tempo che resta, così si capisce che è davvero a tempo. */
function conto(secondi: number): string {
  if (secondi <= 0) return 'scaduto';
  const m = Math.floor(secondi / 60);
  const s = secondi % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PerTeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [dati, setDati] = useState<DatiHome | null>(null);
  const [slots, setSlots] = useState<FlashSlotApp[]>([]);
  const [aggiornando, setAggiornando] = useState(false);
  const [occupato, setOccupato] = useState('');
  const [tick, setTick] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const carica = useCallback(async () => {
    if (!token) return;
    const [h, f] = await Promise.all([
      homeService.home(token).catch(() => null),
      homeService.flash(token).catch(() => ({ slots: [] })),
    ]);
    if (h) setDati(h);
    setSlots(f.slots);
  }, [token]);

  useFocusEffect(useCallback(() => { void carica(); }, [carica]));

  // Il conto alla rovescia scorre in locale: chiedere ogni secondo al server
  // consumerebbe batteria e rete per un dato che si può calcolare da soli.
  useEffect(() => {
    timer.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const prendi = async (s: FlashSlotApp) => {
    if (!token) return;
    setOccupato(s.id);
    try {
      const r = await homeService.prendiFlash(token, s.id);
      Alert.alert(
        'Prenotato!',
        `${r.slot.treatmentName} con ${r.slot.operatorName}, ${r.slot.startTime}. Ti aspettiamo!`,
        [{ text: 'Vedi in agenda', onPress: () => router.push('/appuntamenti') }, { text: 'Ok' }]
      );
      await carica();
    } catch (e) {
      Alert.alert('Non è andata', e instanceof ApiError ? e.message : 'Riprova fra poco.');
      await carica();
    } finally {
      setOccupato('');
    }
  };

  const aggiorna = async () => { setAggiornando(true); await carica(); setAggiornando(false); };

  if (!dati) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const vivi = slots.filter(s => s.restanoSecondi - tick > 0);
  const niente = !vivi.length && !dati.proposte.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.contenuto}
        refreshControl={<RefreshControl refreshing={aggiornando} onRefresh={aggiorna} tintColor={colors.primary} />}
      >
        <Text style={styles.titolo}>Per te</Text>
        <Text style={styles.sottotitolo}>
          {niente
            ? 'Al momento non c\'è niente in sospeso: sei in pari!'
            : `${vivi.length + dati.proposte.length} cose che puoi fare adesso`}
        </Text>

        {/* ── Flash Slot ── */}
        {vivi.length ? (
          <>
            <Text style={styles.sezione}>⚡ Si è appena liberato</Text>
            {vivi.map(s => {
              const restano = s.restanoSecondi - tick;
              return (
                <Card key={s.id} tone="flash" style={styles.spazio}>
                  <View style={styles.rigaTop}>
                    <Text style={styles.flashOra}>
                      {s.date === new Date().toISOString().slice(0, 10) ? 'Oggi' : s.date.slice(8, 10) + '/' + s.date.slice(5, 7)} · {s.startTime}
                    </Text>
                    <Chip testo={`ancora ${conto(restano)}`} colore={colors.flash} sfondo={colors.white} />
                  </View>
                  <Text style={styles.flashTratt}>{s.treatmentName}</Text>
                  <Text style={styles.flashOp}>con {s.operatorName}</Text>
                  <View style={styles.prezzi}>
                    <Text style={styles.prezzoVecchio}>{eur(s.fullPrice)}</Text>
                    <Text style={styles.prezzoNuovo}>{eur(s.price)}</Text>
                    <Text style={styles.risparmio}>risparmi {eur(s.risparmio)}</Text>
                  </View>
                  <View style={styles.spazio}>
                    <Button
                      title={occupato === s.id ? 'Prenoto…' : 'Prenota ora'}
                      onPress={() => prendi(s)}
                      loading={occupato === s.id}
                    />
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}

        {/* ── Le altre occasioni ── */}
        {dati.proposte.length ? (
          <>
            <Text style={styles.sezione}>Le tue occasioni</Text>
            {dati.proposte.map(p => (
              <Card key={p.id} style={styles.spazio}>
                <View style={styles.propostaRiga}>
                  <Text style={styles.icona}>{p.icona}</Text>
                  <View style={styles.testi}>
                    <Text style={styles.pTitolo}>{p.titolo}</Text>
                    <Text style={styles.pSotto}>{p.sottotitolo}</Text>
                  </View>
                </View>
                <View style={styles.spazio}>
                  <Button
                    title={p.azione.label}
                    variant="secondary"
                    onPress={() => {
                      if (p.azione.tipo === 'percorso') router.push('/percorsi');
                      else if (p.azione.tipo === 'referral') router.push('/invita');
                      else if (p.azione.tipo === 'club') router.push('/club');
                      else router.push('/prenota');
                    }}
                  />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {niente ? (
          <Card style={styles.spazio}>
            <Text style={styles.pSotto}>
              Quando si libera un posto in agenda, scade un credito o ti avvicini a un premio,
              lo trovi qui.
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenuto: { padding: spacing.md, paddingBottom: spacing.xxl },
  titolo: { ...typography.title, color: colors.textPrimary },
  sottotitolo: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.lg },
  spazio: { marginTop: spacing.sm },
  rigaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flashOra: { ...typography.label, color: colors.flash, fontFamily: fonts.w700, textTransform: 'capitalize' },
  flashTratt: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.xs },
  flashOp: { ...typography.caption, color: colors.textSecondary },
  prezzi: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.sm },
  prezzoVecchio: { ...typography.body, color: colors.textMuted, textDecorationLine: 'line-through' },
  prezzoNuovo: { ...typography.numero, fontSize: 20, color: colors.textPrimary },
  risparmio: { ...typography.caption, color: colors.success, fontFamily: fonts.w700 },
  propostaRiga: { flexDirection: 'row', gap: spacing.sm },
  icona: { fontSize: 22 },
  testi: { flex: 1 },
  pTitolo: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.w700 },
  pSotto: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
