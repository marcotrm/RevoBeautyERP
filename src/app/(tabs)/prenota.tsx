/**
 * Tab Prenota — il cliente prenota dall'app.
 *
 * Due passi soli (Servizio → Orario). Il cliente è già dentro con il suo
 * account: non gli si chiede né come si chiama né se è uomo o donna, il
 * listino giusto lo sceglie l'app dalla sua scheda.
 *
 * Le categorie sono riquadri con l'icona, non una fila di pillole: si guarda
 * "Unghie" e si tocca. E per "Con chi" si vedono le facce, non i cognomi —
 * solo le operatrici che quel lavoro lo sanno fare davvero (il collegamento
 * categoria/operatrice si imposta nel gestionale, in Staff).
 */
import { Image } from 'expo-image';
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

/** Nome e faccina di ogni categoria, nell'ordine in cui il centro le usa. */
const CATEGORIE: { key: string; label: string; emoji: string }[] = [
  { key: 'nails', label: 'Unghie', emoji: '💅' },
  { key: 'laser', label: 'Laser', emoji: '✨' },
  { key: 'waxing', label: 'Ceretta', emoji: '🪒' },
  { key: 'facial', label: 'Viso', emoji: '🧖' },
  { key: 'body', label: 'Corpo', emoji: '🌿' },
  { key: 'massage', label: 'Massaggi', emoji: '💆' },
  { key: 'makeup', label: 'Trucco', emoji: '💄' },
  { key: 'consultation', label: 'Consulenza', emoji: '📋' },
  { key: 'hair', label: 'Capelli', emoji: '💇' },
];
const metaCategoria = (c: string) =>
  CATEGORIE.find(x => x.key === c) || { key: c, label: c, emoji: '•' };

const GIORNI = [
  { n: 1, label: 'Lun' }, { n: 2, label: 'Mar' }, { n: 3, label: 'Mer' },
  { n: 4, label: 'Gio' }, { n: 5, label: 'Ven' }, { n: 6, label: 'Sab' },
];
const ORE = ['09:00', '11:00', '13:00', '15:00', '17:00'];

/** Una riga del carrello. */
type Scelta = { treatmentId: string; operatorId: string };

