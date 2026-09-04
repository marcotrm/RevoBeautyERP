/**
 * La bacheca: le promo del giorno e i lavori del salone, come un piccolo
 * feed. Le foto parlano da sole — il testo fa da didascalia, non da muro.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator, Image, RefreshControl, ScrollView,
  StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';

import { bachecaService } from '@/api';
import { useApiData } from '@/hooks/useApiData';
import { colors, fonts, radius, spacing, typography } from '@/theme';
import { formatDate } from '@/utils/format';

export default function BachecaScreen() {
  const { data, isLoading, isRefreshing, refresh } = useApiData((t) => bachecaService.list(t));
  const { width } = useWindowDimensions();
  const fotoLato = Math.min(width, 520) - spacing.lg * 2;

  if (isLoading || !data) {
    return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.sfondo}
      contentContainerStyle={styles.contenuto}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      {data.posts.length === 0 ? (
        <View style={styles.vuoto}>
          <Ionicons name="images-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.vuotoTesto}>
            Qui arriveranno le promo del giorno{'\n'}e i lavori più belli del salone.
          </Text>
        </View>
      ) : (
        data.posts.map((p) => (
          <View key={p.id} style={styles.post}>
            {p.foto ? (
              <Image
                source={{ uri: p.foto }}
                style={{ width: fotoLato, height: fotoLato, borderRadius: radius.lg }}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.corpo}>
              <View style={styles.rigaTipo}>
                <Text style={[styles.tipo, p.tipo === 'promo' && styles.tipoPromo]}>
                  {p.tipo === 'promo' ? 'PROMO' : 'DAL SALONE'}
                </Text>
                <Text style={styles.data}>{formatDate(p.createdAt.slice(0, 10))}</Text>
              </View>
              <Text style={styles.titolo}>{p.titolo}</Text>
              {p.testo ? <Text style={styles.testo}>{p.testo}</Text> : null}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  vuoto: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  vuotoTesto: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  post: { gap: spacing.sm },
  corpo: { gap: 3 },
  rigaTipo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tipo: { ...typography.captionForte, fontSize: 10.5, letterSpacing: 1.5, color: colors.textSecondary },
  tipoPromo: { color: colors.primaryDark },
  data: { ...typography.caption, color: colors.textMuted, textTransform: 'capitalize' },
  titolo: { fontFamily: fonts.w700, fontSize: 18, color: colors.textPrimary },
  testo: { ...typography.body, fontSize: 14.5, color: colors.textSecondary },
});
