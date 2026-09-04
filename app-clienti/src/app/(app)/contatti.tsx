/**
 * Tab Contatti — chat diretta con il centro estetico.
 * I messaggi arrivano al gestionale, dove l'operatrice risponde.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, ChatMessage, chatService } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ContattiScreen() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const msgs = await chatService.list(token);
      setMessages(msgs);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossibile caricare la chat.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Caricamento iniziale + aggiornamento automatico ogni 5 secondi
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages]);

  const send = async () => {
    const body = input.trim();
    if (!body || !token || sending) return;
    setSending(true);
    setInput('');
    try {
      const msg = await chatService.send(token, body);
      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      setInput(body); // ripristina il testo se l'invio fallisce
      setError(err instanceof ApiError ? err.message : 'Invio non riuscito. Riprova.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Chat</Text>
        <Text style={styles.subtitle}>Scrivi al centro estetico</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.textSecondary} />
                <Text style={styles.emptyText}>
                  Nessun messaggio.{'\n'}Scrivici per qualsiasi domanda o richiesta!
                </Text>
              </View>
            ) : (
              messages.map((m) => {
                const mine = m.sender === 'client';
                return (
                  <View
                    key={m.id}
                    style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}
                  >
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      {!mine && m.operatorName ? (
                        <Text style={styles.author}>{m.operatorName}</Text>
                      ) : null}
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.body}</Text>
                      <Text style={[styles.time, mine && styles.timeMine]}>{formatTime(m.createdAt)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor={colors.textSecondary}
            multiline
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <Pressable
            accessibilityRole="button"
            onPress={send}
            disabled={!input.trim() || sending}
            style={({ pressed }) => [
              styles.sendButton,
              (!input.trim() || sending) && styles.sendButtonDisabled,
              pressed && { opacity: 0.8 },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.title, color: colors.primary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  messages: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.xs },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.xs },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  author: { ...typography.caption, color: colors.primaryDark, fontFamily: fonts.w700, marginBottom: 2 },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  bubbleTextMine: { color: '#fff' },
  time: { ...typography.caption, color: colors.textSecondary, marginTop: 4, alignSelf: 'flex-end' },
  timeMine: { color: 'rgba(255,255,255,0.75)' },
  error: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    paddingBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
});
