/**
 * Tab Prenota — il cliente prenota dall'app.
 *
 * Due passi soli (Servizio → Orario). Il cliente è già dentro con il suo
 * account: non gli si chiede né come si chiama né se è uomo o donna, il
 * listino giusto lo sceglie l'app dalla sua scheda.
 *
 * La regola di tutta la schermata è una sola: quello che hai già scelto si
 * chiude e diventa una riga, quello che devi scegliere adesso sta in cima.
 * Prima le tre domande stavano una sotto l'altra e restavano aperte: con
 * quarantatré trattamenti nel Laser, per arrivare a "Con chi" bisognava
 * scorrere tutto il listino — e per confermare l'orario, scorrere di nuovo.
 */
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError, BookingOperator, BookingResult, BookingSlot, BookingTreatment,
  GiornoDisponibile, bookingService,
} from '@/api';
import { Button } from '@/components/ui/Button';
import { Icona, NomeIcona } from '@/components/ui/Icona';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';
import { formatPrice } from '@/utils/format';

/**
 * Nome e icona di ogni categoria, nell'ordine in cui il centro le usa.
 *
 * Le emoji di prima erano quelle del telefono: cambiano faccia su ogni
 * sistema e non hanno niente a che vedere col marchio. Queste sono disegnate
 * nella stessa famiglia delle icone delle schede.
 */
