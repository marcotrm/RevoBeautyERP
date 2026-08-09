/**
 * Introduzione all'apertura dell'app, solo la prima volta.
 *
 * Serve a rispondere alla domanda che si fa chi ha appena installato: "cosa ci
 * faccio con questa?". Tre schermate, non di più: oltre la terza le si salta e
 * basta, e una introduzione saltata non ha spiegato niente.
 *
 * Sta prima dell'accesso di proposito. Chiedere il numero di telefono come
 * primissima cosa, senza aver detto cos'è l'app, è il modo più rapido per farla
 * disinstallare.
 *
 * "Salta" è sempre visibile: chi ha fretta deve poter arrivare al login in un
 * tocco, e trattenerlo a forza non lo convince.
 */
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Dimensions, NativeScrollEvent, NativeSyntheticEvent, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');

interface Pagina {
  icona: keyof typeof Ionicons.glyphMap;
  titolo: string;
  testo: string;
}

const PAGINE: Pagina[] = [
  {
    icona: 'calendar-outline',
    titolo: 'La tua agenda,\nsempre con te',
    testo: 'Prenoti quando ti fa comodo, vedi i tuoi appuntamenti e disdici senza dover chiamare.',
  },
  {
    icona: 'sparkles-outline',
    titolo: 'Quello che c\'è\nper te oggi',
    testo: 'Posti liberati all\'ultimo, sedute del tuo pacchetto ancora da fare, credito in scadenza. Niente offerte a caso: solo cose tue.',
  },
  {
    icona: 'gift-outline',
    titolo: 'Ogni visita\nvale qualcosa',
    testo: 'Accumuli punti e credito a ogni trattamento, sali di livello e porti le amiche guadagnandoci.',
  },
];

export default function IntroScreen() {
  const router = useRouter();
  const { concludiIntro } = useAuth();
  const [pagina, setPagina] = useState(0);
  const scroll = useRef<ScrollView>(null);

  const vaiAlLogin = async () => {
    await concludiIntro();
    router.replace('/login');
  };

  const avanti = () => {
    if (pagina >= PAGINE.length - 1) return void vaiAlLogin();
    const prossima = pagina + 1;
    setPagina(prossima);
    scroll.current?.scrollTo({ x: prossima * width, animated: true });
  };

  // La pagina si ricava dalla posizione: così vale sia lo scorrimento col dito
  // sia il tasto "Avanti", senza due stati che possono disallinearsi.
  const alloScorrimento = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== pagina) setPagina(p);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.testa}>
        <Text style={styles.marchio}>RevoBeauty</Text>
        <Pressable onPress={vaiAlLogin} hitSlop={12}>
          <Text style={styles.salta}>Salta</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={alloScorrimento}
        style={styles.scorrevole}
        contentContainerStyle={styles.scorrevoleContenuto}
      >
        {PAGINE.map((p, i) => (
          <View key={i} style={[styles.pagina, { width }]}>
            <View style={styles.cerchio}>
              <Ionicons name={p.icona} size={44} color={colors.primary} />
            </View>
            <Text style={styles.titolo}>{p.titolo}</Text>
            <Text style={styles.testo}>{p.testo}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.fondo}>
        <View style={styles.puntini}>
          {PAGINE.map((_, i) => (
            <View key={i} style={[styles.puntino, i === pagina && styles.puntinoAttivo]} />
          ))}
        </View>
        <Button title={pagina === PAGINE.length - 1 ? 'Inizia' : 'Avanti'} onPress={avanti} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  testa: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  marchio: { ...typography.subtitle, color: colors.primary, fontWeight: '700' },
  salta: { ...typography.label, color: colors.textSecondary },

  scorrevole: { flex: 1 },
  // Senza questo il contenuto resta appeso in cima: in uno ScrollView
  // orizzontale i figli non ereditano l'altezza, va chiesta esplicitamente.
  scorrevoleContenuto: { alignItems: 'stretch' },
  pagina: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  cerchio: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  titolo: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 34,
  },
  testo: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  fondo: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  puntini: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  puntino: {
    width: 8, height: 8, borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  puntinoAttivo: { backgroundColor: colors.primary, width: 22 },
});
