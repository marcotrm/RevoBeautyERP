/**
 * Profilo: chi sono e tutto quello che non sta nelle altre schede.
 *
 * Appuntamenti, percorsi, wallet e listino si aprono da qui: cinque schede in
 * fondo allo schermo sono il massimo prima che diventino illeggibili, e queste
 * sono cose che si cercano, non che si guardano ogni giorno.
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, spacing, typography } from '@/theme';

type Voce = { icona: keyof typeof Ionicons.glyphMap; testo: string; rotta: string };

const VOCI: Voce[] = [
  { icona: 'calendar-outline', testo: 'I miei appuntamenti', rotta: '/appuntamenti' },
  { icona: 'trending-up-outline', testo: 'I miei percorsi', rotta: '/percorsi' },
  { icona: 'wallet-outline', testo: 'Beauty Wallet', rotta: '/wallet' },
  { icona: 'ribbon-outline', testo: 'Beauty Club', rotta: '/club' },
  { icona: 'people-outline', testo: 'Porta un\'amica', rotta: '/invita' },
  { icona: 'pricetags-outline', testo: 'Trattamenti e pacchetti', rotta: '/listino' },
  { icona: 'chatbubble-ellipses-outline', testo: 'Scrivici', rotta: '/contatti' },
  { icona: 'speedometer-outline', testo: 'Revo Score', rotta: '/score' },
  { icona: 'flag-outline', testo: 'Missioni', rotta: '/missioni' },
  { icona: 'book-outline', testo: 'Beauty Passport', rotta: '/passport' },
  { icona: 'notifications-outline', testo: 'Lista d\'attesa', rotta: '/lista-attesa' },
];

export default function ProfiloScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const iniziali = `${user?.nome?.[0] ?? ''}${user?.cognome?.[0] ?? ''}`.toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenuto}>
        <View style={styles.testa}>
          <View style={styles.avatar}><Text style={styles.iniziali}>{iniziali}</Text></View>
          <View style={styles.testi}>
            <Text style={styles.nome}>{user?.nome} {user?.cognome}</Text>
            {user?.telefono ? <Text style={styles.piccolo}>{user.telefono}</Text> : null}
          </View>
        </View>

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
  iniziali: { ...typography.subtitle, color: colors.white },
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
