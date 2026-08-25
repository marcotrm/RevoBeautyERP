/**
 * Beauty Wallet: quanto c'è, di che tipo e cosa sta per scadere.
 *
 * La divisione in tasche non è un dettaglio contabile: dice alla cliente cosa
 * rischia di perdere. Un totale unico nasconde proprio l'informazione che
 * la farebbe tornare.
 *
 * Il saldo è il fatto grande e sta senza riquadro intorno — un numero a 40px
 * su fondo avorio non ha bisogno di una cornice per farsi guardare. L'unico
 * accento della schermata è il credito in scadenza, marcato da una barretta
 * rossa a lato: è l'unica cosa che si perde davvero.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { homeService, type DatiWallet } from '@/api';
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
  const scadenza = d.inScadenza.giorni === 0
    ? 'scadono oggi'
    : d.inScadenza.giorni === 1 ? 'scadono domani' : `scadono fra ${d.inScadenza.giorni} giorni`;

  return (
    <ScrollView
      style={styles.schermo}
      contentContainerStyle={styles.contenuto}
      refreshControl={
        <RefreshControl refreshing={aggiornando} tintColor={colors.primary}
          onRefresh={async () => { setAggiornando(true); await carica(); setAggiornando(false); }} />
      }
    >
      {/* ── Il saldo, senza cornice ── */}
      <View style={styles.hero}>
        <Text style={styles.occhiello}>Disponibile</Text>
        <Text style={styles.saldo}>{eur(d.totale)}</Text>
        {d.perTasca.map(t => (
          <View key={t.bucket} style={styles.rigaTasca}>
            <Text style={styles.piccolo}>{t.etichetta}</Text>
            <Text style={styles.tascaImporto}>{eur(t.importo)}</Text>
          </View>
        ))}
      </View>

      {/* ── L'unico accento: quello che si perde ── */}
      {d.inScadenza.importo > 0 ? (
        <View style={styles.avviso}>
          <Text style={styles.avvisoTitolo}>{eur(d.inScadenza.importo)} {scadenza}</Text>
          <Text style={styles.piccolo}>Usali sul prossimo trattamento: dopo si perdono.</Text>
        </View>
      ) : null}

      {/* ── I punti: un promemoria, non un'urgenza ── */}
      <Text style={styles.vita}>
        {d.punti} punti
        {puntiInEuro > 0 ? <Text style={styles.valgono}>{`  ·  valgono ${eur(puntiInEuro)}`}</Text> : null}
      </Text>
      <Text style={styles.piccolo}>
        {d.puntiPerEuro} punti = 1 € di credito. Chiedi in negozio per convertirli.
      </Text>

      {/* ── I movimenti: una lista ── */}
      <Text style={styles.sezione}>Movimenti</Text>
      {d.movimenti.length === 0 ? (
        <Text style={styles.vuoto}>Ancora nessun movimento. Il credito matura a ogni trattamento.</Text>
      ) : (
        <View style={styles.lista}>
          {d.movimenti.map(m => (
            <View key={m.id} style={styles.riga}>
              <View style={styles.movTesti}>
                <Text style={styles.forte}>{m.reason}</Text>
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
          ))}
        </View>
      )}

      <View style={styles.fondo} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  schermo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { paddingHorizontal: spacing.lg },

  hero: { paddingTop: spacing.md, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  occhiello: { ...typography.occhiello, color: colors.textSecondary },
  saldo: {
    fontFamily: fonts.w600, fontSize: 40, letterSpacing: -1,
    fontVariant: ['tabular-nums'], color: colors.textPrimary,
    marginTop: spacing.xs, marginBottom: spacing.md,
  },
  rigaTasca: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: spacing.xs + 2, marginTop: spacing.xs + 2,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  tascaImporto: { ...typography.captionForte, color: colors.textPrimary, fontVariant: ['tabular-nums'] },

  avviso: {
    marginTop: spacing.lg, paddingLeft: spacing.md,
    paddingVertical: spacing.sm + 2, borderLeftWidth: 2, borderLeftColor: colors.urgent,
  },
  avvisoTitolo: { ...typography.bodyForte, color: colors.urgent },

  vita: { ...typography.body, color: colors.textPrimary, marginTop: spacing.lg },
  valgono: { ...typography.caption, color: colors.primaryDark, fontFamily: fonts.w600 },

  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.xl },
  lista: { marginTop: spacing.sm },
  riga: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  movTesti: { flex: 1 },
  forte: { ...typography.bodyForte, color: colors.textPrimary },
  piccolo: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  movImporto: { ...typography.bodyForte, fontVariant: ['tabular-nums'] },

  vuoto: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 24 },
  fondo: { height: spacing.xxl },
});
