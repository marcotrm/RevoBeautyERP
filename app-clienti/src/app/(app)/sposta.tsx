/**
 * Spostare un appuntamento: la richiesta più vera di tutte — "non ce la
 * faccio, posso venire giovedì?". Stessi trattamenti, si sceglie solo il
 * nuovo giorno e la nuova ora, con le date-poi-orari della prenotazione.
 *
 * Il posto vecchio non conta come occupato (ignoraAppointmentId): spostarsi
 * di un'ora nello stesso pomeriggio deve essere possibile.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { ApiError, appointmentsService, bookingService, GiornoDisponibile } from '@/api';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

const dataLunga = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

export default function SpostaScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const p = useLocalSearchParams<{ id: string; treatments: string; nome: string }>();
  const treatmentIds = String(p.treatments || '').split(',').filter(Boolean);

  const [giorni, setGiorni] = useState<GiornoDisponibile[] | null>(null);
  const [giornoSel, setGiornoSel] = useState<string | null>(null);
  const [oraSel, setOraSel] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [fatto, setFatto] = useState<{ data: string; ora: string } | null>(null);

  useEffect(() => {
    if (treatmentIds.length === 0) return;
    bookingService
      .search({
        services: treatmentIds.map((t) => ({ treatmentId: t, operatorId: null })),
        // La conferma vera ricontrolla col genere in anagrafica: qui serve
        // solo per la griglia, e il femminile è il caso del 95% del centro.
        gender: 'female',
        giorni: 21,
        ignoraAppointmentId: String(p.id || ''),
      })
      .then((g) => {
        const buoni = g.filter((x) => x.slots.length > 0);
        setGiorni(buoni);
        setGiornoSel(buoni[0]?.date ?? null);
      })
      .catch((e) => setErrore(e instanceof ApiError ? e.message : 'Ricerca non riuscita. Riprova.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const sposta = async () => {
    if (!token || !giornoSel || !oraSel || invio) return;
    setErrore(null);
    setInvio(true);
    try {
      await appointmentsService.move(token, String(p.id), giornoSel, oraSel);
      setFatto({ data: giornoSel, ora: oraSel });
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Spostamento non riuscito. Riprova.');
    } finally {
      setInvio(false);
    }
  };

  if (fatto) {
    return (
      <View style={styles.centro}>
        <Ionicons name="checkmark-circle" size={52} color={colors.success} />
        <Text style={styles.fattoTitolo}>Spostato! 🎉</Text>
        <Text style={styles.fattoTesto}>
          {p.nome ? `${p.nome}\n` : ''}Ci vediamo {dataLunga(fatto.data)} alle {fatto.ora}.
        </Text>
        <Button title="Torna ai miei appuntamenti" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const giornoAperto = giorni?.find((g) => g.date === giornoSel) ?? null;

  return (
    <ScrollView style={styles.sfondo} contentContainerStyle={styles.contenuto}>
      {p.nome ? <Text style={styles.cosa}>{p.nome}</Text> : null}
      <Text style={styles.spiega}>Scegli il nuovo giorno: il vecchio posto si libera da solo.</Text>

      <FormError message={errore} />

      {giorni === null && !errore ? (
        <View style={{ paddingVertical: spacing.xl }}><ActivityIndicator color={colors.primary} /></View>
      ) : giorni && giorni.length === 0 ? (
        <Text style={styles.vuoto}>
          Nessun posto libero nelle prossime tre settimane: scrivici in chat e lo troviamo insieme.
        </Text>
      ) : giorni ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.striscia}>
            {giorni.map((g) => {
              const d = new Date(`${g.date}T12:00:00`);
              const on = giornoSel === g.date;
              return (
                <Pressable key={g.date} style={[styles.giorno, on && styles.giornoOn]}
                  onPress={() => { setGiornoSel(g.date); setOraSel(null); }}>
                  <Text style={[styles.giornoSett, on && styles.giornoTxtOn]}>
                    {d.toLocaleDateString('it-IT', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.giornoNum, on && styles.giornoTxtOn]}>{d.getDate()}</Text>
                  <Text style={[styles.giornoSett, on && styles.giornoTxtOn]}>
                    {d.toLocaleDateString('it-IT', { month: 'short' })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {giornoAperto ? (
            <>
              <Text style={styles.titoloGiorno}>{dataLunga(giornoAperto.date)}</Text>
              <View style={styles.slots}>
                {giornoAperto.slots.map((s) => {
                  const on = oraSel === s.time;
                  return (
                    <Pressable key={s.time} style={[styles.slot, on && styles.slotOn]}
                      onPress={() => setOraSel(s.time)}>
                      <Text style={[styles.slotTxt, on && styles.slotTxtOn]}>{s.time}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Button
            title={invio ? 'Sposto…' : oraSel && giornoSel ? `Sposta a ${dataLunga(giornoSel)} · ${oraSel}` : 'Scegli giorno e orario'}
            onPress={() => void sposta()}
            loading={invio}
            disabled={!giornoSel || !oraSel}
            style={{ marginTop: spacing.lg }}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md,
  },
  fattoTitolo: { fontFamily: fonts.w800, fontSize: 22, color: colors.textPrimary },
  fattoTesto: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl },
  cosa: { fontFamily: fonts.w700, fontSize: 17, color: colors.textPrimary },
  spiega: { ...typography.caption, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  vuoto: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  striscia: { gap: spacing.xs, paddingVertical: spacing.xs },
  giorno: {
    width: 62, alignItems: 'center', paddingVertical: spacing.sm,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  giornoOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  giornoSett: { ...typography.caption, fontSize: 11, color: colors.textSecondary, textTransform: 'capitalize' },
  giornoNum: { fontFamily: fonts.w800, fontSize: 20, color: colors.textPrimary, marginVertical: 1 },
  giornoTxtOn: { color: colors.primaryDark },
  titoloGiorno: { ...typography.label, color: colors.primaryDark, marginTop: spacing.md, marginBottom: spacing.xs, textTransform: 'capitalize' },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  slot: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  slotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotTxt: { ...typography.label, color: colors.textPrimary },
  slotTxtOn: { color: colors.white, fontFamily: fonts.w700 },
});