const CATEGORIE: { key: string; label: string; icona: NomeIcona }[] = [
  { key: 'nails', label: 'Unghie', icona: 'unghie' },
  { key: 'laser', label: 'Laser', icona: 'laser' },
  { key: 'waxing', label: 'Ceretta', icona: 'ceretta' },
  { key: 'facial', label: 'Viso', icona: 'viso' },
  { key: 'body', label: 'Corpo', icona: 'corpo' },
  { key: 'massage', label: 'Massaggi', icona: 'massaggi' },
  { key: 'makeup', label: 'Trucco', icona: 'trucco' },
  { key: 'consultation', label: 'Consulenza', icona: 'consulenza' },
  { key: 'hair', label: 'Capelli', icona: 'capelli' },
];
const metaCategoria = (c: string): { key: string; label: string; icona: NomeIcona } =>
  CATEGORIE.find(x => x.key === c) || { key: c, label: c, icona: 'generico' };

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

  const scrollRef = useRef<ScrollView>(null);
  /** Numero della ricerca in corso: le risposte vecchie non scrivono più. */
  const ricercaId = useRef(0);

  const suSu = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), []);

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

  /** Chi sa fare una certa categoria: sotto le due, non c'è niente da scegliere. */
  const operatriciDi = useCallback(
    (cat: string) => operatrici.filter(o => o.categorie.includes(cat)),
    [operatrici],
  );

  const sceltePiene = scelte.filter(s => s.treatmentId);
  const totaleDurata = sceltePiene.reduce((s, x) => {
    const t = treatments.find(t => t.id === x.treatmentId); return s + (t ? durOf(t) : 0);
  }, 0);
  const totalePrezzo = sceltePiene.reduce((s, x) => {
    const t = treatments.find(t => t.id === x.treatmentId); return s + (t ? priceOf(t) : 0);
  }, 0);

  /** Toccati i trattamenti, gli orari trovati prima non valgono più. */
  const invalida = () => { ricercaId.current++; setGiorni(null); setScelto(null); };

  const aggiorna = (i: number, patch: Partial<Scelta>) => {
    const ns = [...scelte]; ns[i] = { ...ns[i], ...patch }; setScelte(ns); invalida();
  };

  /**
   * La ricerca degli orari.
   *
   * Prima stava dietro al tasto "Cerca gli orari liberi" e i filtri non la
   * rifacevano: si sceglieva "dalle 15:00" e sotto restavano gli orari della
   * mattina, cercati all'ingresso nel passo con il filtro di partenza. Adesso
   * ogni cambio di filtro la rilancia, e la risposta vecchia che arriva tardi
   * viene buttata invece di sovrascrivere quella giusta.
   */
  const cerca = useCallback(async (da: string, gg: number[], servizi: Scelta[]) => {
    if (servizi.length === 0 || gg.length === 0) { setGiorni(null); return; }
    const mio = ++ricercaId.current;
    setCercando(true); setError(null); setScelto(null);
    try {
      const g = await bookingService.search({
        services: servizi.map(s => ({ treatmentId: s.treatmentId, operatorId: s.operatorId || null })),
        gender, giorniSettimana: gg, from: da, giorni: 21,
      });
      if (mio !== ricercaId.current) return;
      setGiorni(g);
    } catch (e) {
      if (mio !== ricercaId.current) return;
      setError(e instanceof ApiError ? e.message : 'Ricerca non riuscita. Riprova.');
      setGiorni([]);
    } finally {
      if (mio === ricercaId.current) setCercando(false);
    }
  }, [gender]);

  /** Cambiata la fascia oraria, si ricerca subito con quella. */
  const cambiaOra = (o: string) => { setOraDa(o); void cerca(o, giorniOk, sceltePiene); };
  /** Idem per i giorni della settimana. */
  const cambiaGiorni = (gg: number[]) => { setGiorniOk(gg); void cerca(oraDa, gg, sceltePiene); };

  /**
   * Rete di sicurezza sulla fascia oraria.
   *
   * Il motore del gestionale la rispetta già; questo filtro serve perché in
   * nessun caso — risposta lenta, orario di apertura cambiato mentre si
   * guardava — la cliente veda le 09:30 sotto "dalle 15:00".
   */
  const giorniMostrati = useMemo(() => {
    if (!giorni) return null;
    return giorni
      .map(g => ({ ...g, slots: g.slots.filter(sl => sl.time >= oraDa) }))
      .filter(g => g.slots.length > 0);
  }, [giorni, oraDa]);

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
          <View style={styles.check}><Icona nome="spunta" colore={colors.white} misura={30} /></View>
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
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              const opsCat = operatriciDi(cat);
              const meta = metaCategoria(cat);

              // Riga già compilata e chiusa: si mostra il riassunto
              if (chiuso && t) {
                return (
                  <Pressable key={i} style={styles.rigaChiusa} onPress={() => { setApertoIdx(i); suSu(); }}>
                    <Icona nome={metaCategoria(t.category).icona} colore={colors.primaryDark} misura={24} />
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

                  {/* ------- 1. categoria: riquadri, due per riga ------- */}
                  {!cat ? (
                    <>
                      <Text style={styles.label}>Che cosa vuoi fare</Text>
                      <View style={styles.catGriglia}>
                        {categorieDisponibili.map(c => (
                          <Pressable key={c.key} style={styles.catCard}
                            onPress={() => {
                              const nc = [...categorie]; nc[i] = c.key; setCategorie(nc);
                              aggiorna(i, { treatmentId: '', operatorId: '' });
                              suSu();
                            }}>
                            <Icona nome={c.icona} colore={colors.textSecondary} misura={26} />
                            <Text style={styles.catLabel} numberOfLines={1}>{c.label}</Text>
                            <Text style={styles.catQuante}>{c.quante} trattament{c.quante === 1 ? 'o' : 'i'}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : (
                    /*
                      Scelta la categoria, la griglia sparisce e resta una riga.
                      Tenerla aperta voleva dire nove riquadri fra la cliente e
                      il trattamento, ogni volta.
                    */
                    <Pressable style={styles.sceltaFatta} onPress={() => {
                      const nc = [...categorie]; nc[i] = ''; setCategorie(nc);
                      aggiorna(i, { treatmentId: '', operatorId: '' });
                      suSu();
                    }}>
                      <Icona nome={meta.icona} colore={colors.primaryDark} misura={22} />
                      <Text style={styles.sceltaFattaTxt} numberOfLines={1}>{meta.label}</Text>
                      <Text style={styles.change}>Cambia</Text>
                    </Pressable>
                  )}

                  {/* ------- 2. trattamento ------- */}
                  {!!cat && !t && (
                    <>
                      <Text style={styles.label}>Scegli il trattamento</Text>
                      {treatments.filter(x => x.category === cat).map(x => (
                        <Pressable key={x.id} style={styles.treatItem}
                          onPress={() => {
                            /*
                              Se quel lavoro lo sa fare una sola persona, non
                              c'è niente da scegliere: la domanda si salta e si
                              va dritti all'orario.
                            */
                            aggiorna(i, { treatmentId: x.id, operatorId: '' });
                            if (operatriciDi(cat).length < 2) setApertoIdx(-1);
                            suSu();
                          }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.treatName}>{x.name}</Text>
                            <Text style={styles.muted}>{durOf(x)} min</Text>
                          </View>
                          <Text style={styles.treatPrezzo}>{formatPrice(priceOf(x))}</Text>
                        </Pressable>
                      ))}
                    </>
                  )}

                  {/* ------- 3. con chi: le facce ------- */}
                  {!!t && (
                    <>
                      <Pressable style={styles.sceltaFatta}
                        onPress={() => { aggiorna(i, { treatmentId: '', operatorId: '' }); suSu(); }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sceltaFattaTxt} numberOfLines={1}>{t.name}</Text>
                          <Text style={styles.muted}>{durOf(t)} min · {formatPrice(priceOf(t))}</Text>
                        </View>
                        <Text style={styles.change}>Cambia</Text>
                      </Pressable>

                      {opsCat.length >= 2 && (
                        <>
                          <Text style={styles.label}>Con chi</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.facce}>
                            <Faccia scelta={!sc.operatorId} nome="Chiunque" sottotitolo="la prima libera"
                              onPress={() => aggiorna(i, { operatorId: '' })} />
                            {opsCat.map(o => (
                              <Faccia key={o.id} scelta={sc.operatorId === o.id} nome={o.nomeBreve}
                                avatar={o.avatar} colore={o.colore}
                                onPress={() => aggiorna(i, { operatorId: o.id })} />
                            ))}
                          </ScrollView>
                        </>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            <Pressable style={styles.aggiungi} onPress={() => {
              setScelte([...scelte, { treatmentId: '', operatorId: '' }]);
              setCategorie([...categorie, '']);
              setApertoIdx(scelte.length);
              invalida(); suSu();
            }}>
              <Text style={styles.aggiungiTxt}>+ Aggiungi un altro trattamento</Text>
            </Pressable>

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
                      onPress={() => cambiaGiorni(on
                        ? giorniOk.filter(x => x !== g.n)
                        : [...giorniOk, g.n].sort((a, b) => a - b))}>
                      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{g.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Da che ora</Text>
              <View style={styles.chips}>
                {ORE.map(o => (
                  <Pressable key={o} style={[styles.chip, oraDa === o && styles.chipOn]} onPress={() => cambiaOra(o)}>
                    <Text style={[styles.chipTxt, oraDa === o && styles.chipTxtOn]}>dalle {o}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {cercando ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : giorniMostrati === null ? null : giorniMostrati.length === 0 ? (
              <Text style={styles.vuoto}>
                Nessun orario libero dalle {oraDa} nei giorni che hai scelto. Prova ad allargare i giorni o ad anticipare la fascia.
              </Text>
            ) : giorniMostrati.map(g => (
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

            {error && <Text style={styles.error}>{error}</Text>}
          </>
        )}
      </ScrollView>

      {/*
        La barra resta incollata in fondo: è lì che si va avanti, in tutti e
        due i passi. Prima il tasto stava in coda alla lista — scelto l'orario
        del primo giorno utile bisognava scorrere tre settimane di proposte per
        arrivare a "Conferma".
      */}
      {passo === 1 && sceltePiene.length > 0 && (
        <View style={styles.barra}>
          <View style={styles.barraTesti}>
            <Text style={styles.barraCosa} numberOfLines={1}>
              {sceltePiene.length === 1
                ? treatments.find(t => t.id === sceltePiene[0].treatmentId)?.name
                : `${sceltePiene.length} trattamenti`}
            </Text>
            <Text style={styles.muted}>{totaleDurata} min · {formatPrice(totalePrezzo)}</Text>
          </View>
          <Button title="Avanti" onPress={() => {
            setPasso(2); suSu(); void cerca(oraDa, giorniOk, sceltePiene);
          }} />
        </View>
      )}

      {passo === 2 && (
        <View style={styles.barra}>
          <Pressable hitSlop={10} style={styles.indietro}
            onPress={() => { setPasso(1); setApertoIdx(-1); suSu(); }}>
            <Text style={styles.indietroTxt}>Indietro</Text>
          </Pressable>
          <View style={styles.barraTesti}>
            {scelto ? (
              <>
                <Text style={styles.barraCosa} numberOfLines={1}>
                  {dataLunga(scelto.date)} · {scelto.slot.time}
                </Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {(scelto.slot.assegnazioni || []).map(a => a.operatorName).join(', ') || `${totaleDurata} min`}
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>Scegli un orario qui sopra</Text>
            )}
          </View>
          <Button
            title={submitting ? 'Prenotazione…' : `Conferma · ${formatPrice(totalePrezzo)}`}
            onPress={submit} disabled={!scelto || submitting} />
        </View>
      )}
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
          : colore
            ? <Text style={styles.facciaIniziali}>{iniziali(nome)}</Text>
            : <Icona nome="chiunque" colore={colors.textSecondary} misura={28} />}
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
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barraTesti: { flex: 1 },
  barraCosa: { ...typography.bodyForte, color: colors.textPrimary, textTransform: 'capitalize' },
  indietro: { paddingVertical: spacing.sm },
  indietroTxt: { ...typography.caption, color: colors.textSecondary, fontFamily: fonts.w700 },

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
  togli: { ...typography.caption, color: colors.error, fontFamily: fonts.w700 },

  rigaChiusa: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface, marginTop: spacing.md },
  selName: { ...typography.body, fontFamily: fonts.w700, color: colors.textPrimary },
  change: { ...typography.caption, color: colors.primary, fontFamily: fonts.w700 },

  /** La domanda già risposta: una riga sola, con l'icona e "Cambia". */
  sceltaFatta: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.primarySoft,
    marginTop: spacing.xs,
  },
  sceltaFattaTxt: { ...typography.body, fontFamily: fonts.w700, color: colors.primaryDark, flexShrink: 1 },

  label: { ...typography.label, color: colors.primary, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase' },

  // categorie a riquadri
  catGriglia: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catCard: { width: '47.5%', flexGrow: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', gap: 4 },
  catLabel: { ...typography.body, fontFamily: fonts.w700, color: colors.textPrimary },
  catQuante: { ...typography.caption, color: colors.textMuted, fontSize: 11 },

  treatItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs, backgroundColor: colors.background },
  treatName: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.w600 },
  treatPrezzo: { ...typography.body, fontFamily: fonts.w800, color: colors.textSecondary },
  muted: { ...typography.caption, color: colors.textSecondary },
  vuoto: { ...typography.body, color: colors.textSecondary, marginTop: spacing.lg, textAlign: 'center' },

  // "con chi": la fila delle facce
  facce: { gap: spacing.md, paddingVertical: spacing.xs, paddingRight: spacing.md },
  facciaBox: { alignItems: 'center', width: 76 },
  facciaCerchio: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  facciaCerchioOn: { borderColor: colors.primary, borderWidth: 3 },
  facciaFoto: { width: '100%', height: '100%' },
  facciaIniziali: { ...typography.body, fontFamily: fonts.w800, color: colors.white, fontSize: 20 },
  facciaNome: { ...typography.caption, color: colors.textSecondary, fontFamily: fonts.w700, marginTop: 6 },
  facciaNomeOn: { color: colors.primaryDark },
  facciaSotto: { ...typography.caption, color: colors.textMuted, fontSize: 10 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { ...typography.caption, color: colors.textSecondary, fontFamily: fonts.w600 },
  chipTxtOn: { color: '#fff' },

  aggiungi: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center' },
  aggiungiTxt: { ...typography.body, color: colors.primary, fontFamily: fonts.w700 },

  giornoTitolo: { ...typography.body, fontFamily: fonts.w800, color: colors.textPrimary, textTransform: 'capitalize', marginBottom: spacing.sm },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minWidth: 68, alignItems: 'center' },
  slotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotTxt: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.w600 },
  slotTxtActive: { color: '#fff' },

  error: { ...typography.caption, color: colors.error, marginTop: spacing.md },
  check: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  summary: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  rowVal: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.w600, flexShrink: 1, textAlign: 'right', textTransform: 'capitalize' },
});
