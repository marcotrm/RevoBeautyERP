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
        <Text style={styles.saluto}>Ciao {nome}</Text>

        {errore ? <Text style={styles.errore}>{errore}</Text> : null}

        {/* ── Il messaggio del centro, quando c'è ── */}
        {dati?.messaggio ? (
          <View style={styles.messaggio}>
            <Text style={styles.messaggioTesto}>{dati.messaggio}</Text>
          </View>
        ) : null}

        {/* ── Il fatto grande ── */}
        {app ? (
          <Pressable style={styles.hero} onPress={() => router.push('/appuntamenti')}>
            <Text style={styles.occhiello}>Il tuo prossimo appuntamento</Text>
            <Text style={styles.heroQuando}>{quando(app.date)}{'\n'}alle {app.startTime}</Text>
            <Text style={styles.heroCosa}>
              {app.treatmentName}
              {app.operatorName ? <Text style={styles.tenue}>{`  con ${app.operatorName}`}</Text> : null}
            </Text>
          </Pressable>
        ) : (
          // Senza nulla in agenda il tono dipende da quanto è passato:
          // oltre un mese dall'ultima visita si dice, con affetto.
          <Pressable style={styles.hero} onPress={() => router.push('/prenota')}>
            <Text style={styles.occhiello}>
              {(giorniDa(dati?.ultimaVisita ?? null) ?? 0) > 30
                ? 'È un po’ che non ci vediamo'
                : 'Nessun appuntamento in programma'}
            </Text>
            <Text style={styles.heroQuando}>
              {(giorniDa(dati?.ultimaVisita ?? null) ?? 0) > 30 ? 'Ci manchi!' : 'Quando\nci vediamo?'}
            </Text>
            <Text style={styles.heroCosa}>Tocca per prenotare</Text>
          </Pressable>
        )}

        {/* ── La tessera fedeltà: punti, livello, credito ── */}
        <Pressable style={styles.carta} onPress={() => router.push('/wallet')}>
          <View style={styles.rigaTraSpazi}>
            <Text style={styles.cartaMarchio}>REVOBEAUTY</Text>
            {dati?.club?.attuale ? (
              <Text style={styles.cartaLivello}>{dati.club.attuale.name}</Text>
            ) : null}
          </View>
          <Text style={styles.cartaNome}>{`${nome} ${dati?.user.cognome ?? ''}`.trim()}</Text>
          <View style={styles.cartaNumeri}>
            <View>
              <Text style={styles.cartaValore}>{dati?.punti ?? 0}</Text>
              <Text style={styles.cartaEtichetta}>punti</Text>
            </View>
            {dati?.wallet ? (
              <View>
                <Text style={styles.cartaValore}>{eur(dati.wallet.totale)}</Text>
                <Text style={styles.cartaEtichetta}>credito</Text>
              </View>
            ) : null}
            {score ? (
              <Pressable style={styles.cartaRing} onPress={() => router.push('/score')} hitSlop={6}>
                <ScoreRing valore={score.totale} misura={62} spessore={5} suScuro />
                <Text style={styles.cartaEtichetta}>Revo Score</Text>
              </Pressable>
            ) : null}
          </View>
          {dati?.club?.prossimo ? (
            <View style={styles.cartaBarra}>
              <View style={styles.cartaBarraFondo}>
                <View
                  style={[
                    styles.cartaBarraPieno,
                    { width: `${Math.min(Math.max(dati.club.avanzamento, 0), 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.cartaProssimo}>
                {eur(dati.club.prossimo.mancaSpesa)} al livello {dati.club.prossimo.name}
              </Text>
            </View>
          ) : null}
        </Pressable>

        {/* ── Il prossimo step: la finestra aperta dell'Autopilot ── */}
        {(() => {
          const step = autopilot?.suggerimenti.find((s) => s.aperta);
          if (!step) return null;
          return (
            <Pressable style={styles.step} onPress={() => router.push('/prenota')}>
              <Text style={styles.stepOcchiello}>IL TUO PROSSIMO STEP</Text>
              <Text style={styles.stepTitolo}>{step.treatmentName}</Text>
              <Text style={styles.stepDettaglio}>
                Di solito ogni {step.ogniGiorni} giorni · finestra ideale fino al {formatDate(step.finestraA)}
              </Text>
              <Text style={styles.stepAzione}>Vedi gli orari →</Text>
            </Pressable>
          );
        })()}

        {/* ── L'unico accento: quello che si perde se non lo guardi ── */}
        {urgente ? (
          <Pressable
            style={[styles.avviso, { borderLeftColor: urgente.colore }]}
            onPress={() => router.push('/per-te')}
          >
            <Text style={[styles.avvisoTitolo, { color: urgente.colore }]}>{urgente.p.titolo}</Text>
            <Text style={styles.piccolo}>{urgente.p.sottotitolo}</Text>
          </Pressable>
        ) : null}

        {/* ── Tutto il resto sta in "Per te" ── */}
        {altre > 0 ? (
          <Pressable style={styles.riga} onPress={() => router.push('/per-te')}>
            <View style={styles.rigaSinistra}>
              <Text style={styles.rigaTesto}>Per te oggi</Text>
              <View style={styles.conta}><Text style={styles.contaNumero}>{altre}</Text></View>
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

        {/* ── Le tre azioni di ogni giorno ── */}
        <View style={styles.azioni}>
          {([
            { icona: 'calendar-outline', testo: 'Prenota', rotta: '/prenota' },
            { icona: 'pricetags-outline', testo: 'Listino', rotta: '/listino' },
            { icona: 'sparkles-outline', testo: 'Revo AI', rotta: '/assistente' },
            { icona: 'chatbubble-ellipses-outline', testo: 'Scrivici', rotta: '/contatti' },
          ] as const).map((a) => (
            <Pressable key={a.rotta} style={styles.azione} onPress={() => router.push(a.rotta as never)}>
              <Ionicons name={a.icona} size={22} color={colors.primaryDark} />
              <Text style={styles.azioneTesto}>{a.testo}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Il centro, in fondo: dove siamo e quando ── */}
        {centro && (centro.indirizzo || centro.telefono || centro.orari) ? (
          <View style={styles.sede}>
            <Text style={styles.centroNome}>{centro.nome || 'RevoBeauty'}</Text>
            {centro.orari ? (
              <View style={styles.centroRiga}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.centroTesto}>{centro.orari}</Text>
              </View>
            ) : null}
            {centro.indirizzo ? (
              <Pressable
                style={styles.centroRiga}
                onPress={() =>
                  Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(`${centro.nome} ${centro.indirizzo}`)}`)
                }
              >
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.centroTesto, styles.centroLink]}>{centro.indirizzo}</Text>
              </Pressable>
            ) : null}
            {centro.telefono ? (
              <Pressable
                style={styles.centroRiga}
                onPress={() => Linking.openURL(`tel:${centro.telefono.replace(/\s/g, '')}`)}
              >
                <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.centroTesto, styles.centroLink]}>{centro.telefono}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenuto: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  saluto: { ...typography.title, fontSize: 22, color: colors.textSecondary, marginTop: spacing.sm },
  errore: { ...typography.label, color: colors.error, marginTop: spacing.sm },

  hero: { paddingTop: spacing.lg, paddingBottom: spacing.lg + 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  occhiello: { ...typography.occhiello, color: colors.textSecondary },
  // 40px: è l'unica cosa grande della schermata, e va letta con lo sguardo di
  // chi tiene il telefono in una mano sola mentre esce di casa.
  heroQuando: { fontFamily: fonts.serif600, fontSize: 40, lineHeight: 44, letterSpacing: -0.8, color: colors.textPrimary, marginTop: spacing.sm },
  heroCosa: { ...typography.bodyForte, color: colors.textPrimary, marginTop: spacing.md },
  tenue: { ...typography.body, color: colors.textSecondary },

  messaggio: {
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  messaggioTesto: { ...typography.body, fontSize: 14, color: colors.primaryDark },

  // ── La tessera: scura, con l'oro del brand. È l'oggetto, non un riquadro. ──
  carta: {
    marginTop: spacing.lg,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cartaMarchio: { fontFamily: fonts.serif600, fontSize: 15, letterSpacing: 2.5, color: colors.primaryLight },
  cartaLivello: { ...typography.captionForte, color: colors.primaryLight, textTransform: 'uppercase', letterSpacing: 1 },
  cartaNome: { ...typography.body, color: colors.white, opacity: 0.85, marginTop: spacing.md, textTransform: 'capitalize' },
  cartaNumeri: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md },
  cartaValore: { fontFamily: fonts.serif600, fontSize: 28, color: colors.white },
  cartaEtichetta: { ...typography.caption, color: colors.white, opacity: 0.6 },
  cartaRing: { marginLeft: 'auto', alignItems: 'center', gap: 2 },
  cartaBarra: { marginTop: spacing.md },

  // ── Il prossimo step (Autopilot): l'unico blocco che si prende l'oro ──
  step: {
    marginTop: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  stepOcchiello: { ...typography.captionForte, fontSize: 10.5, letterSpacing: 1.5, color: colors.primaryDark },
  stepTitolo: { ...typography.subtitle, fontSize: 18, color: colors.textPrimary, marginTop: 4 },
  stepDettaglio: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  stepAzione: { ...typography.labelForte, color: colors.primaryDark, marginTop: spacing.sm },
  cartaBarraFondo: { height: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  cartaBarraPieno: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  cartaProssimo: { ...typography.caption, color: colors.white, opacity: 0.6, marginTop: spacing.xs },

  avviso: { marginTop: spacing.lg, paddingVertical: spacing.sm + 2, paddingLeft: spacing.md, borderLeftWidth: 2 },
  avvisoTitolo: { ...typography.bodyForte },

  riga: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
  },
  rigaSinistra: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rigaTesto: { ...typography.body, fontSize: 16, color: colors.textPrimary },
  conta: { width: 19, height: 19, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  contaNumero: { ...typography.captionForte, fontSize: 11, color: colors.white },

  blocco: { marginTop: spacing.lg },
  rigaTraSpazi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  forte: { ...typography.bodyForte, color: colors.textPrimary, flex: 1 },
  piccolo: { ...typography.caption, color: colors.textSecondary },
  barra: { marginTop: spacing.sm },

  // ── Le tre azioni: contornate, alla pari. L'oro pieno resta alla tessera. ──
  azioni: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  azione: {
    flex: 1, alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  azioneTesto: { ...typography.labelForte, fontSize: 13, color: colors.textPrimary },

  // ── Il centro, come su un biglietto da visita ──
  sede: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  centroNome: { ...typography.occhiello, color: colors.textSecondary },
  centroRiga: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  centroTesto: { ...typography.body, fontSize: 14, color: colors.textSecondary },
  centroLink: { color: colors.primaryDark },
});
