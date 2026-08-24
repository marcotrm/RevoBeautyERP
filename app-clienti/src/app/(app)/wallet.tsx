/**
 * Beauty Wallet: quanto c'è, di che tipo e cosa sta per scadere.
 *
 * La divisione in tasche non è un dettaglio contabile: dice alla cliente cosa
 * rischia di perdere. Un totale unico nasconde proprio l'informazione che
 * la farebbe tornare.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { homeService, type DatiWallet } from '@/api';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, spacing, typography } from '@/theme';

const eur = (n: number) =>
  `${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const data = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

export default function WalletScreen() {
  const { token } = useAuth();
  const [d, setD] = useState<DatiWallet | null>(null);
  const [aggiornando, setAggiornando] = useState(false);

  const carica = useCallback(async () => {
    if (!token) return;
    setD(await homeService.wallet(token).catch(() => null));
  }, [token]);

  useFocusEffect(useCallback(() => { void carica(); }, [carica]));

  if (!d) return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;

  const puntiInEuro = d.puntiPerEuro > 0 ? Math.floor(d.punti / d.puntiPerEuro) : 0;

  return (
    <ScrollView
      style={styles.schermo}
      contentContainerStyle={styles.contenuto}
      refreshControl={
        <RefreshControl refreshing={aggiornando} tintColor={colors.primary}
          onRefresh={async () => { setAggiornando(true); await carica(); setAggiornando(false); }} />
      }
    >
      {/* ── Saldo ── */}
      <Card tone="primary">
        <Text style={styles.etichetta}>Disponibile</Text>
        <Text style={styles.saldo}>{eur(d.totale)}</Text>
        {d.perTasca.map(t => (
          <View key={t.bucket} style={styles.rigaTasca}>
            <Text style={styles.tascaNome}>{t.etichetta}</Text>
            <Text style={styles.tascaImporto}>{eur(t.importo)}</Text>
          </View>
        ))}
      </Card>

      {/* ── In scadenza ── */}
      {d.inScadenza.importo > 0 ? (
        <Card tone="urgent" style={styles.spazio}>
          <Text style={styles.scadenzaTitolo}>
            {eur(d.inScadenza.importo)} {d.inScadenza.giorni === 0 ? 'scadono oggi' : d.inScadenza.giorni === 1 ? 'scadono domani' : `scadono fra ${d.inScadenza.giorni} giorni`}
          </Text>
          <Text style={styles.piccolo}>Usali sul prossimo trattamento: dopo si perdono.</Text>
        </Card>
      ) : null}

      {/* ── Punti ── */}
      <Card style={styles.spazio}>
        <View style={styles.rigaTop}>
          <View>
            <Text style={styles.etichetta}>Beauty Points</Text>
            <Text style={styles.punti}>{d.punti}</Text>
          </View>
          {puntiInEuro > 0 ? <Chip testo={`valgono ${eur(puntiInEuro)}`} /> : null}
        </View>
        <Text style={styles.piccolo}>
          {d.puntiPerEuro} punti = 1 € di credito. Chiedi in negozio per convertirli.
        </Text>
      </Card>

      {/* ── Movimenti ── */}
      <Text style={styles.sezione}>Movimenti</Text>
      {d.movimenti.length === 0 ? (
        <Card style={styles.spazio}>
          <Text style={styles.piccolo}>Ancora nessun movimento. Il credito matura a ogni trattamento.</Text>
        </Card>
      ) : (
        d.movimenti.map(m => (
          <Card key={m.id} style={styles.spazioMini}>
            <View style={styles.rigaTop}>
              <View style={styles.movTesti}>
                <Text style={styles.movMotivo}>{m.reason}</Text>
                <Text style={styles.piccolo}>
                  {data(m.createdAt)} · {m.etichettaTasca}
                  {m.expiresAt && !m.scaduto ? ` · scade il ${data(m.expiresAt)}` : ''}
                  {m.scaduto ? ' · scaduto' : ''}
                </Text>
              </View>
              <Text style={[
                styles.movImporto,
                { color: m.scaduto ? colors.textMuted : m.amount >= 0 ? colors.success : colors.textPrimary },
              ]}>
                {m.kind === 'credit'
                  ? `${m.amount >= 0 ? '+' : ''}${eur(m.amount)}`
                  : `${m.amount >= 0 ? '+' : ''}${m.amount} pt`}
              </Text>
            </View>
          </Card>
        ))
      )}
      <View style={styles.fondo} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  schermo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.md },
  etichetta: { ...typography.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fonts.w700 },
  saldo: { fontSize: 34, fontFamily: fonts.w700, color: colors.primaryDark, marginVertical: spacing.xs },
  rigaTasca: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  tascaNome: { ...typography.caption, color: colors.textSecondary },
  tascaImporto: { ...typography.caption, color: colors.textPrimary, fontFamily: fonts.w600 },
  spazio: { marginTop: spacing.md },
  spazioMini: { marginTop: spacing.sm },
  scadenzaTitolo: { ...typography.body, color: colors.urgent, fontFamily: fonts.w700 },
  piccolo: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  rigaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  punti: { ...typography.title, color: colors.textPrimary },
  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.lg },
  movTesti: { flex: 1, paddingRight: spacing.sm },
  movMotivo: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.w600 },
  movImporto: { ...typography.body, fontFamily: fonts.w700 },
  fondo: { height: spacing.xl },
});
