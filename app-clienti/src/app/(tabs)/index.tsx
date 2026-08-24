/**
 * Home dell'app clienti.
 *
 * Deve rispondere in tre secondi a "cosa c'è per me": quando torno, quanto ho,
 * cosa sto per perdere. Per questo l'ordine è quello e non un altro — prima il
 * prossimo appuntamento (la cosa che si viene a controllare più spesso), poi
 * punti e credito, poi le proposte vere, in fondo i percorsi aperti.
 *
 * Le proposte arrivano già ordinate dal server per urgenza reale: qui non si
 * riordina niente, si dipinge soltanto.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ApiError, homeService, type DatiHome, type Proposta } from '@/api';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Progress } from '@/components/ui/Progress';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

const eur = (n: number) =>
  `${n.toLocaleString('it-IT', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} €`;

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const maiuscolaIniziale = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "oggi", "domani" o "giovedì 14 agosto": come lo direbbe una persona. */
function quando(data: string): string {
  const d = new Date(`${data}T12:00:00`);
  const oggi = new Date();
  const differenza = Math.round((d.getTime() - new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 12).getTime()) / 86400000);
  if (differenza === 0) return 'oggi';
  if (differenza === 1) return 'domani';
  if (differenza > 1 && differenza < 7) return GIORNI[d.getDay()];
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

/** Colore e icona di una proposta, secondo cosa rappresenta. */
function vestito(tipo: Proposta['tipo']) {
  switch (tipo) {
    case 'scadenza': return { tone: 'urgent' as const, colore: colors.urgent };
    case 'flash': return { tone: 'flash' as const, colore: colors.flash };
    case 'premio': return { tone: 'reward' as const, colore: colors.reward };
    case 'percorso': return { tone: 'primary' as const, colore: colors.primaryDark };
    case 'club': return { tone: 'surface' as const, colore: colors.secondary };
    default: return { tone: 'surface' as const, colore: colors.primary };
  }
}

