/**
 * Revo AI: l'assistente che conosce il tuo percorso.
 * Chat semplice: domanda → risposta completa (niente stream in v1).
 */
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, MessaggioRevoAI, revoAiService } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

/** Quello che Revo sta facendo davvero, raccontato mentre lo fa. */
const FRASI_ATTESA = [
  'Ci sto pensando…',
  'Sto guardando il listino…',
  "Controllo l'agenda…",
  'Un attimo, quasi fatto…',
];

const SUGGERIMENTI = [
  'Cosa mi consigli per la pelle?',
  'Sabato ho una cerimonia, che posso fare?',
  'Quando mi conviene tornare?',
];

/**
 * Il testo di Revo, con i **grassetti** resi davvero in grassetto: il
 * modello scrive in markdown e gli asterischi crudi a schermo sono
 * bruttissimi. Un parser vero sarebbe troppo; per il grassetto basta
 * alternare i pezzi fra i doppi asterischi.
 */
function TestoRevo({ testo, chiaro, anima }: { testo: string; chiaro?: boolean; anima?: boolean }) {
  // L'effetto macchina da scrivere: la risposta "arriva" invece di piombare.
  // Solo sull'ultimo messaggio appena ricevuto: lo storico è già letto.
  const [visibili, setVisibili] = useState(anima ? 0 : testo.length);
  useEffect(() => {
    if (!anima) { setVisibili(testo.length); return; }
    let i = 0;
    const t = setInterval(() => {
      i += 4;
      setVisibili(Math.min(testo.length, i));
      if (i >= testo.length) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [anima, testo]);

  const parti = testo.slice(0, visibili).split('**');
  return (
    <Text style={[styles.bollaTesto, chiaro && styles.bollaTestoMia]}>
      {parti.map((p, i) => (i % 2 === 1 ? <Text key={i} style={styles.grassetto}>{p}</Text> : p))}
    </Text>
  );
}

export default function AssistenteScreen() {
  const { token } = useAuth();
  const altezzaHeader = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [messaggi, setMessaggi] = useState<MessaggioRevoAI[]>([]);
  const [testo, setTesto] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [pensando, setPensando] = useState(false);
  const [fraseAttesa, setFraseAttesa] = useState(0);
  const [daAnimare, setDaAnimare] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!token) return;
    revoAiService
      .storico(token)
      .then((r) => setMessaggi(r.messaggi))
      .catch(() => null)
      .finally(() => setCaricamento(false));
  }, [token]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messaggi, pensando]);

  // Le frasi d'attesa girano: non cambiano la velocità, cambiano l'attesa.
  useEffect(() => {
    if (!pensando) return;
    setFraseAttesa(0);
    const t = setInterval(() => setFraseAttesa((f) => (f + 1) % FRASI_ATTESA.length), 2500);
    return () => clearInterval(t);
  }, [pensando]);

  const invia = async (contenuto?: string) => {
    const corpo = (contenuto ?? testo).trim();
    if (!corpo || !token || pensando) return;
    setErrore(null);
    setTesto('');
    setPensando(true);
    setMessaggi((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, ruolo: 'cliente', testo: corpo, createdAt: new Date().toISOString() },
    ]);
    try {
      const r = await revoAiService.chiedi(token, corpo);
      setDaAnimare(r.messaggio.id);
      setMessaggi((prev) => [...prev, r.messaggio]);
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Revo ha avuto un contrattempo. Riprova.');
    } finally {
      setPensando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.sfondo}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // L'header vero, misurato: col 90 fisso la casella finiva mezza
      // sotto la tastiera.
      keyboardVerticalOffset={Platform.OS === 'ios' ? altezzaHeader : 0}
    >
      {caricamento ? (
        <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView ref={scrollRef} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })} style={styles.flex} contentContainerStyle={[styles.lista, messaggi.length === 0 && { flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled">
          {messaggi.length === 0 ? (
            <View style={styles.vuoto}>
              <Ionicons name="sparkles-outline" size={40} color={colors.primary} />
              <Text style={styles.vuotoTitolo}>Ciao, sono Revo ✨</Text>
              <Text style={styles.vuotoTesto}>
                Conosco il tuo percorso: chiedimi un consiglio, un orario, un'idea
                per un'occasione speciale.
              </Text>
              {SUGGERIMENTI.map((s) => (
                <Pressable key={s} style={styles.suggerimento} onPress={() => void invia(s)}>
                  <Text style={styles.suggerimentoTesto}>{s}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            messaggi.map((m) => {
              const mia = m.ruolo === 'cliente';
              return (
                <View key={m.id} style={[styles.rigaBolla, mia ? styles.rigaDx : styles.rigaSx]}>
                  <View style={[styles.bolla, mia ? styles.bollaMia : styles.bollaRevo]}>
                    <TestoRevo testo={m.testo} chiaro={mia} anima={!mia && m.id === daAnimare} />
                  </View>
                </View>
              );
            })
          )}
          {pensando ? (
            <View style={[styles.rigaBolla, styles.rigaSx]}>
              <View style={[styles.bolla, styles.bollaRevo, styles.bollaAttesa]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.attesaTesto}>{FRASI_ATTESA[fraseAttesa]}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {errore ? <Text style={styles.errore}>{errore}</Text> : null}

      <View style={[styles.inputRiga, { paddingBottom: Math.max(spacing.sm, insets.bottom) }]}>
        <TextInput
          style={styles.input}
          value={testo}
          onChangeText={setTesto}
          placeholder="Chiedi a Revo…"
          placeholderTextColor={colors.textSecondary}
          multiline
          editable={!pensando}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => void invia()}
          disabled={!testo.trim() || pensando}
          style={({ pressed }) => [
            styles.invio,
            (!testo.trim() || pensando) && styles.invioSpento,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="arrow-up" size={18} color={colors.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.xs },
  vuoto: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  vuotoTitolo: { fontFamily: fonts.serif600, fontSize: 22, color: colors.textPrimary },
  vuotoTesto: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
  suggerimento: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.full,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  suggerimentoTesto: { ...typography.label, color: colors.primaryDark },
  rigaBolla: { flexDirection: 'row', marginBottom: spacing.xs },
  rigaDx: { justifyContent: 'flex-end' },
  rigaSx: { justifyContent: 'flex-start' },
  bolla: { maxWidth: '84%', borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  bollaMia: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bollaRevo: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bollaTesto: { ...typography.body, color: colors.textPrimary },
  bollaTestoMia: { color: colors.white },
  grassetto: { fontFamily: fonts.w700 },
  bollaAttesa: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attesaTesto: { ...typography.caption, fontSize: 13, color: colors.textSecondary },
  errore: { ...typography.caption, color: colors.error, textAlign: 'center', paddingBottom: spacing.xs },
  inputRiga: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    ...typography.body, flex: 1, maxHeight: 110, color: colors.textPrimary,
    backgroundColor: colors.background, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  invio: {
    width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  invioSpento: { backgroundColor: colors.disabled },
});
