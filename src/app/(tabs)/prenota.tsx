/**
 * Tab Prenota — il cliente prenota dall'app, con lo stesso sistema della
 * pagina web: più trattamenti nella stessa seduta, ognuno con l'operatrice
 * voluta (o la prima disponibile), e la ricerca degli orari per giorni della
 * settimana e fascia oraria.
 *
 * Due passi soli (Servizio → Orario): il cliente è già loggato, i suoi dati
 * non li deve reinserire.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError, BookingOperator, BookingResult, BookingSlot, BookingTreatment,
  GiornoDisponibile, bookingService,
} from '@/api';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, spacing, typography } from '@/theme';
import { formatPrice } from '@/utils/format';

const CATEGORIE: Record<string, string> = {
  facial: 'Viso', body: 'Corpo', laser: 'Laser / Epilazione', massage: 'Massaggi',
  nails: 'Unghie', waxing: 'Ceretta', consultation: 'Consulenza', hair: 'Capelli', makeup: 'Trucco',
};
const GIORNI = [
  { n: 1, label: 'Lun' }, { n: 2, label: 'Mar' }, { n: 3, label: 'Mer' },
  { n: 4, label: 'Gio' }, { n: 5, label: 'Ven' }, { n: 6, label: 'Sab' },
];
const ORE = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];

/** Una riga del carrello. */
type Scelta = { treatmentId: string; operatorId: string };

const dataLunga = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

