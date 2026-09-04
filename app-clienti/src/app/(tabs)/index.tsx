/**
 * Home dell'app clienti — la scena, non il cruscotto.
 *
 * Le versioni prima impilavano riquadri: tutto allo stesso volume, nessun
 * punto da cui partire. Questa ha UNA scena: un sipario scuro nero/oro con
 * il saluto e il prossimo appuntamento in grande — la risposta a "quando
 * torno?" arriva prima ancora di mettere a fuoco. Sotto, poche righe chiare
 * su avorio: l'azione di oggi, il percorso, due scorciatoie. Fine.
 *
 * Il wow non è un fuoco d'artificio: è il sipario che si alza (fade + salita
 * di 24pt all'apertura) e il contrasto fra il nero profondo e la luce dorata.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator, Animated, Image, Linking, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, beautyService, homeService, type DatiHome, type Proposta } from '@/api';
import { Progress } from '@/components/ui/Progress';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';
import { formatDate } from '@/utils/format';

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

/** Il saluto giusto per l'ora: un dettaglio che fa "pensata per me". */
function saluto(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Notte fonda';
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

/** Giorni passati da una data ISO; null se la data manca o non si legge. */
function giorniDa(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/** La proposta che merita attenzione oggi, se c'è: prima le scadenze. */
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

  // ── Il sipario: la scena sale di 24pt e appare, una volta sola ──
  const entrata = useRef(new Animated.Value(0)).current;
  const entrato = useRef(false);
  useEffect(() => {
    if (!dati || entrato.current) return;
    entrato.current = true;
    Animated.timing(entrata, { toValue: 1, duration: 650, useNativeDriver: true }).start();
  }, [dati, entrata]);
  const scena = {
    opacity: entrata,
    transform: [{ translateY: entrata.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };
  const sotto = {
    opacity: entrata.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
    transform: [{ translateY: entrata.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
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
  const step = autopilot?.suggerimenti.find(s => s.aperta);
  const proposte = dati?.proposte ?? [];
  const urgente = piuUrgente(proposte);
  const altre = (dati?.proposteTotali ?? 0) - (urgente ? 1 : 0);
  const estetico = dati?.percorsoEstetico;
  const pacchetto = dati?.percorsi?.[0];
  const centro = dati?.centro;
  const manca = (giorniDa(dati?.ultimaVisita ?? null) ?? 0) > 30;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.contenuto}
        refreshControl={<RefreshControl refreshing={aggiornando} onRefresh={aggiorna} tintColor={colors.primary} />}
      >
        {/* ════ LA SCENA: nero profondo, luce dorata ════ */}
        <Animated.View style={scena}>
          <LinearGradient
            colors={['#26221A', '#161513', '#0F0E0C']}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.7, y: 1 }}
            style={styles.sipario}
          >
            {/* saluto + volto */}
            <View style={styles.siparioTesta}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.salutoPiccolo}>{saluto()},</Text>
                <Text style={styles.salutoNome} numberOfLines={1}>{nome} ✨</Text>
              </View>
              <Pressable onPress={() => router.push('/profilo')} hitSlop={6}>
                {dati?.user.avatar ? (
                  <Image source={{ uri: dati.user.avatar }} style={styles.faccia} />
                ) : (
                  <View style={styles.facciaVuota}>
                    <Text style={styles.facciaIniziali}>
                      {`${nome[0] ?? ''}${dati?.user.cognome?.[0] ?? ''}`.toUpperCase()}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* il fatto grande */}
            {app ? (
              <Pressable onPress={() => router.push('/appuntamenti')}>
                <Text style={styles.occhiello}>IL TUO PROSSIMO APPUNTAMENTO</Text>
                <Text style={styles.grande}>{quando(app.date)}</Text>
                <Text style={styles.grandeOra}>alle {app.startTime}</Text>
                <Text style={styles.grandeSotto} numberOfLines={1}>
                  {app.treatmentName}{app.operatorName ? `  ·  con ${app.operatorName}` : ''}
                </Text>
              </Pressable>
            ) : step ? (
              <Pressable onPress={() => router.push('/prenota')}>
                <Text style={styles.occhiello}>È IL MOMENTO GIUSTO PER</Text>
                <Text style={styles.grande} numberOfLines={2}>{step.treatmentName}</Text>
                <Text style={styles.grandeSotto}>Finestra ideale fino al {formatDate(step.finestraA)}</Text>
              </Pressable>
            ) : (
              <View>
                <Text style={styles.occhiello}>{manca ? 'CI MANCHI!' : 'NESSUN APPUNTAMENTO'}</Text>
                <Text style={styles.grande}>Quando ci{'\n'}vediamo?</Text>
              </View>
            )}

            {/* il gesto: un solo bottone d'oro */}
            {/* il gesto: il bottone d'oro, sempre, a tutta larghezza */}
            {app ? (
              <Pressable style={styles.dettagli} onPress={() => router.push('/appuntamenti')} hitSlop={6}>
                <Text style={styles.dettagliTxt}>Vedi i dettagli →</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.bottoneOro} onPress={() => router.push('/prenota')}>
              <Text style={styles.bottoneOroTxt}>Prenota il tuo momento</Text>
              <Ionicons name="arrow-forward" size={17} color="#161513" />
            </Pressable>

            {/* i numeri: perle sulla stoffa, non riquadri */}
            <View style={styles.perle}>
              <Pressable style={styles.perla} onPress={() => router.push('/wallet')}>
                <Text style={styles.perlaValore}>{dati?.punti ?? 0}</Text>
                <Text style={styles.perlaLabel}>punti</Text>
              </Pressable>
              <View style={styles.perlaDiv} />
              <Pressable style={styles.perla} onPress={() => router.push('/wallet')}>
                <Text style={styles.perlaValore}>{eur(dati?.wallet?.totale ?? 0)}</Text>
                <Text style={styles.perlaLabel}>credito</Text>
              </Pressable>
              <View style={styles.perlaDiv} />
              <Pressable style={styles.perla} onPress={() => router.push('/club')}>
                <Text style={styles.perlaValore}>{dati?.club?.attuale?.name ?? '—'}</Text>
                <Text style={styles.perlaLabel}>livello</Text>
              </Pressable>
              {score ? (
                <>
                  <View style={styles.perlaDiv} />
                  <Pressable style={styles.perla} onPress={() => router.push('/score')}>
                    <Text style={styles.perlaValore}>{score.totale}</Text>
                    <Text style={styles.perlaLabel}>score</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ════ SOTTO IL SIPARIO: poche righe, tanta aria ════ */}
        <Animated.View style={sotto}>
          {errore ? <Text style={styles.errore}>{errore}</Text> : null}
          {dati?.messaggio ? <Text style={styles.messaggio}>{dati.messaggio}</Text> : null}

          {/* l'azione di oggi, se c'è: UNA riga */}
          {app?.preparazione ? (
            <Pressable style={styles.riga} onPress={() => router.push('/appuntamenti')}>
              <Text style={styles.rigaEmoji}>🌿</Text>
              <Text style={styles.rigaTesto} numberOfLines={1}>Preparati al tuo appuntamento</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
          {urgente || altre > 0 ? (
            <Pressable style={styles.riga} onPress={() => router.push('/per-te')}>
              {urgente
                ? <View style={[styles.pallino, { backgroundColor: urgente.colore }]} />
                : <Text style={styles.rigaEmoji}>💛</Text>}
              <Text style={styles.rigaTesto} numberOfLines={1}>
                {urgente ? urgente.p.titolo : 'Per te oggi'}
              </Text>
              {altre > 0 ? <View style={styles.conta}><Text style={styles.contaTxt}>{altre}</Text></View> : null}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}

          {/* il percorso: una card sola, la più importante */}
          {estetico ? (
            <Pressable style={styles.percorso} onPress={() => router.push('/risultati')}>
              <Text style={styles.percorsoOcchiello}>IL TUO PERCORSO</Text>
              <View style={styles.percorsoRiga}>
                <Text style={styles.percorsoNome} numberOfLines={1}>{estetico.nome}</Text>
                <Text style={styles.percorsoConte}>{estetico.seduteFatte}<Text style={styles.percorsoDi}> / {estetico.seduteTotali}</Text></Text>
              </View>
              <View style={styles.percorsoBarra}>
                <Progress percentuale={(estetico.seduteFatte / Math.max(estetico.seduteTotali, 1)) * 100} colore={colors.primary} />
              </View>
              <Text style={styles.percorsoSotto} numberOfLines={1}>{estetico.obiettivo}</Text>
            </Pressable>
          ) : pacchetto ? (
            <Pressable style={styles.percorso} onPress={() => router.push('/percorsi')}>
              <Text style={styles.percorsoOcchiello}>IL TUO PERCORSO</Text>
              <View style={styles.percorsoRiga}>
                <Text style={styles.percorsoNome} numberOfLines={1}>{pacchetto.nome}</Text>
                <Text style={styles.percorsoConte}>{pacchetto.fatte}<Text style={styles.percorsoDi}> / {pacchetto.totali}</Text></Text>
              </View>
              <View style={styles.percorsoBarra}>
                <Progress percentuale={(pacchetto.fatte / Math.max(pacchetto.totali, 1)) * 100} colore={pacchetto.colore} />
              </View>
            </Pressable>
          ) : null}

          {/* tre porte, non un corridoio di tasti */}
          <View style={styles.porte}>
            <Pressable style={styles.porta} onPress={() => router.push('/appuntamenti')}>
              <Ionicons name="calendar-outline" size={19} color={colors.primaryDark} />
              <Text style={styles.portaTxt}>Appuntamenti</Text>
            </Pressable>
            <Pressable style={styles.porta} onPress={() => router.push('/risultati')}>
              <Ionicons name="leaf-outline" size={19} color={colors.primaryDark} />
              <Text style={styles.portaTxt}>Risultati</Text>
            </Pressable>
            <Pressable style={styles.porta} onPress={() => router.push('/assistente')}>
              <Ionicons name="sparkles-outline" size={19} color={colors.primaryDark} />
              <Text style={styles.portaTxt}>Revo AI</Text>
            </Pressable>
          </View>

          {/* la sede: una firma in fondo, tocca e si apre la mappa */}
          {centro?.indirizzo ? (
            <Pressable
              style={styles.sede}
              onPress={() =>
                Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(`${centro.nome} ${centro.indirizzo}`)}`)
              }
            >
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.sedeTxt}>
                {centro.indirizzo}{centro.orari ? ` · ${centro.orari}` : ''}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ORO_CHIARO = '#E7D5A4';
const ORO_TENUE = 'rgba(231, 213, 164, 0.55)';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenuto: { padding: spacing.md, paddingBottom: spacing.xxl },

  // ── la scena ──
  sipario: {
    borderRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  siparioTesta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  salutoPiccolo: { ...typography.caption, fontSize: 13, color: ORO_TENUE },
  salutoNome: { fontFamily: fonts.w800, fontSize: 24, color: '#FFFFFF', marginTop: 1 },
  faccia: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: ORO_TENUE },
  facciaVuota: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: ORO_TENUE,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)',
  },
  facciaIniziali: { fontFamily: fonts.w800, fontSize: 15, color: ORO_CHIARO },

  occhiello: { ...typography.captionForte, fontSize: 10, letterSpacing: 1.6, color: ORO_TENUE, marginBottom: 6 },
  grande: { fontFamily: fonts.w800, fontSize: 34, lineHeight: 38, color: '#FFFFFF' },
  grandeOra: { fontFamily: fonts.w800, fontSize: 34, lineHeight: 38, color: ORO_CHIARO },
  grandeSotto: { ...typography.body, fontSize: 14.5, color: 'rgba(255,255,255,0.75)', marginTop: 6 },

  dettagli: { alignSelf: 'flex-start', marginTop: spacing.xs },
  dettagliTxt: { ...typography.labelForte, fontSize: 13.5, color: ORO_CHIARO },
  bottoneOro: {
    // A tutta larghezza e ben alto: è IL gesto della Home, ora che Prenota
    // non ha più la sua scheda nella barra.
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'stretch',
    backgroundColor: colors.primaryLight ?? '#CBB06A',
    borderRadius: radius.full, paddingVertical: 15,
    marginTop: spacing.lg,
    shadowColor: '#E7D5A4', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  bottoneOroTxt: { ...typography.labelForte, fontSize: 16, color: '#161513' },

  perle: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(231,213,164,0.25)',
    marginTop: spacing.lg, paddingTop: spacing.sm + 2,
  },
  perla: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  perlaValore: { fontFamily: fonts.w800, fontSize: 15, color: '#FFFFFF' },
  perlaLabel: { ...typography.caption, fontSize: 10.5, color: ORO_TENUE, marginTop: 1 },
  perlaDiv: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: 'rgba(231,213,164,0.25)' },

  // ── sotto ──
  errore: { ...typography.caption, color: colors.urgent, marginTop: spacing.md, textAlign: 'center' },
  messaggio: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },

  riga: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm + 3, paddingHorizontal: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    marginTop: spacing.xs,
  },
  rigaEmoji: { fontSize: 14 },
  rigaTesto: { ...typography.body, fontSize: 14.5, color: colors.textPrimary, flex: 1 },
  pallino: { width: 8, height: 8, borderRadius: radius.full },
  conta: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  contaTxt: { fontFamily: fonts.w700, fontSize: 11, color: colors.primaryDark },

  percorso: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md,
  },
  percorsoOcchiello: { ...typography.captionForte, fontSize: 10, letterSpacing: 1.4, color: colors.textSecondary },
  percorsoRiga: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginTop: 4 },
  percorsoNome: { fontFamily: fonts.w700, fontSize: 16, color: colors.textPrimary, flex: 1 },
  percorsoConte: { fontFamily: fonts.w800, fontSize: 16, color: colors.primaryDark },
  percorsoDi: { fontFamily: fonts.w600, fontSize: 12, color: colors.textSecondary },
  percorsoBarra: { marginTop: spacing.sm },
  percorsoSotto: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },

  porte: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  porta: {
    // In colonna: tre porte in fila coi testi accanto alle icone non ci
    // stanno su uno schermo piccolo senza andare a capo.
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: colors.primarySoft, borderRadius: radius.lg, paddingVertical: spacing.md,
  },
  portaTxt: { ...typography.labelForte, fontSize: 12.5, color: colors.primaryDark },

  sede: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    marginTop: spacing.xl,
  },
  sedeTxt: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
});
