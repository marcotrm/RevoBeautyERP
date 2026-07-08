/**
 * Tab Prenota — il cliente prenota un appuntamento dall'app.
 * Riusa trattamenti/disponibilità del gestionale; è già loggato, quindi
 * non deve reinserire i propri dati.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, BookingResult, BookingSlot, BookingTreatment, bookingService } from '@/api';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, spacing, typography } from '@/theme';
import { formatPrice } from '@/utils/format';

function nextDays(n: number) {
  const out: { value: string; label: string }[] = [];
  const fmt = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    const value = new Intl.DateTimeFormat('en-CA').format(d);
    out.push({ value, label: i === 0 ? 'Oggi' : i === 1 ? 'Domani' : fmt.format(d) });
  }
  return out;
}

export default function PrenotaScreen() {
  const { token, user } = useAuth();
  const [treatments, setTreatments] = useState<BookingTreatment[]>([]);
  const [gender, setGender] = useState<'female' | 'male'>(user?.gender === 'M' ? 'male' : 'female');
  const [query, setQuery] = useState('');
  const [treatment, setTreatment] = useState<BookingTreatment | null>(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<BookingSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingResult | null>(null);

  const days = useMemo(() => nextDays(21), []);

  useEffect(() => {
    bookingService.treatments().then(setTreatments).catch(() => {});
  }, []);

  const loadSlots = useCallback(() => {
    if (!treatment || !date) { setSlots([]); return; }
    setLoadingSlots(true); setSlot(null);
    bookingService.availability(date, treatment.id, gender)
      .then(setSlots).catch(() => setSlots([])).finally(() => setLoadingSlots(false));
  }, [treatment, date, gender]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const priceOf = (t: BookingTreatment) => gender === 'male' ? (t.priceMale ?? t.priceFemale ?? t.price) : (t.priceFemale ?? t.price);
  const durOf = (t: BookingTreatment) => gender === 'male' ? (t.durationMale ?? t.durationFemale ?? t.duration) : (t.durationFemale ?? t.duration);
  const filtered = query.trim() ? treatments.filter(t => t.name.toLowerCase().includes(query.toLowerCase())) : treatments;

  const submit = async () => {
    if (!treatment || !slot || !token) return;
    setSubmitting(true); setError(null);
    try {
      const res = await bookingService.book(token, { treatmentId: treatment.id, date, startTime: slot.time, operatorId: slot.operatorId, gender });
      setDone(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Prenotazione non riuscita. Riprova.');
    } finally { setSubmitting(false); }
  };

  const reset = () => { setDone(null); setTreatment(null); setDate(''); setSlot(null); setQuery(''); };

  if (done) {
    const d = new Date(done.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <View style={styles.check}><Text style={styles.checkTxt}>✓</Text></View>
          <Text style={styles.doneTitle}>Prenotazione confermata!</Text>
          <View style={styles.summary}>
            <Row k="Trattamento" v={done.treatmentName} />
            <Row k="Quando" v={`${d} · ${done.startTime}`} />
            <Row k="Con" v={done.operatorName} />
            <Row k="Prezzo" v={formatPrice(done.price)} />
          </View>
          <Button title="Prenota un altro appuntamento" variant="secondary" onPress={reset} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Prenota</Text>
        <Text style={styles.sub}>Scegli trattamento, giorno e orario.</Text>

        <View style={styles.genderRow}>
          <Pressable style={[styles.gender, gender === 'female' && styles.genderActive]} onPress={() => setGender('female')}>
            <Text style={[styles.genderTxt, gender === 'female' && styles.genderTxtActive]}>♀ Donna</Text>
          </Pressable>
          <Pressable style={[styles.gender, gender === 'male' && styles.genderActive]} onPress={() => setGender('male')}>
            <Text style={[styles.genderTxt, gender === 'male' && styles.genderTxtActive]}>♂ Uomo</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>1 · Trattamento</Text>
        {treatment ? (
          <View style={styles.selected}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selName}>{treatment.name}</Text>
              <Text style={styles.muted}>{durOf(treatment)} min · {formatPrice(priceOf(treatment))}</Text>
            </View>
            <Pressable onPress={() => { setTreatment(null); setSlot(null); }}><Text style={styles.change}>Cambia</Text></Pressable>
          </View>
        ) : (
          <>
            <TextInput style={styles.input} placeholder="Cerca un trattamento…" placeholderTextColor={colors.textSecondary} value={query} onChangeText={setQuery} />
            <View>
              {filtered.slice(0, 30).map(t => (
                <Pressable key={t.id} style={styles.treatItem} onPress={() => { setTreatment(t); setQuery(''); }}>
                  <Text style={styles.treatName}>{t.name}</Text>
                  <Text style={styles.muted}>{durOf(t)}min · {formatPrice(priceOf(t))}</Text>
                </Pressable>
              ))}
              {filtered.length === 0 && <Text style={styles.muted}>Nessun trattamento trovato</Text>}
            </View>
          </>
        )}

        {treatment && (
          <>
            <Text style={styles.label}>2 · Giorno</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {days.map(dd => (
                <Pressable key={dd.value} style={[styles.day, date === dd.value && styles.dayActive]} onPress={() => setDate(dd.value)}>
                  <Text style={[styles.dayTxt, date === dd.value && styles.dayTxtActive]}>{dd.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {treatment && date && (
          <>
            <Text style={styles.label}>3 · Orario</Text>
            {loadingSlots ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
              : slots.length === 0 ? <Text style={styles.muted}>Nessun orario disponibile. Prova un altro giorno.</Text>
              : (
                <View style={styles.slots}>
                  {slots.map(s => (
                    <Pressable key={s.time} style={[styles.slot, slot?.time === s.time && styles.slotActive]} onPress={() => setSlot(s)}>
                      <Text style={[styles.slotTxt, slot?.time === s.time && styles.slotTxtActive]}>{s.time}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {treatment && date && slot && (
          <Button
            title={submitting ? 'Prenotazione…' : `Conferma · ${formatPrice(priceOf(treatment))}`}
            onPress={submit}
            disabled={submitting}
            style={{ marginTop: spacing.lg }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{k}</Text>
      <Text style={styles.rowVal}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.primary },
  sub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  genderRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  gender: { flex: 1, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  genderActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderTxt: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  genderTxtActive: { color: '#fff' },
  label: { ...typography.label, color: colors.primary, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase' },
  input: { ...typography.body, color: colors.textPrimary, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  treatItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.xs },
  treatName: { ...typography.body, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  selected: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface },
  selName: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  change: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  muted: { ...typography.caption, color: colors.textSecondary },
  day: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayTxt: { ...typography.caption, color: colors.textPrimary, fontWeight: '600', textTransform: 'capitalize' },
  dayTxtActive: { color: '#fff' },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minWidth: 68, alignItems: 'center' },
  slotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotTxt: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  slotTxtActive: { color: '#fff' },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.md },
  check: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  checkTxt: { color: '#fff', fontSize: 30 },
  doneTitle: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  summary: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowVal: { ...typography.body, color: colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right', textTransform: 'capitalize' },
});
