/**
 * Home dell'app clienti.
 *
 * Deve rispondere in tre secondi a "quando torno?". Tutto il resto viene dopo,
 * e viene piccolo.
 *
 * La versione precedente metteva nove riquadri uno sotto l'altro — appuntamento,
 * tre contatori, avanzamento del livello, un invito, tre proposte colorate,
 * i percorsi — ognuno col suo bordo e la sua ombra. Nessuno era sbagliato: erano
 * tutti allo stesso volume, e l'occhio non aveva un punto da cui partire.
 *
 * Adesso: un fatto grande (il prossimo appuntamento), una riga sottile per i
 * numeri che non sono urgenze, e **un solo accento colorato** — la cosa che si
 * perde se non la si guarda oggi. Le altre proposte vivono in "Per te", che è
 * la schermata fatta apposta: qui resta il conteggio e un tocco per arrivarci.
 */
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, beautyService, homeService, type DatiHome, type Proposta } from '@/api';
import { Icona } from '@/components/ui/Icona';
import { Progress } from '@/components/ui/Progress';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { useApiData } from '@/hooks/useApiData';
import { formatDate } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

const eur = (n: number) =>
  `${n.toLocaleString('it-IT', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} €`;

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const maiuscolaIniziale = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "Oggi", "Domani" o "Giovedì 28 agosto": come lo direbbe una persona. */
function quando(data: string): string {
  const d = new Date(`${data}T12:00:00`);
  const oggi = new Date();
  const differenza = Math.round(
    (d.getTime() - new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 12).getTime()) / 86400000
  );
  if (differenza === 0) return 'Oggi';
  if (differenza === 1) return 'Domani';
  if (differenza > 1 && differenza < 7) return maiuscolaIniziale(GIORNI[d.getDay()]);
  return `${maiuscolaIniziale(GIORNI[d.getDay()])} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

/** Giorni passati da una data ISO; null se la data manca o non si legge. */
function giorniDa(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/**
 * La proposta che merita il colore, se ce n'è una.
 *
 * Una sola: due barrette colorate in una schermata fatta di spazio bianco si
 * annullano a vicenda. Vince quella che fa perdere qualcosa se non la guardi
 * oggi — prima le scadenze, poi le occasioni a tempo.
 */
function piuUrgente(proposte: Proposta[]): { p: Proposta; colore: string } | null {
  const scadenza = proposte.find(p => p.tipo === 'scadenza');
  if (scadenza) return { p: scadenza, colore: colors.urgent };
  const flash = proposte.find(p => p.tipo === 'flash');
  if (flash) return { p: flash, colore: colors.flash };
  return null;
}

export default function HomeScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [dati, setDati] = useState<DatiHome | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [aggiornando, setAggiornando] = useState(false);
  const { data: score } = useApiData((t) => beautyService.score(t));
  const { data: autopilot } = useApiData((t) => beautyService.autopilot(t));

  const carica = useCallback(async () => {
    if (!token) return;
    try {
      setDati(await homeService.home(token));
      setErrore(null);
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Non riusciamo a caricare i tuoi dati.');
    }
  }, [token]);

  // Al rientro sulla scheda: se ha appena prenotato, la Home deve saperlo
  useFocusEffect(useCallback(() => { void carica(); }, [carica]));

  const aggiorna = async () => {
    setAggiornando(true);
    await carica();
    setAggiornando(false);
  };

  if (!dati && !errore) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const nome = dati?.user.nome ?? user?.nome ?? '';
  const app = dati?.prossimoAppuntamento;
  const proposte = dati?.proposte ?? [];
  const urgente = piuUrgente(proposte);
  const altre = (dati?.proposteTotali ?? 0) - (urgente ? 1 : 0);
  const percorso = dati?.percorsi?.[0];
  const centro = dati?.centro;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.contenuto}
        refreshControl={<RefreshControl refreshing={aggiornando} onRefresh={aggiorna} tintColor={colors.primary} />}
      >
        {/* ── Saluto + Score, una riga sola ── */}
        <View style={styles.testata}>
          <Text style={styles.saluto}>Ciao {nome}</Text>
          {score ? (
            <Pressable onPress={() => router.push('/score')} hitSlop={8}>
              <ScoreRing valore={score.totale} misura={46} spessore={4} />
            </Pressable>
          ) : null}
        </View>

        {errore ? <Text style={styles.errore}>{errore}</Text> : null}
        {dati?.messaggio ? <Text style={styles.messaggioTesto}>{dati.messaggio}</Text> : null}

        {/* ── UN fatto grande: appuntamento, oppure il prossimo step, oppure l'invito ── */}
        {(() => {
          const step = autopilot?.suggerimenti.find((s) => s.aperta);
          if (app) {
            return (
              <Pressable style={styles.hero} onPress={() => router.push('/appuntamenti')}>
                <Text style={styles.occhiello}>Il tuo prossimo appuntamento</Text>
                <Text style={styles.heroQuando}>{quando(app.date)} alle {app.startTime}</Text>
                <Text style={styles.heroCosa}>
                  {app.treatmentName}
                  {app.operatorName ? <Text style={styles.tenue}>{`  con ${app.operatorName}`}</Text> : null}
                </Text>
              </Pressable>
            );
          }
          if (step) {
            return (
              <Pressable style={styles.hero} onPress={() => router.push('/prenota')}>
                <Text style={styles.occhiello}>È il momento giusto per</Text>
                <Text style={styles.heroQuando}>{step.treatmentName}</Text>
                <Text style={styles.heroCosa}>
                  Tocca per vedere gli orari
                  <Text style={styles.tenue}>{`  · finestra fino al ${formatDate(step.finestraA)}`}</Text>
                </Text>
              </Pressable>
            );
          }
          return (
            <Pressable style={styles.hero} onPress={() => router.push('/prenota')}>
              <Text style={styles.occhiello}>
                {(giorniDa(dati?.ultimaVisita ?? null) ?? 0) > 30
                  ? 'È un po’ che non ci vediamo'
                  : 'Nessun appuntamento in programma'}
              </Text>
              <Text style={styles.heroQuando}>
                {(giorniDa(dati?.ultimaVisita ?? null) ?? 0) > 30 ? 'Ci manchi!' : 'Quando ci vediamo?'}
              </Text>
              <Text style={styles.heroCosa}>Tocca per prenotare</Text>
            </Pressable>
          );
        })()}

        {/* ── La tessera, in una riga: punti · credito · livello ── */}
        <Pressable style={styles.tessera} onPress={() => router.push('/wallet')}>
          <Text style={styles.tesseraTesto}>
            <Text style={styles.tesseraForte}>{dati?.punti ?? 0}</Text> punti
            {dati?.wallet ? (
              <Text> · <Text style={styles.tesseraForte}>{eur(dati.wallet.totale)}</Text> credito</Text>
            ) : null}
          </Text>
          {dati?.club?.attuale ? (
            <Text style={styles.tesseraLivello}>{dati.club.attuale.name}</Text>
          ) : null}
          <Icona nome="freccia" misura={17} colore={'rgba(255,255,255,0.6)'} />
        </Pressable>

        {/* ── Per te: una riga sola, con dentro la cosa urgente se c'è ── */}
        {urgente || altre > 0 ? (
          <Pressable style={styles.riga} onPress={() => router.push('/per-te')}>
            <View style={styles.rigaSinistra}>
              {urgente ? <View style={[styles.pallino, { backgroundColor: urgente.colore }]} /> : null}
              <Text style={styles.rigaTesto} numberOfLines={1}>
                {urgente ? urgente.p.titolo : 'Per te oggi'}
              </Text>
              {altre > 0 ? (
                <View style={styles.conta}><Text style={styles.contaNumero}>{altre}</Text></View>
              ) : null}
            </View>
            <Icona nome="freccia" misura={19} colore={colors.textMuted} />
          </Pressable>
        ) : null}

        {/* ── Il percorso aperto: uno, il primo ── */}
        {percorso ? (
          <Pressable style={styles.blocco} onPress={() => router.push('/percorsi')}>
            <View style={styles.rigaTraSpazi}>
              <Text style={styles.forte}>{percorso.nome}</Text>
              <Text style={styles.piccolo}>{percorso.fatte} di {percorso.totali}</Text>
            </View>
            <View style={styles.barra}>
              <Progress percentuale={(percorso.fatte / Math.max(percorso.totali, 1)) * 100} colore={percorso.colore} />
            </View>
          </Pressable>
        ) : null}

        {/* ── Promo e lavori del salone ── */}
        <Pressable style={styles.riga} onPress={() => router.push('/bacheca')}>
          <View style={styles.rigaSinistra}>
            <Ionicons name="images-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.rigaTesto}>Promo e lavori del salone</Text>
          </View>
          <Icona nome="freccia" misura={19} colore={colors.textMuted} />
        </Pressable>

        {/* ── Le azioni di ogni giorno ── */}
        <View style={styles.azioni}>
          {([
            { icona: 'calendar-outline', testo: 'Prenota', rotta: '/prenota' },
            { icona: 'pricetags-outline', testo: 'Listino', rotta: '/listino' },
            { icona: 'sparkles-outline', testo: 'Revo AI', rotta: '/assistente' },
            { icona: 'chatbubble-ellipses-outline', testo: 'Chat', rotta: '/chat' },
          ] as const).map((a) => (
            <Pressable key={a.rotta} style={styles.azione} onPress={() => router.push(a.rotta as never)}>
              <Ionicons name={a.icona} size={20} color={colors.primaryDark} />
              <Text style={styles.azioneTesto}>{a.testo}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── La sede: una riga discreta, tocca e si apre la mappa ── */}
        {centro?.indirizzo ? (
          <Pressable
            style={styles.sede}
            onPress={() =>
              Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(`${centro.nome} ${centro.indirizzo}`)}`)
            }
          >
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.sedeTesto}>
              {centro.indirizzo}
              {centro.orari ? ` · ${centro.orari}` : ''}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenuto: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  testata: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  saluto: { ...typography.title, fontSize: 22, color: colors.textSecondary },
  errore: { ...typography.label, color: colors.error, marginTop: spacing.sm },

  hero: { paddingTop: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  occhiello: { ...typography.occhiello, color: colors.textSecondary },
  // 40px: è l'unica cosa grande della schermata, e va letta con lo sguardo di
  // chi tiene il telefono in una mano sola mentre esce di casa.
  heroQuando: { fontFamily: fonts.serif700, fontSize: 26, lineHeight: 31, letterSpacing: -0.5, color: colors.textPrimary, marginTop: 6 },
  heroCosa: { ...typography.bodyForte, fontSize: 14.5, color: colors.textPrimary, marginTop: 6 },
  tenue: { ...typography.body, color: colors.textSecondary },

  messaggioTesto: { ...typography.caption, fontSize: 12.5, color: colors.primaryDark, marginTop: spacing.xs },

  // ── La tessera in una riga: scura, l'oggetto senza l'ingombro ──
  tessera: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  tesseraTesto: { ...typography.body, fontSize: 14.5, color: colors.white, opacity: 0.9, flex: 1 },
  tesseraForte: { fontFamily: fonts.serif600, fontSize: 17, color: colors.white },
  tesseraLivello: {
    ...typography.captionForte, fontSize: 10.5, letterSpacing: 1,
    color: colors.primaryLight, textTransform: 'uppercase',
  },
  pallino: { width: 8, height: 8, borderRadius: radius.full },

  riga: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm, paddingVertical: spacing.sm + 3,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
  },
  rigaSinistra: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rigaTesto: { ...typography.body, fontSize: 16, color: colors.textPrimary },
  conta: { width: 19, height: 19, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  contaNumero: { ...typography.captionForte, fontSize: 11, color: colors.white },

  blocco: { marginTop: spacing.md },
  rigaTraSpazi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  forte: { ...typography.bodyForte, color: colors.textPrimary, flex: 1 },
  piccolo: { ...typography.caption, color: colors.textSecondary },
  barra: { marginTop: spacing.sm },

  // ── Le tre azioni: contornate, alla pari. L'oro pieno resta alla tessera. ──
  azioni: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  azione: {
    flex: 1, alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  azioneTesto: { ...typography.labelForte, fontSize: 12, color: colors.textPrimary },

  // ── Il centro, come su un biglietto da visita ──
  sede: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing.md,
  },
  sedeTesto: { ...typography.caption, fontSize: 12.5, color: colors.textSecondary },
});