export default function HomeScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [dati, setDati] = useState<DatiHome | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [aggiornando, setAggiornando] = useState(false);

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

  const apri = (p: Proposta) => {
    switch (p.azione.tipo) {
      case 'flash': router.push('/per-te'); break;
      case 'wallet': router.push('/wallet'); break;
      case 'percorso': router.push('/percorsi'); break;
      case 'premio': router.push('/per-te'); break;
      case 'referral': router.push('/invita'); break;
      case 'club': router.push('/club'); break;
      case 'challenge': router.push('/per-te'); break;
      default: router.push('/prenota');
    }
  };

  if (!dati && !errore) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const nome = dati?.user.nome ?? user?.nome ?? '';
  const prima = dati?.proposte[0];
  const altre = dati?.proposte.slice(1) ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.contenuto}
        refreshControl={<RefreshControl refreshing={aggiornando} onRefresh={aggiorna} tintColor={colors.primary} />}
      >
        {/* ── Saluto ── */}
        <Text style={styles.saluto}>Ciao {nome}</Text>
        {dati?.messaggio ? <Text style={styles.messaggio}>{dati.messaggio}</Text> : null}

        {errore ? <Card tone="urgent"><Text style={styles.errore}>{errore}</Text></Card> : null}

        {/* ── Prossimo appuntamento ── */}
        {dati?.prossimoAppuntamento ? (
          <Card tone="primary" onPress={() => router.push('/appuntamenti')} style={styles.spazio}>
            <Text style={styles.etichetta}>Il tuo prossimo appuntamento</Text>
            <Text style={styles.appQuando}>
              {maiuscolaIniziale(quando(dati.prossimoAppuntamento.date))} alle {dati.prossimoAppuntamento.startTime}
            </Text>
            <Text style={styles.appTratt}>{dati.prossimoAppuntamento.treatmentName}</Text>
            <Text style={styles.appOperatrice}>con {dati.prossimoAppuntamento.operatorName}</Text>
          </Card>
        ) : (
          <Card onPress={() => router.push('/prenota')} style={styles.spazio}>
            <Text style={styles.etichetta}>Nessun appuntamento in programma</Text>
            <View style={styles.rigaAzione}>
              <Text style={styles.azioneTesto}>Prenota il prossimo</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primary} />
            </View>
          </Card>
        )}

        {/* ── Punti, credito, livello ── */}
        <View style={styles.trioRiga}>
          <Card style={styles.trio} onPress={() => router.push('/wallet')}>
            <Text style={styles.trioNumero}>{dati?.punti ?? 0}</Text>
            <Text style={styles.trioEtichetta}>Beauty Points</Text>
          </Card>
          {dati?.wallet ? (
            <Card style={styles.trio} onPress={() => router.push('/wallet')}>
              <Text style={styles.trioNumero}>{eur(dati.wallet.totale)}</Text>
              <Text style={styles.trioEtichetta}>Beauty Credit</Text>
            </Card>
          ) : null}
          {dati?.club?.attuale ? (
            <Card style={styles.trio} onPress={() => router.push('/club')}>
              <View style={[styles.pallino, { backgroundColor: dati.club.attuale.color }]} />
              <Text style={styles.trioEtichetta}>{dati.club.attuale.name}</Text>
            </Card>
          ) : null}
        </View>

        {/* ── Avanzamento verso il livello successivo ── */}
        {dati?.club?.prossimo ? (
          <Card style={styles.spazio} onPress={() => router.push('/club')}>
            <View style={styles.rigaTraSpazi}>
              <Text style={styles.etichetta}>Verso {dati.club.prossimo.name}</Text>
              <Text style={styles.piccolo}>{dati.club.avanzamento}%</Text>
            </View>
            <View style={styles.spazioMini}>
              <Progress percentuale={dati.club.avanzamento} colore={dati.club.prossimo.color} alta />
            </View>
            <Text style={styles.piccolo}>
              Ti mancano {eur(dati.club.prossimo.mancaSpesa)} per {dati.club.prossimo.name}
            </Text>
          </Card>
        ) : null}

        {/* ── Cosa posso fare oggi ── */}
        {(dati?.proposteTotali ?? 0) > 0 ? (
          <Pressable onPress={() => router.push('/per-te')} style={styles.cta}>
            <Text style={styles.ctaTitolo}>✨ Cosa posso fare oggi?</Text>
            <Text style={styles.ctaSotto}>
              Abbiamo trovato {dati!.proposteTotali} {dati!.proposteTotali === 1 ? 'opportunità' : 'opportunità'} per te
            </Text>
          </Pressable>
        ) : null}

        {/* ── Per te oggi ── */}
        {prima ? (
          <>
            <Text style={styles.titoloSezione}>Per te oggi</Text>
            {[prima, ...altre].map(p => {
              const v = vestito(p.tipo);
              return (
                <Card key={p.id} tone={v.tone} onPress={() => apri(p)} style={styles.spazioMini}>
                  <View style={styles.propostaRiga}>
                    <Text style={styles.propostaIcona}>{p.icona}</Text>
                    <View style={styles.propostaTesti}>
                      <Text style={styles.propostaTitolo}>{p.titolo}</Text>
                      <Text style={styles.propostaSotto}>{p.sottotitolo}</Text>
                      <Text style={[styles.propostaAzione, { color: v.colore }]}>{p.azione.label} →</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}

        {/* ── Percorsi aperti ── */}
        {dati?.percorsi.length ? (
          <>
            <Text style={styles.titoloSezione}>I tuoi percorsi</Text>
            {dati.percorsi.map(p => (
              <Card key={p.id} onPress={() => router.push('/percorsi')} style={styles.spazioMini}>
                <View style={styles.rigaTraSpazi}>
                  <Text style={styles.percorsoNome}>{p.nome}</Text>
                  <Chip testo={`${p.residue} ${p.residue === 1 ? 'rimasta' : 'rimaste'}`} />
                </View>
                <View style={styles.spazioMini}>
                  <Progress percentuale={(p.fatte / Math.max(p.totali, 1)) * 100} colore={p.colore} />
                </View>
                <Text style={styles.piccolo}>{p.fatte} di {p.totali} sedute</Text>
              </Card>
            ))}
          </>
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

  saluto: { ...typography.title, color: colors.textPrimary, marginTop: spacing.sm },
  messaggio: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  errore: { ...typography.label, color: colors.error },

  spazio: { marginTop: spacing.md },
  spazioMini: { marginTop: spacing.sm },

  etichetta: { ...typography.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fonts.w700 },
  appQuando: { ...typography.subtitle, color: colors.primaryDark, marginTop: spacing.xs },
  appTratt: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.w600 },
  appOperatrice: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  rigaAzione: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  azioneTesto: { ...typography.body, color: colors.primary, fontFamily: fonts.w700 },

  trioRiga: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  trio: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  // Cifra, non titolo: Montserrat tabellare, così non balla quando cambia.
  trioNumero: { ...typography.numero, color: colors.textPrimary },
  trioEtichetta: { ...typography.caption, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  pallino: { width: 18, height: 18, borderRadius: 9, marginBottom: 4 },

  rigaTraSpazi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  piccolo: { ...typography.caption, color: colors.textSecondary },

  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  ctaTitolo: { ...typography.subtitle, color: colors.white },
  ctaSotto: { ...typography.caption, color: colors.primaryLight, marginTop: 2 },

  titoloSezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.lg },

  propostaRiga: { flexDirection: 'row', gap: spacing.sm },
  propostaIcona: { fontSize: 22 },
  propostaTesti: { flex: 1 },
  propostaTitolo: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.w700 },
  propostaSotto: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  propostaAzione: { ...typography.label, fontFamily: fonts.w700, marginTop: spacing.sm },

  percorsoNome: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.w600, flex: 1 },

  fondo: { height: spacing.xl },
});