const dataLunga = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const iniziali = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export default function PrenotaScreen() {
  const { token, user } = useAuth();
  const [treatments, setTreatments] = useState<BookingTreatment[]>([]);
  const [operatrici, setOperatrici] = useState<BookingOperator[]>([]);

  /**
   * Il listino segue la scheda del cliente: se è entrato con il suo account,
   * chiederglielo di nuovo è solo una domanda in più a cui rispondere.
   */
  const gender: 'male' | 'female' = user?.gender === 'M' ? 'male' : 'female';

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

  /** Le categorie che hanno almeno un trattamento, nell'ordine di CATEGORIE. */
  const categorieDisponibili = useMemo(() => {
    const conteggio = new Map<string, number>();
    for (const t of treatments) conteggio.set(t.category, (conteggio.get(t.category) || 0) + 1);
    const note = CATEGORIE.filter(c => conteggio.has(c.key)).map(c => c.key);
    const altre = [...conteggio.keys()].filter(k => !note.includes(k));
    return [...note, ...altre].map(k => ({ ...metaCategoria(k), quante: conteggio.get(k) || 0 }));
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

  const aggiorna = (i: number, patch: Partial<Scelta>) => {
    const ns = [...scelte]; ns[i] = { ...ns[i], ...patch }; setScelte(ns); invalida();
  };

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
        {!!user?.nome && <Text style={styles.sottotitolo}>Ciao {user.nome}, cosa ti prepariamo?</Text>}

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
            {scelte.map((sc, i) => {
              const cat = categorie[i] || '';
              const t = treatments.find(x => x.id === sc.treatmentId);
              const chiuso = apertoIdx !== i && !!t;
              const op = operatrici.find(o => o.id === sc.operatorId);

              // Riga già compilata e chiusa: si mostra il riassunto
              if (chiuso && t) {
                return (
                  <Pressable key={i} style={styles.rigaChiusa} onPress={() => setApertoIdx(i)}>
                    <Text style={styles.rigaEmoji}>{metaCategoria(t.category).emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selName}>{t.name}</Text>
                      <Text style={styles.muted}>
                        {durOf(t)} min · {formatPrice(priceOf(t))} · {op ? op.nomeBreve : 'prima disponibile'}
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
                      <Pressable hitSlop={8} onPress={() => {
                        setScelte(scelte.filter((_, j) => j !== i));
                        setCategorie(categorie.filter((_, j) => j !== i));
                        setApertoIdx(0); invalida();
                      }}>
                        <Text style={styles.togli}>Togli</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* ------- categoria: riquadri, due per riga ------- */}
                  <Text style={styles.label}>Che cosa vuoi fare</Text>
                  <View style={styles.catGriglia}>
                    {categorieDisponibili.map(c => {
                      const on = cat === c.key;
                      return (
                        <Pressable key={c.key} style={[styles.catCard, on && styles.catCardOn]}
                          onPress={() => {
                            const nc = [...categorie]; nc[i] = on ? '' : c.key; setCategorie(nc);
                            aggiorna(i, { treatmentId: '', operatorId: '' });
                          }}>
                          <Text style={styles.catEmoji}>{c.emoji}</Text>
                          <Text style={[styles.catLabel, on && styles.catLabelOn]} numberOfLines={1}>{c.label}</Text>
                          <Text style={styles.catQuante}>{c.quante} trattament{c.quante === 1 ? 'o' : 'i'}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* ------- trattamento ------- */}
                  {!!cat && (
                    <>
                      <Text style={styles.label}>Scegli il trattamento</Text>
                      {treatments.filter(x => x.category === cat).map(x => {
                        const on = sc.treatmentId === x.id;
                        return (
                          <Pressable key={x.id} style={[styles.treatItem, on && styles.treatItemOn]}
                            onPress={() => aggiorna(i, { treatmentId: x.id, operatorId: '' })}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.treatName}>{x.name}</Text>
                              <Text style={styles.muted}>{durOf(x)} min</Text>
                            </View>
                            <Text style={[styles.treatPrezzo, on && styles.treatPrezzoOn]}>{formatPrice(priceOf(x))}</Text>
                          </Pressable>
                        );
                      })}
                    </>
                  )}

                  {/* ------- con chi: le facce ------- */}
                  {!!sc.treatmentId && (
                    <>
                      <Text style={styles.label}>Con chi</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.facce}>
                        <Faccia scelta={!sc.operatorId} nome="Chiunque" sottotitolo="la prima libera"
                          onPress={() => aggiorna(i, { operatorId: '' })} />
                        {operatrici.filter(o => o.categorie.includes(cat)).map(o => (
                          <Faccia key={o.id} scelta={sc.operatorId === o.id} nome={o.nomeBreve}
                            avatar={o.avatar} colore={o.colore}
                            onPress={() => aggiorna(i, { operatorId: o.id })} />
                        ))}
                      </ScrollView>

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
                {ORE.map(o => (
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

/** Il cerchio con la foto dell'operatrice (o le iniziali sul suo colore). */
function Faccia({ scelta, nome, sottotitolo, avatar, colore, onPress }: {
  scelta: boolean;
  nome: string;
  sottotitolo?: string;
  avatar?: string | null;
  colore?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.facciaBox} onPress={onPress}>
      <View style={[styles.facciaCerchio, { backgroundColor: colore || colors.backgroundAlt }, scelta && styles.facciaCerchioOn]}>
        {avatar
          ? <Image source={{ uri: avatar }} style={styles.facciaFoto} contentFit="cover" />
          : <Text style={[styles.facciaIniziali, !colore && { color: colors.textSecondary }]}>
              {colore ? iniziali(nome) : '✦'}
            </Text>}
      </View>
      <Text style={[styles.facciaNome, scelta && styles.facciaNomeOn]} numberOfLines={1}>{nome}</Text>
      {!!sottotitolo && <Text style={styles.facciaSotto} numberOfLines={1}>{sottotitolo}</Text>}
    </Pressable>
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
  sottotitolo: { ...typography.body, color: colors.textSecondary, marginTop: 2 },

  passi: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  passoLabel: { ...typography.label, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' },
  passoAttivo: { color: colors.primary },
  passoBarra: { height: 4, borderRadius: 999, backgroundColor: colors.border },
  passoBarraOn: { backgroundColor: colors.primary },

  blocco: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface },
  bloccoTitolo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bloccoTitoloTxt: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  togli: { ...typography.caption, color: colors.error, fontWeight: '700' },

  rigaChiusa: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface, marginTop: spacing.md },
  rigaEmoji: { fontSize: 22 },
  selName: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  change: { ...typography.caption, color: colors.primary, fontWeight: '700' },

  label: { ...typography.label, color: colors.primary, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase' },

  // categorie a riquadri
  catGriglia: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catCard: { width: '47.5%', flexGrow: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', gap: 2 },
  catCardOn: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  catEmoji: { fontSize: 24 },
  catLabel: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  catLabelOn: { color: colors.primaryDark },
  catQuante: { ...typography.caption, color: colors.textMuted, fontSize: 11 },

  treatItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs, backgroundColor: colors.background },
  treatItemOn: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  treatName: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  treatPrezzo: { ...typography.body, fontWeight: '800', color: colors.textSecondary },
  treatPrezzoOn: { color: colors.primaryDark },
  muted: { ...typography.caption, color: colors.textSecondary },

  // "con chi": la fila delle facce
  facce: { gap: spacing.md, paddingVertical: spacing.xs, paddingRight: spacing.md },
  facciaBox: { alignItems: 'center', width: 76 },
  facciaCerchio: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  facciaCerchioOn: { borderColor: colors.primary, borderWidth: 3 },
  facciaFoto: { width: '100%', height: '100%' },
  facciaIniziali: { ...typography.body, fontWeight: '800', color: colors.white, fontSize: 20 },
  facciaNome: { ...typography.caption, color: colors.textSecondary, fontWeight: '700', marginTop: 6 },
  facciaNomeOn: { color: colors.primaryDark },
  facciaSotto: { ...typography.caption, color: colors.textMuted, fontSize: 10 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipTxtOn: { color: '#fff' },

  fatto: { marginTop: spacing.md, alignSelf: 'flex-start', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.primary },
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
