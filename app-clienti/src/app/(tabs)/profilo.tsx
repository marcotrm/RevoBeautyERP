/**
 * Profilo: chi sono e tutto quello che non sta nelle altre schede.
 *
 * Appuntamenti, percorsi, wallet e listino si aprono da qui: cinque schede in
 * fondo allo schermo sono il massimo prima che diventino illeggibili, e queste
 * sono cose che si cercano, non che si guardano ogni giorno.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { completezzaProfilo, profiloService, type ProfiloCliente } from '@/api';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

type Voce = { icona: keyof typeof Ionicons.glyphMap; testo: string; rotta: string };

const VOCI: Voce[] = [
  { icona: 'calendar-outline', testo: 'I miei appuntamenti', rotta: '/appuntamenti' },
  { icona: 'leaf-outline', testo: 'I miei risultati', rotta: '/risultati' },
  { icona: 'clipboard-outline', testo: 'Check-up estetico', rotta: '/checkup' },
  { icona: 'chatbubble-ellipses-outline', testo: 'Chiedi una consulenza', rotta: '/consulenza' },
  { icona: 'shield-checkmark-outline', testo: 'I miei consensi', rotta: '/consensi' },
  { icona: 'trending-up-outline', testo: 'I miei percorsi', rotta: '/percorsi' },
  { icona: 'wallet-outline', testo: 'Beauty Wallet', rotta: '/wallet' },
  { icona: 'ribbon-outline', testo: 'Beauty Club', rotta: '/club' },
  { icona: 'people-outline', testo: 'Porta un\'amica', rotta: '/invita' },
  { icona: 'speedometer-outline', testo: 'Revo Score', rotta: '/score' },
  { icona: 'flag-outline', testo: 'Missioni', rotta: '/missioni' },
  { icona: 'book-outline', testo: 'Beauty Passport', rotta: '/passport' },
  { icona: 'notifications-outline', testo: 'Lista d\'attesa', rotta: '/lista-attesa' },
  { icona: 'options-outline', testo: 'Notifiche', rotta: '/preferenze-notifiche' },
  { icona: 'eye-off-outline', testo: 'Reclamo anonimo', rotta: '/reclamo' },
];

export default function ProfiloScreen() {
  const { user, token, signOut } = useAuth();
  const router = useRouter();
  const [profilo, setProfilo] = useState<ProfiloCliente | null>(null);
  const iniziali = `${user?.nome?.[0] ?? ''}${user?.cognome?.[0] ?? ''}`.toUpperCase();

  // Al rientro sulla scheda: la foto appena scelta si deve vedere subito
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      profiloService.get(token).then((r) => setProfilo(r.profilo)).catch(() => null);
    }, [token])
  );

  const completo = profilo ? completezzaProfilo(profilo) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenuto}>
        <Pressable style={styles.testa} onPress={() => router.push('/modifica-profilo')}>
          {profilo?.avatar ? (
            <Image source={{ uri: profilo.avatar }} style={styles.avatarFoto} />
          ) : (
            <View style={styles.avatar}><Text style={styles.iniziali}>{iniziali}</Text></View>
          )}
          <View style={styles.testi}>
            <Text style={styles.nome}>{user?.nome} {user?.cognome}</Text>
            {user?.telefono ? <Text style={styles.piccolo}>{user.telefono}</Text> : null}
          </View>
          <Ionicons name="create-outline" size={20} color={colors.textMuted} />
        </Pressable>

        {completo !== null && completo < 100 ? (
          <Pressable style={styles.completa} onPress={() => router.push('/modifica-profilo')}>
            <View style={styles.completaTesti}>
              <Text style={styles.completaTitolo}>Completa il tuo profilo · {completo}%</Text>
              <View style={styles.completaBarra}>
                <View style={[styles.completaPieno, { width: `${completo}%` }]} />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
          </Pressable>
        ) : null}

        <Card padded={false} style={styles.elenco}>
          {VOCI.map((v, i) => (
            <Pressable
              key={v.rotta}
              onPress={() => router.push(v.rotta as never)}
              style={({ pressed }) => [styles.voce, i > 0 && styles.divisore, pressed && styles.premuta]}
            >
              <Ionicons name={v.icona} size={20} color={colors.primary} />
              <Text style={styles.voceTesto}>{v.testo}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </Card>

        <Pressable onPress={() => void signOut()} style={styles.esci}>
          <Text style={styles.esciTesto}>Esci</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  contenuto: { padding: spacing.md, paddingBottom: spacing.xxl },
  testa: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarFoto: { width: 60, height: 60, borderRadius: 30 },
  iniziali: { ...typography.subtitle, color: colors.white },
  completa: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primarySoft, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md,
  },
  completaTesti: { flex: 1, gap: 6 },
  completaTitolo: { ...typography.labelForte, color: colors.primaryDark },
  completaBarra: { height: 4, borderRadius: radius.full, backgroundColor: colors.white, overflow: 'hidden' },
  completaPieno: { height: '100%', backgroundColor: colors.primary },
  testi: { flex: 1 },
  nome: { ...typography.subtitle, color: colors.textPrimary },
  piccolo: { ...typography.caption, color: colors.textSecondary },
  elenco: { overflow: 'hidden' },
  voce: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  divisore: { borderTopWidth: 1, borderTopColor: colors.border },
  premuta: { backgroundColor: colors.backgroundAlt },
  voceTesto: { ...typography.body, color: colors.textPrimary, flex: 1 },
  esci: { alignItems: 'center', paddingVertical: spacing.lg },
  esciTesto: { ...typography.label, color: colors.textSecondary, fontFamily: fonts.w600 },
});
