/**
 * Revo AI: l'assistente che conosce il tuo percorso.
 * Chat semplice: domanda → risposta completa (niente stream in v1).
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError, MessaggioRevoAI, revoAiService } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

const SUGGERIMENTI = [
  'Cosa mi consigli per la pelle?',
  'Sabato ho una cerimonia, che posso fare?',
  'Quando mi conviene tornare?',
];

export default function AssistenteScreen() {
  const { token } = useAuth();
  const [messaggi, setMessaggi] = useState<MessaggioRevoAI[]>([]);
  const [testo, setTesto] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [pensando, setPensando] = useState(false);
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {caricamento ? (
        <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.lista} keyboardShouldPersistTaps="handled">
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
                    <Text style={[styles.bollaTesto, mia && styles.bollaTestoMia]}>{m.testo}</Text>
                  </View>
                </View>
              );
            })
          )}
          {pensando ? (
            <View style={[styles.rigaBolla, styles.rigaSx]}>
              <View style={[styles.bolla, styles.bollaRevo]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {errore ? <Text style={styles.errore}>{errore}</Text> : null}

      <View style={styles.inputRiga}>
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