export default function PrenotaScreen() {
  const { token, user } = useAuth();
  const [treatments, setTreatments] = useState<BookingTreatment[]>([]);
  const [operatrici, setOperatrici] = useState<BookingOperator[]>([]);
  const [gender, setGender] = useState<'female' | 'male'>(user?.gender === 'M' ? 'male' : 'female');

  // passo 1 — carrello
  const [scelte, setScelte] = useState<Scelta[]>([{ treatmentId: '', operatorId: '' }]);
  const [categorie, setCategorie] = useState<string[]>(['']);
  const [apertoIdx, setApertoIdx] = useState(0);

  // passo 2 — filtri e orari
  const [giorniOk, setGiorniOk] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [oraDa, setOraDa] = useState('09:00');
  const [giorni, setGiorni] = useState<GiornoDisponibile[] | null>(null);
  const [cercando, setCercando] = useState(false);
  const [scelto, setScelto] = useState<{ date: string; slot: BookingSlot } | null>(null);

  const [passo, setPasso] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingResult | null>(null);

  useEffect(() => {
    bookingService.treatments().then(setTreatments).catch(() => {});
    bookingService.operators().then(setOperatrici).catch(() => {});
  }, []);

  const priceOf = useCallback((t: BookingTreatment) =>
    gender === 'male' ? (t.priceMale ?? t.priceFemale ?? t.price) : (t.priceFemale ?? t.price), [gender]);
  const durOf = useCallback((t: BookingTreatment) =>
    gender === 'male' ? (t.durationMale ?? t.durationFemale ?? t.duration) : (t.durationFemale ?? t.duration), [gender]);

  const categorieDisponibili = useMemo(() => {
    const set = [...new Set(treatments.map(t => t.category))];
    return set.sort((a, b) => (CATEGORIE[a] || a).localeCompare(CATEGORIE[b] || b));
  }, [treatments]);

  const sceltePiene = scelte.filter(s => s.treatmentId);
  const totaleDurata = sceltePiene.reduce((s, x) => {
    const t = treatments.find(t => t.id === x.treatmentId); return s + (t ? durOf(t) : 0);
  }, 0);
  const totalePrezzo = sceltePiene.reduce((s, x) => {
    const t = treatments.find(t => t.id === x.treatmentId); return s + (t ? priceOf(t) : 0);
  }, 0);

  /** Toccati i trattamenti, gli orari trovati prima non valgono più. */
  const invalida = () => { setGiorni(null); setScelto(null); };

  const cerca = async () => {
    setCercando(true); setError(null); setScelto(null);
    try {
      const g = await bookingService.search({
        services: sceltePiene.map(s => ({ treatmentId: s.treatmentId, operatorId: s.operatorId || null })),
        gender, giorniSettimana: giorniOk, from: oraDa, giorni: 21,
      });
      setGiorni(g);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ricerca non riuscita. Riprova.');
    } finally { setCercando(false); }
  };

  const submit = async () => {
    if (!scelto || !token) return;
    setSubmitting(true); setError(null);
    try {
      const res = await bookingService.book(token, {
        date: scelto.date, startTime: scelto.slot.time, gender,
        services: sceltePiene.map(s => ({ treatmentId: s.treatmentId, operatorId: s.operatorId || null })),
      });
      setDone(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Prenotazione non riuscita. Riprova.');
    } finally { setSubmitting(false); }
  };

  const reset = () => {
    setDone(null); setScelte([{ treatmentId: '', operatorId: '' }]); setCategorie(['']);
    setApertoIdx(0); setGiorni(null); setScelto(null); setPasso(1);
  };

  // ------------------------------------------------------------- fatto
  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <View style={styles.check}><Text style={styles.checkTxt}>✓</Text></View>
          <Text style={styles.doneTitle}>Prenotazione confermata!</Text>
          <View style={styles.summary}>
            <Row k="Quando" v={`${dataLunga(done.date)} · ${done.startTime}`} />
            {(done.servizi || []).map((sv, i) => (
              <Row key={i} k={`${sv.orario} · ${sv.nome}`} v={sv.operatrice} />
            ))}
            {!done.servizi?.length && <Row k="Trattamento" v={done.treatmentName} />}
            <Row k="Totale" v={formatPrice(done.price)} />
          </View>
          <Button title="Prenota un altro appuntamento" variant="secondary" onPress={reset} />
        </View>
      </SafeAreaView>
    );
  }

  // ------------------------------------------------------------ wizard
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Prenota</Text>

        <View style={styles.passi}>
          {([[1, 'Servizio'], [2, 'Orario']] as const).map(([n, label]) => (
            <View key={n} style={{ flex: 1 }}>
              <Text style={[styles.passoLabel, passo >= n && styles.passoAttivo]}>{label}</Text>
              <View style={[styles.passoBarra, passo >= n && styles.passoBarraOn]} />
            </View>
          ))}
        </View>

        {passo === 1 && (
          <>
            <View style={styles.genderRow}>
              {(['female', 'male'] as const).map(g => (
                <Pressable key={g} style={[styles.gender, gender === g && styles.genderActive]}
                  onPress={() => { setGender(g); invalida(); }}>
                  <Text style={[styles.genderTxt, gender === g && styles.genderTxtActive]}>
                    {g === 'female' ? '♀ Donna' : '♂ Uomo'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {scelte.map((sc, i) => {
              const cat = categorie[i] || '';
              const t = treatments.find(x => x.id === sc.treatmentId);
              const chiuso = apertoIdx !== i && !!t;
              const op = operatrici.find(o => o.id === sc.operatorId);

              // Riga già compilata e chiusa: si mostra il riassunto
              if (chiuso && t) {
                return (
                  <Pressable key={i} style={styles.rigaChiusa} onPress={() => setApertoIdx(i)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selName}>{t.name}</Text>
                      <Text style={styles.muted}>
                        {durOf(t)} min · {formatPrice(priceOf(t))} · {op ? op.nome : 'prima disponibile'}
                      </Text>
                    </View>
                    <Text style={styles.change}>Cambia</Text>
                  </Pressable>
                );
              }

              return (
                <View key={i} style={styles.blocco}>
                  {scelte.length > 1 && (
                    <View style={styles.bloccoTitolo}>
                      <Text style={styles.bloccoTitoloTxt}>Trattamento {i + 1}</Text>
                      <Pressable onPress={() => {
                        setScelte(scelte.filter((_, j) => j !== i));
                        setCategorie(categorie.filter((_, j) => j !== i));
                        setApertoIdx(0); invalida();
                      }}>
                        <Text style={styles.togli}>Togli</Text>
                      </Pressable>
                    </View>
                  )}

                  <Text style={styles.label}>Categoria</Text>
                  <View style={styles.chips}>
                    {categorieDisponibili.map(c => (
                      <Pressable key={c} style={[styles.chip, cat === c && styles.chipOn]}
                        onPress={() => {
                          const nc = [...categorie]; nc[i] = c; setCategorie(nc);
                          const ns = [...scelte]; ns[i] = { ...ns[i], treatmentId: '' }; setScelte(ns);
                          invalida();
                        }}>
                        <Text style={[styles.chipTxt, cat === c && styles.chipTxtOn]}>{CATEGORIE[c] || c}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {!!cat && (
                    <>
                      <Text style={styles.label}>Trattamento</Text>
                      {treatments.filter(x => x.category === cat).map(x => (
                        <Pressable key={x.id} style={[styles.treatItem, sc.treatmentId === x.id && styles.treatItemOn]}
                          onPress={() => {
                            const ns = [...scelte]; ns[i] = { ...ns[i], treatmentId: x.id }; setScelte(ns);
                            invalida();
                          }}>
                          <Text style={styles.treatName}>{x.name}</Text>
                          <Text style={styles.muted}>{durOf(x)}min · {formatPrice(priceOf(x))}</Text>
                        </Pressable>
                      ))}
                    </>
                  )}

                  {!!sc.treatmentId && (
                    <>
                      <Text style={styles.label}>Con chi</Text>
                      <View style={styles.chips}>
                        <Pressable style={[styles.chip, !sc.operatorId && styles.chipOn]}
                          onPress={() => {
                            const ns = [...scelte]; ns[i] = { ...ns[i], operatorId: '' }; setScelte(ns); invalida();
                          }}>
                          <Text style={[styles.chipTxt, !sc.operatorId && styles.chipTxtOn]}>La prima disponibile</Text>
                        </Pressable>
                        {operatrici.map(o => (
                          <Pressable key={o.id} style={[styles.chip, sc.operatorId === o.id && styles.chipOn]}
                            onPress={() => {
                              const ns = [...scelte]; ns[i] = { ...ns[i], operatorId: o.id }; setScelte(ns); invalida();
                            }}>
                            <Text style={[styles.chipTxt, sc.operatorId === o.id && styles.chipTxtOn]}>{o.nome}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable style={styles.fatto} onPress={() => setApertoIdx(-1)}>
                        <Text style={styles.fattoTxt}>Fatto</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              );
            })}

            <Pressable style={styles.aggiungi} onPress={() => {
              setScelte([...scelte, { treatmentId: '', operatorId: '' }]);
              setCategorie([...categorie, '']);
              setApertoIdx(scelte.length);
              invalida();
            }}>
              <Text style={styles.aggiungiTxt}>+ Aggiungi un altro trattamento</Text>
            </Pressable>

            {sceltePiene.length > 0 && (
              <View style={styles.totale}>
                <Text style={styles.muted}>
                  {sceltePiene.length} trattament{sceltePiene.length === 1 ? 'o' : 'i'} · {totaleDurata} min
                </Text>
                <Text style={styles.totaleVal}>{formatPrice(totalePrezzo)}</Text>
              </View>
            )}

            <Button title="Avanti" disabled={sceltePiene.length === 0}
              onPress={() => { setPasso(2); if (!giorni) void cerca(); }}
              style={{ marginTop: spacing.lg }} />
          </>
        )}

        {passo === 2 && (
          <>
            <View style={styles.blocco}>
              <Text style={styles.label}>Quali giorni ti vanno bene</Text>
              <View style={styles.chips}>
                {GIORNI.map(g => {
                  const on = giorniOk.includes(g.n);
                  return (
                    <Pressable key={g.n} style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setGiorniOk(on ? giorniOk.filter(x => x !== g.n) : [...giorniOk, g.n])}>
                      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{g.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Da che ora</Text>
              <View style={styles.chips}>
                {ORE.slice(0, -1).map(o => (
                  <Pressable key={o} style={[styles.chip, oraDa === o && styles.chipOn]} onPress={() => setOraDa(o)}>
                    <Text style={[styles.chipTxt, oraDa === o && styles.chipTxtOn]}>dalle {o}</Text>
                  </Pressable>
                ))}
              </View>

              <Button title={cercando ? 'Cerco…' : 'Cerca gli orari liberi'}
                onPress={cerca} disabled={cercando || giorniOk.length === 0}
                style={{ marginTop: spacing.md }} />
            </View>

            {cercando ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : giorni === null ? null : giorni.length === 0 ? (
              <Text style={styles.muted}>Nessun orario libero con questi filtri. Prova ad allargare i giorni o la fascia oraria.</Text>
            ) : giorni.map(g => (
              <View key={g.date} style={{ marginTop: spacing.md }}>
                <Text style={styles.giornoTitolo}>{dataLunga(g.date)}</Text>
                <View style={styles.slots}>
                  {g.slots.map(sl => {
                    const on = scelto?.date === g.date && scelto.slot.time === sl.time;
                    return (
                      <Pressable key={sl.time} style={[styles.slot, on && styles.slotActive]}
                        onPress={() => setScelto({ date: g.date, slot: sl })}>
                        <Text style={[styles.slotTxt, on && styles.slotTxtActive]}>{sl.time}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {scelto && (
              <View style={styles.riepilogo}>
                <Text style={styles.riepilogoTitolo}>
                  {dataLunga(scelto.date)} · {scelto.slot.time}
                </Text>
                {(scelto.slot.assegnazioni || []).map((a, i) => (
                  <Text key={i} style={styles.muted}>{a.startTime} · {a.treatmentName} con {a.operatorName}</Text>
                ))}
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <Button title="← Indietro" variant="secondary" onPress={() => setPasso(1)} style={{ flex: 1 }} />
              <Button
                title={submitting ? 'Prenotazione…' : `Conferma · ${formatPrice(totalePrezzo)}`}
                onPress={submit} disabled={!scelto || submitting} style={{ flex: 2 }} />
            </View>
          </>
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

  passi: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  passoLabel: { ...typography.label, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' },
  passoAttivo: { color: colors.primary },
  passoBarra: { height: 4, borderRadius: 999, backgroundColor: colors.border },
  passoBarraOn: { backgroundColor: colors.primary },

  genderRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  gender: { flex: 1, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  genderActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderTxt: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  genderTxtActive: { color: '#fff' },

  blocco: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface },
  bloccoTitolo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bloccoTitoloTxt: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  togli: { ...typography.caption, color: colors.error, fontWeight: '700' },

  rigaChiusa: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface, marginTop: spacing.md },
  selName: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  change: { ...typography.caption, color: colors.primary, fontWeight: '700' },

  label: { ...typography.label, color: colors.primary, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipTxtOn: { color: '#fff' },

  treatItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  treatItemOn: { borderColor: colors.primary, borderWidth: 1.5 },
  treatName: { ...typography.body, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  muted: { ...typography.caption, color: colors.textSecondary },

  fatto: { marginTop: spacing.md, alignSelf: 'flex-start', paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.primary },
  fattoTxt: { ...typography.caption, color: '#fff', fontWeight: '700' },

  aggiungi: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center' },
  aggiungiTxt: { ...typography.body, color: colors.primary, fontWeight: '700' },
  totale: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  totaleVal: { ...typography.body, fontWeight: '800', color: colors.textPrimary },

  giornoTitolo: { ...typography.body, fontWeight: '800', color: colors.textPrimary, textTransform: 'capitalize', marginBottom: spacing.sm },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minWidth: 68, alignItems: 'center' },
  slotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotTxt: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  slotTxtActive: { color: '#fff' },

  riepilogo: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface, gap: 2 },
  riepilogoTitolo: { ...typography.body, fontWeight: '800', color: colors.textPrimary, textTransform: 'capitalize', marginBottom: 4 },

  error: { ...typography.caption, color: colors.error, marginTop: spacing.md },
  check: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  checkTxt: { color: '#fff', fontSize: 30 },
  doneTitle: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  summary: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  rowVal: { ...typography.body, color: colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right', textTransform: 'capitalize' },
});
