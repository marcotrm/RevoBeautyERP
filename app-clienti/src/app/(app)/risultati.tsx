/**
 * L'area privata dei risultati: percorsi, sedute, tappe, foto, consensi.
 *
 * Qui la cliente vede SOLO ciò che il centro ha condiviso con lei — il
 * filtro sta sul server, non in questa schermata. L'avanzamento è sedute
 * fatte su pianificate: nessun "miglioramento" calcolato da una macchina.
 */
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';

import { ApiError, esteticaService, FotoCliente, PercorsoCliente } from '@/api';
import { ConfrontoFoto } from '@/components/ConfrontoFoto';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

const STATI: Record<string, { testo: string; colore: string }> = {
  attivo: { testo: 'In corso', colore: colors.success },
  in_pausa: { testo: 'In pausa', colore: colors.textSecondary },
  completato: { testo: 'Completato 🎉', colore: colors.primaryDark },
  mantenimento: { testo: 'Mantenimento', colore: colors.primaryDark },
  interrotto: { testo: 'Interrotto', colore: colors.textSecondary },
};

export default function RisultatiScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data, isLoading, isRefreshing, refresh } = useApiData((t) => esteticaService.risultati(t));
  const [errore, setErrore] = useState<string | null>(null);
  const [caricando, setCaricando] = useState(false);

  const attivaConsensoFoto = async () => {
    if (!token) return;
    try {
      await esteticaService.impostaConsenso(token, 'foto-percorso', true);
      refresh();
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    }
  };

  const caricaFoto = async (p: PercorsoCliente) => {
    if (!token || caricando) return;
    setErrore(null);
    const esito = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9,
    });
    if (esito.canceled || !esito.assets[0]) return;
    setCaricando(true);
    try {
      const piccola = await ImageManipulator.manipulateAsync(
        esito.assets[0].uri,
        [{ resize: { width: 700 } }],
        { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!piccola.base64) throw new Error('no-base64');
      await esteticaService.caricaFoto(
        token, p.id, p.trattamenti[0]?.nome ?? 'Area trattata',
        `data:image/jpeg;base64,${piccola.base64}`
      );
      refresh();
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Caricamento non riuscito. Riprova.');
    } finally {
      setCaricando(false);
    }
  };

  const eliminaFoto = (f: FotoCliente) => {
    if (!token) return;
    Alert.alert('Eliminare questa foto?', 'Non si può annullare.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive',
        onPress: async () => {
          try {
            await esteticaService.eliminaFoto(token, f.id);
            refresh();
          } catch (e) {
            setErrore(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
          }
        },
      },
    ]);
  };

  if (isLoading || !data) {
    return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;
  }

  const lato = Math.min(width - spacing.lg * 2, 420);

  return (
    <ScrollView
      style={styles.sfondo}
      contentContainerStyle={styles.contenuto}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <FormError message={errore} />

      {/* ── Prossima seduta ── */}
      {data.prossimoAppuntamento && (
        <Pressable style={styles.prossima} onPress={() => router.push('/appuntamenti')}>
          <Ionicons name="calendar" size={18} color={colors.primaryDark} />
          <Text style={styles.prossimaTesto}>
            Prossima seduta: <Text style={styles.forte}>{data.prossimoAppuntamento.date.split('-').reverse().join('/')}
            {' '}alle {data.prossimoAppuntamento.startTime}</Text> · {data.prossimoAppuntamento.treatmentName}
          </Text>
        </Pressable>
      )}

      {/* ── Nessun percorso: si parte da check-up o consulenza ── */}
      {data.percorsi.length === 0 && (
        <View style={styles.vuoto}>
          <Ionicons name="leaf-outline" size={44} color={colors.textSecondary} />
          <Text style={styles.vuotoTitolo}>Il tuo percorso comincia qui</Text>
          <Text style={styles.vuotoTesto}>
            Compila il check-up o raccontaci cosa vorresti migliorare: una nostra
            operatrice costruirà con te un percorso su misura.
          </Text>
          <Button title="Fai il check-up estetico" onPress={() => router.push('/checkup')} style={{ alignSelf: 'stretch' }} />
          <Button title="Chiedi una consulenza" variant="secondary" onPress={() => router.push('/consulenza')} style={{ alignSelf: 'stretch' }} />
        </View>
      )}

      {/* ── I percorsi ── */}
      {data.percorsi.map((p) => {
        const stato = STATI[p.stato] ?? { testo: p.stato, colore: colors.textSecondary };
        const quota = p.seduteTotali > 0 ? Math.min(1, p.seduteFatte / p.seduteTotali) : 0;
        const conConsenso = data.consensoFoto;
        return (
          <View key={p.id} style={styles.percorso}>
            <View style={styles.percorsoTesta}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.percorsoNome}>{p.nome}</Text>
                <Text style={styles.percorsoObiettivo}>{p.obiettivo}</Text>
              </View>
              <Text style={[styles.percorsoStato, { color: stato.colore }]}>{stato.testo}</Text>
            </View>

            {/* Avanzamento = SOLO sedute fatte su pianificate. */}
            <View style={styles.barra}>
              <View style={[styles.barraPiena, { width: `${quota * 100}%` }]} />
            </View>
            <Text style={styles.barraTesto}>
              {p.seduteFatte} sedute fatte su {p.seduteTotali}
              {p.frequenza ? ` · ${p.frequenza}` : ''}
            </Text>

            {p.noteCliente ? <Text style={styles.nota}>💛 {p.noteCliente}</Text> : null}

            {/* Le tappe */}
            {p.tappe.length > 0 && (
              <View style={styles.tappe}>
                {p.tappe.map((t) => (
                  <View key={t.titolo} style={styles.tappa}>
                    <Ionicons
                      name={t.raggiunta ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16} color={t.raggiunta ? colors.success : colors.border}
                    />
                    <Text style={[styles.tappaTesto, t.raggiunta && styles.tappaFatta]}>
                      {t.titolo} <Text style={styles.tappaQuando}>(dopo la {t.dopoSeduta}ª seduta)</Text>
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* La timeline delle sedute condivise */}
            {p.sedute.length > 0 && (
              <View style={styles.timeline}>
                {p.sedute.map((s) => (
                  <View key={s.id} style={styles.seduta}>
                    <View style={styles.sedutaPallino}><Text style={styles.sedutaNumero}>{s.numero}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.sedutaTitolo}>
                        {s.trattamento}{s.area ? ` · ${s.area}` : ''}
                      </Text>
                      <Text style={styles.sedutaSotto}>
                        {s.data.split('-').reverse().join('/')} · con {s.operatrice}
                        {s.durataMinuti ? ` · ${s.durataMinuti} min` : ''}
                      </Text>
                      {s.osservazioni ? <Text style={styles.sedutaTesto}>{s.osservazioni}</Text> : null}
                      {(s.misurazioni?.length ?? 0) > 0 && (
                        <Text style={styles.sedutaTesto}>
                          📏 {s.misurazioni!.map((m) => `${m.nome}: ${m.valore}${m.unita}`).join(' · ')}
                        </Text>
                      )}
                      {s.indicazioniDopo ? (
                        <Text style={styles.sedutaIndicazioni}>Per casa: {s.indicazioniDopo}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Le foto ── */}
            <Text style={styles.sezioncina}>LE TUE FOTO</Text>
            {!conConsenso ? (
              <View style={styles.consensoFoto}>
                <Text style={styles.consensoTesto}>
                  Le foto del percorso restano in un&apos;area privata: le vedi solo tu e le
                  operatrici che ti seguono. Per attivarle serve il tuo consenso, che puoi
                  revocare quando vuoi.
                  {p.fotoTotali > 0 ? `\n(${p.fotoTotali} foto in archivio, nascoste finché non riattivi il consenso.)` : ''}
                </Text>
                <Button title="Attiva le foto del percorso" onPress={() => void attivaConsensoFoto()} />
              </View>
            ) : (
              <FotoPercorsoBlocco
                p={p} lato={lato} caricando={caricando}
                carica={() => void caricaFoto(p)} elimina={eliminaFoto}
              />
            )}

            {p.mantenimento ? (
              <Text style={styles.mantenimento}>🌿 Mantenimento: {p.mantenimento}</Text>
            ) : null}
          </View>
        );
      })}

      {/* ── Documenti e consensi ── */}
      <Pressable style={styles.voce} onPress={() => router.push('/consensi')}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryDark} />
        <Text style={styles.voceTesto}>I miei consensi</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </Pressable>
      <Pressable style={styles.voce} onPress={() => router.push('/checkup')}>
        <Ionicons name="clipboard-outline" size={20} color={colors.primaryDark} />
        <Text style={styles.voceTesto}>
          Check-up estetico{data.checkup ? (data.checkup.verificato ? ' · verificato ✓' : ' · in verifica') : ''}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </Pressable>
    </ScrollView>
  );
}

/** Le foto di un percorso: griglia, scelta prima/dopo, confronto col cursore. */
function FotoPercorsoBlocco({ p, lato, caricando, carica, elimina }: {
  p: PercorsoCliente; lato: number; caricando: boolean;
  carica: () => void; elimina: (f: FotoCliente) => void;
}) {
  const [primaId, setPrimaId] = useState<string | null>(null);
  const [dopoId, setDopoId] = useState<string | null>(null);

  const prima = p.foto.find((f) => f.id === primaId) ?? p.foto[0] ?? null;
  const dopo = p.foto.find((f) => f.id === dopoId) ?? p.foto[p.foto.length - 1] ?? null;

  return (
    <View>
      <Text style={styles.guidaFoto}>
        Per un confronto onesto: stessa luce, stessa posizione, stessa distanza e
        stessa angolazione di ogni volta. Meglio luce naturale, senza filtri.
      </Text>

      {p.foto.length >= 2 && prima && dopo && prima.id !== dopo.id ? (
        <View style={{ marginBottom: spacing.sm }}>
          <ConfrontoFoto
            prima={{ immagine: prima.immagine, scattataIl: prima.scattataIl.split('-').reverse().join('/') }}
            dopo={{ immagine: dopo.immagine, scattataIl: dopo.scattataIl.split('-').reverse().join('/') }}
            lato={lato}
          />
          <Text style={styles.guidaFoto}>
            Tocca una miniatura per il «prima», tienila premuta per il «dopo».
          </Text>
        </View>
      ) : null}

      <View style={styles.fotoGriglia}>
        {p.foto.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setPrimaId(f.id)}
            onLongPress={() => setDopoId(f.id)}
            accessibilityLabel={`Foto ${f.area} del ${f.scattataIl}`}
          >
            <Image source={{ uri: f.immagine }} style={[
              styles.fotoMini,
              (f.id === (prima?.id) || f.id === (dopo?.id)) && styles.fotoScelta,
            ]} />
            <Text style={styles.fotoData}>{f.scattataIl.slice(5).split('-').reverse().join('/')}</Text>
            {f.origine === 'cliente' && (
              <Pressable style={styles.fotoElimina} onPress={() => elimina(f)} accessibilityLabel="Elimina foto">
                <Text style={styles.fotoEliminaTesto}>✕</Text>
              </Pressable>
            )}
          </Pressable>
        ))}
        <Pressable style={styles.fotoAggiungi} onPress={carica} disabled={caricando}>
          {caricando
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="camera-outline" size={22} color={colors.primaryDark} />}
        </Pressable>
      </View>
      {p.foto.length === 0 && (
        <Text style={styles.guidaFoto}>Nessuna foto ancora: la prima è quella che conta di più.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl },
  forte: { fontFamily: fonts.w700, color: colors.textPrimary },

  prossima: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primarySoft, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md,
  },
  prossimaTesto: { ...typography.caption, fontSize: 13, color: colors.textPrimary, flex: 1 },

  vuoto: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  vuotoTitolo: { fontFamily: fonts.w800, fontSize: 20, color: colors.textPrimary },
  vuotoTesto: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  percorso: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
  },
  percorsoTesta: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  percorsoNome: { fontFamily: fonts.w800, fontSize: 18, color: colors.textPrimary },
  percorsoObiettivo: { ...typography.caption, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  percorsoStato: { ...typography.captionForte, fontSize: 12 },

  barra: {
    height: 8, borderRadius: 4, backgroundColor: colors.backgroundAlt,
    marginTop: spacing.md, overflow: 'hidden',
  },
  barraPiena: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  barraTesto: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },

  nota: { ...typography.caption, fontSize: 13, color: colors.textPrimary, marginTop: spacing.sm, lineHeight: 18 },

  tappe: { marginTop: spacing.md, gap: spacing.xs },
  tappa: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tappaTesto: { ...typography.caption, fontSize: 13, color: colors.textSecondary, flex: 1 },
  tappaFatta: { color: colors.textPrimary },
  tappaQuando: { color: colors.textSecondary, fontSize: 11 },

  timeline: { marginTop: spacing.md, gap: spacing.sm },
  seduta: { flexDirection: 'row', gap: spacing.sm },
  sedutaPallino: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  sedutaNumero: { fontFamily: fonts.w800, fontSize: 12, color: colors.primaryDark },
  sedutaTitolo: { fontFamily: fonts.w700, fontSize: 14, color: colors.textPrimary },
  sedutaSotto: { ...typography.caption, color: colors.textSecondary },
  sedutaTesto: { ...typography.caption, fontSize: 13, color: colors.textPrimary, marginTop: 2, lineHeight: 18 },
  sedutaIndicazioni: {
    ...typography.caption, fontSize: 13, color: colors.primaryDark,
    marginTop: 2, lineHeight: 18,
  },

  sezioncina: {
    ...typography.captionForte, fontSize: 10, letterSpacing: 1.2,
    color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs,
  },
  consensoFoto: { gap: spacing.sm },
  consensoTesto: { ...typography.caption, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  guidaFoto: { ...typography.caption, fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: spacing.sm },

  fotoGriglia: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'flex-start' },
  fotoMini: { width: 72, height: 72, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' },
  fotoScelta: { borderColor: colors.primary },
  fotoData: { ...typography.caption, fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },
  fotoElimina: {
    position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center',
  },
  fotoEliminaTesto: { color: colors.white, fontSize: 10, fontFamily: fonts.w700 },
  fotoAggiungi: {
    width: 72, height: 72, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },

  mantenimento: { ...typography.caption, fontSize: 13, color: colors.textPrimary, marginTop: spacing.md, lineHeight: 18 },

  voce: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md,
  },
  voceTesto: { ...typography.body, fontSize: 15, color: colors.textPrimary, flex: 1 },
});
