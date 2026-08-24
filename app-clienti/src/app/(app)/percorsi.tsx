/**
 * I miei percorsi + Beauty Journey.
 *
 * Ogni pacchetto mostra a che punto è, quando è stata l'ultima seduta e quando
 * conviene fare la prossima. La data consigliata nasce dal ritmo che la cliente
 * ha davvero tenuto: se le sedute sono troppo poche per un ritmo, non si
 * consiglia niente invece di inventare una data.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { homeService, type Percorso } from '@/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Progress } from '@/components/ui/Progress';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, spacing, typography } from '@/theme';

const data = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: 'long' });

function SchedaPercorso({ p, onPrenota }: { p: Percorso; onPrenota: () => void }) {
  return (
    <Card style={styles.spazio}>
      <View style={styles.rigaTop}>
        <Text style={styles.nome}>{p.nome}</Text>
        {p.omaggio ? <Chip testo="omaggio" colore={colors.reward} sfondo={colors.rewardSoft} /> : null}
      </View>

      <Text style={styles.conteggio}>{p.fatte} / {p.totali} sedute</Text>
      <View style={styles.barra}>
        <Progress percentuale={(p.fatte / Math.max(p.totali, 1)) * 100} colore={p.colore} alta />
      </View>

      {p.ultimaSeduta ? <Text style={styles.riga}>Ultima seduta: {data(p.ultimaSeduta)}</Text> : null}
      {p.prossimaConsigliata ? (
        <Text style={styles.riga}>Prossima consigliata: <Text style={styles.forte}>{data(p.prossimaConsigliata)}</Text></Text>
      ) : null}
      {p.scadenza ? <Text style={styles.riga}>Il pacchetto scade il {data(p.scadenza)}</Text> : null}
      {p.daPagare > 0 ? (
        <Text style={[styles.riga, { color: colors.urgent }]}>Da saldare: {p.daPagare.toFixed(2)} €</Text>
      ) : null}

      {/* Beauty Journey: la timeline delle sedute fatte */}
      {p.tappe.length ? (
        <View style={styles.timeline}>
          {p.tappe.map((t, i) => (
            <View key={i} style={styles.tappa}>
              <View style={styles.tappaColonna}>
                <View style={[styles.pallino, { backgroundColor: p.colore }]} />
                {i < p.tappe.length - 1 ? <View style={styles.filo} /> : null}
              </View>
              <View style={styles.tappaTesti}>
                <Text style={styles.tappaTitolo}>Seduta {t.numero}</Text>
                <Text style={styles.piccolo}>
                  {data(t.data)}{t.operatrice ? ` · ${t.operatrice}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {p.residue > 0 ? (
        <View style={styles.spazio}><Button title="Prenota la prossima" onPress={onPrenota} /></View>
      ) : null}
    </Card>
  );
}

export default function PercorsiScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [d, setD] = useState<{ attivi: Percorso[]; conclusi: Percorso[] } | null>(null);

  const carica = useCallback(async () => {
    if (!token) return;
    setD(await homeService.percorsi(token).catch(() => ({ attivi: [], conclusi: [] })));
  }, [token]);

  useFocusEffect(useCallback(() => { void carica(); }, [carica]));

  if (!d) return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView style={styles.schermo} contentContainerStyle={styles.contenuto}>
      {d.attivi.length === 0 && d.conclusi.length === 0 ? (
        <Card>
          <Text style={styles.nome}>Nessun percorso attivo</Text>
          <Text style={styles.piccolo}>
            I pacchetti che acquisti in centro compaiono qui, con le sedute fatte e quelle che restano.
          </Text>
          <View style={styles.spazio}>
            <Button title="Guarda i pacchetti" onPress={() => router.push('/listino')} />
          </View>
        </Card>
      ) : null}

      {d.attivi.map(p => (
        <SchedaPercorso key={p.id} p={p} onPrenota={() => router.push('/prenota')} />
      ))}

      {d.conclusi.length ? (
        <>
          <Text style={styles.sezione}>Conclusi</Text>
          {d.conclusi.map(p => (
            <Card key={p.id} style={styles.spazioMini}>
              <View style={styles.rigaTop}>
                <Text style={styles.nomeTenue}>{p.nome}</Text>
                <Chip testo={`${p.fatte}/${p.totali}`} colore={colors.textSecondary} sfondo={colors.backgroundAlt} />
              </View>
            </Card>
          ))}
        </>
      ) : null}
      <View style={styles.fondo} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  schermo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.md },
  spazio: { marginTop: spacing.md },
  spazioMini: { marginTop: spacing.sm },
  rigaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nome: { ...typography.subtitle, color: colors.textPrimary, flex: 1 },
  nomeTenue: { ...typography.body, color: colors.textSecondary, flex: 1 },
  conteggio: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.w700, marginTop: spacing.xs },
  barra: { marginVertical: spacing.sm },
  riga: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  forte: { color: colors.textPrimary, fontFamily: fonts.w700 },
  piccolo: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.lg },
  timeline: { marginTop: spacing.md },
  tappa: { flexDirection: 'row', gap: spacing.sm },
  tappaColonna: { alignItems: 'center', width: 16 },
  pallino: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  filo: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  tappaTesti: { flex: 1, paddingBottom: spacing.sm },
  tappaTitolo: { ...typography.label, color: colors.textPrimary, fontFamily: fonts.w600 },
  fondo: { height: spacing.xl },
});
