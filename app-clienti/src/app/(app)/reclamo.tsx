/**
 * Reclamo anonimo: la cassetta delle lettere senza mittente.
 *
 * L'anonimato è spiegato E vero: il server butta via l'identità prima di
 * salvare (vedi /api/mobile/reclami). Qui si sceglie la categoria, si
 * racconta il problema, si invia — e si torna con la coscienza leggera.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api';
import { apiRequest } from '@/api/http';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

const CATEGORIE = [
  { codice: 'servizio', label: 'Servizio ricevuto' },
  { codice: 'personale', label: 'Personale' },
  { codice: 'ambiente', label: 'Pulizia e ambiente' },
  { codice: 'prezzi', label: 'Prezzi' },
  { codice: 'app', label: "L'app" },
  { codice: 'altro', label: 'Altro' },
];

export default function ReclamoScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [categoria, setCategoria] = useState<string | null>(null);
  const [testo, setTesto] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [inviando, setInviando] = useState(false);
  const [inviato, setInviato] = useState(false);

  const invia = async () => {
    if (!token || !categoria) return;
    setErrore(null);
    setInviando(true);
    try {
      await apiRequest('/api/mobile/reclami', {
        method: 'POST', token, body: { categoria, testo },
      });
      setInviato(true);
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Invio non riuscito. Riprova.');
    } finally {
      setInviando(false);
    }
  };

  if (inviato) {
    return (
      <View style={styles.centro}>
        <Ionicons name="checkmark-circle" size={52} color={colors.success} />
        <Text style={styles.grazieTitolo}>Ricevuto. Grazie.</Text>
        <Text style={styles.grazieTesto}>
          Il tuo reclamo è arrivato al centro in forma anonima: nessuno sa che
          l&apos;hai scritto tu, ma verrà letto con attenzione.
        </Text>
        <Button title="Torna al profilo" variant="secondary" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.sfondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenuto} keyboardShouldPersistTaps="handled">
        <View style={styles.info}>
          <Ionicons name="eye-off-outline" size={20} color={colors.primaryDark} />
          <Text style={styles.infoTesto}>
            Questo reclamo è <Text style={styles.forte}>davvero anonimo</Text>: il
            centro leggerà solo la categoria e il messaggio. Né il tuo nome, né il
            tuo numero vengono salvati.
          </Text>
        </View>

        <Text style={styles.etichetta}>Di cosa si tratta?</Text>
        <View style={styles.griglia}>
          {CATEGORIE.map((c) => {
            const attiva = categoria === c.codice;
            return (
              <Pressable
                key={c.codice}
                style={[styles.chip, attiva && styles.chipAttiva]}
                onPress={() => setCategoria(c.codice)}
              >
                <Text style={[styles.chipTesto, attiva && styles.chipTestoAttivo]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.etichetta}>Racconta cos&apos;è successo</Text>
        <TextInput
          style={styles.area}
          value={testo}
          onChangeText={setTesto}
          placeholder="Descrivi il problema con parole tue: più dettagli ci dai, meglio possiamo sistemare."
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
          editable={!inviando}
        />

        <FormError message={errore} />
        <Button
          title="Invia in forma anonima"
          onPress={() => void invia()}
          loading={inviando}
          disabled={!categoria || testo.trim().length < 10}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md,
  },
  grazieTitolo: { fontFamily: fonts.w800, fontSize: 22, color: colors.textPrimary },
  grazieTesto: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl },
  info: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.primarySoft, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  infoTesto: { ...typography.caption, fontSize: 13, color: colors.textPrimary, flex: 1, lineHeight: 18 },
  forte: { fontFamily: fonts.w700 },
  etichetta: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs },
  griglia: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipAttiva: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipTesto: { ...typography.label, color: colors.textSecondary },
  chipTestoAttivo: { color: colors.primaryDark, fontFamily: fonts.w700 },
  area: {
    ...typography.body, minHeight: 130, color: colors.textPrimary,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
  },
});
