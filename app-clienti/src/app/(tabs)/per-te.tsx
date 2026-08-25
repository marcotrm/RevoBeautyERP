/**
 * "Cosa posso fare oggi": tutte le occasioni realmente disponibili.
 *
 * A differenza della Home, qui non si taglia niente: le proposte ci sono
 * tutte. Ma non pesano uguale.
 *
 * I Flash Slot sono l'unica cosa che scade davvero mentre la guardi — hanno un
 * conto alla rovescia — quindi sono gli unici a prendersi il colore, e non come
 * riquadro pieno ma come barretta a lato. Tutto il resto è una lista con righe
 * sottili: si scorre, si legge, si tocca.
 *
 * Prima erano tutte carte con bordo e ombra, ognuna col suo fondo colorato:
 * l'occasione da prendere al volo e il promemoria del pacchetto sembravano la
 * stessa cosa.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, homeService, type DatiHome, type FlashSlotApp, type Proposta } from '@/api';
import { Button } from '@/components/ui/Button';
import { Icona } from '@/components/ui/Icona';
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

/** "Oggi" o "28/08": in una riga stretta la data lunga non ci sta. */
function giorno(data: string): string {
  if (data === new Date().toISOString().slice(0, 10)) return 'Oggi';
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
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

  const apri = (p: Proposta) => {
    if (p.azione.tipo === 'percorso') router.push('/percorsi');
    else if (p.azione.tipo === 'referral') router.push('/invita');
    else if (p.azione.tipo === 'club') router.push('/club');
    else if (p.azione.tipo === 'wallet') router.push('/wallet');
    else router.push('/prenota');
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
  const quante = vivi.length + dati.proposte.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.contenuto}
        refreshControl={<RefreshControl refreshing={aggiornando} onRefresh={aggiorna} tintColor={colors.primary} />}
      >
        <Text style={styles.titolo}>Per te</Text>
        <Text style={styles.sottotitolo}>
          {quante === 0
            ? 'Al momento non c\'è niente in sospeso: sei in pari.'
            : `${quante} ${quante === 1 ? 'cosa che puoi fare' : 'cose che puoi fare'} adesso.`}
        </Text>

        {/* ── I posti liberati: l'unica cosa che scade mentre la guardi ── */}
        {vivi.map(s => {
          const restano = s.restanoSecondi - tick;
          return (
            <View key={s.id} style={styles.occasione}>
              <View style={styles.rigaTop}>
                <Text style={styles.occhielloFlash}>Si è appena liberato</Text>
                <Text style={styles.conto}>{conto(restano)}</Text>
              </View>
              <Text style={styles.occQuando}>{giorno(s.date)} alle {s.startTime}</Text>
              <Text style={styles.forte}>
                {s.treatmentName}
                {s.operatorName ? <Text style={styles.tenue}>{`  con ${s.operatorName}`}</Text> : null}
              </Text>
              <View style={styles.prezzi}>
                <Text style={styles.prezzoVecchio}>{eur(s.fullPrice)}</Text>
                <Text style={styles.prezzoNuovo}>{eur(s.price)}</Text>
                <Text style={styles.risparmio}>risparmi {eur(s.risparmio)}</Text>
              </View>
              <Button
                title={occupato === s.id ? 'Prenoto…' : 'Prendi questo posto'}
                onPress={() => prendi(s)}
                loading={occupato === s.id}
                style={styles.bottone}
              />
            </View>
          );
        })}

        {/* ── Tutto il resto: una lista, non una pila di riquadri ── */}
        {dati.proposte.length ? (
          <View style={styles.lista}>
            {dati.proposte.map(p => (
              <Pressable key={p.id} style={styles.riga} onPress={() => apri(p)}>
                <View style={styles.testi}>
                  <Text style={styles.forte}>{p.titolo}</Text>
                  <Text style={styles.piccolo}>{p.sottotitolo}</Text>
                </View>
                <Icona nome="freccia" misura={19} colore={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {quante === 0 ? (
          <Text style={styles.vuoto}>
            Quando si libera un posto in agenda, scade un credito o ti avvicini a un premio,
            lo trovi qui.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenuto: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  titolo: { ...typography.title, color: colors.textPrimary, marginTop: spacing.sm },
  sottotitolo: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginTop: 3 },

  // Barretta a lato invece del fondo pieno: si vede che è un'altra cosa senza
  // che la schermata diventi una vetrina di Natale.
  occasione: {
    marginTop: spacing.lg,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderLeftWidth: 2,
    borderLeftColor: colors.flash,
  },
  rigaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  occhielloFlash: { ...typography.occhiello, color: colors.flash },
  conto: { ...typography.captionForte, color: colors.flash, fontVariant: ['tabular-nums'] },
  occQuando: { fontFamily: fonts.serif600, fontSize: 24, color: colors.textPrimary, marginTop: spacing.xs },
  bottone: { marginTop: spacing.md },

  forte: { ...typography.bodyForte, color: colors.textPrimary, marginTop: 3 },
  tenue: { ...typography.body, color: colors.textSecondary },
  piccolo: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },

  prezzi: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.sm },
  prezzoVecchio: { ...typography.body, color: colors.textMuted, textDecorationLine: 'line-through' },
  prezzoNuovo: { ...typography.numero, fontSize: 20, color: colors.textPrimary },
  risparmio: { ...typography.captionForte, color: colors.success },

  lista: { marginTop: spacing.lg },
  riga: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  testi: { flex: 1 },

  vuoto: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xl, lineHeight: 24 },
});
