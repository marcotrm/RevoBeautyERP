/**
 * Porta un'amica: codice personale, condivisione e stato degli inviti.
 *
 * Il premio si vede maturare passo per passo (invitata → registrata →
 * diventata cliente) perché il credito arriva solo alla fine: se il percorso
 * non fosse visibile sembrerebbe che il premio non arrivi mai.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, View, ScrollView } from 'react-native';

import { ApiError, homeService, type DatiReferral } from '@/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { colors, spacing, typography } from '@/theme';

const eur = (n: number) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })} €`;

const STATI: Record<string, { testo: string; colore: string; sfondo: string }> = {
  invited: { testo: 'invitata', colore: colors.textSecondary, sfondo: colors.backgroundAlt },
  registered: { testo: 'registrata', colore: colors.flash, sfondo: colors.flashSoft },
  converted: { testo: 'cliente!', colore: colors.success, sfondo: colors.successSoft },
  blocked: { testo: 'non valida', colore: colors.error, sfondo: colors.urgentSoft },
};

export default function InvitaScreen() {
  const { token } = useAuth();
  const [d, setD] = useState<DatiReferral | null>(null);
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [occupato, setOccupato] = useState(false);

  const carica = useCallback(async () => {
    if (!token) return;
    setD(await homeService.referral(token).catch(() => null));
  }, [token]);

  useFocusEffect(useCallback(() => { void carica(); }, [carica]));

  const condividi = async () => {
    if (!d) return;
    try { await Share.share({ message: d.testoDaCondividere }); } catch { /* l'utente ha annullato */ }
  };

  const invita = async () => {
    if (!token) return;
    setOccupato(true);
    try {
      await homeService.invita(token, nome.trim(), telefono.replace(/\D/g, ''));
      setNome(''); setTelefono('');
      Alert.alert('Invito registrato', 'Adesso mandale il tuo codice: il credito arriva quando viene a farsi il primo trattamento.');
      await carica();
    } catch (e) {
      Alert.alert('Non è andata', e instanceof ApiError ? e.message : 'Riprova.');
    } finally {
      setOccupato(false);
    }
  };

  if (!d) return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView style={styles.schermo} contentContainerStyle={styles.contenuto} keyboardShouldPersistTaps="handled">
      <Card tone="primary">
        <Text style={styles.etichetta}>Il tuo codice</Text>
        <Text style={styles.codice}>{d.codice}</Text>
        <Text style={styles.piccolo}>
          {eur(d.premioInvitante)} di credito per te e {eur(d.premioInvitata)} per lei, quando viene la prima volta.
        </Text>
        <View style={styles.spazio}><Button title="Condividi il codice" onPress={condividi} /></View>
      </Card>

      <View style={styles.numeri}>
        {[
          { n: d.invitate, e: 'invitate' },
          { n: d.registrate, e: 'registrate' },
          { n: d.diventateClienti, e: 'venute' },
        ].map(x => (
          <Card key={x.e} style={styles.numero}>
            <Text style={styles.numeroValore}>{x.n}</Text>
            <Text style={styles.piccolo}>{x.e}</Text>
          </Card>
        ))}
      </View>

      {d.creditoGuadagnato > 0 ? (
        <Card tone="success" style={styles.spazio}>
          <Text style={styles.guadagno}>Hai già guadagnato {eur(d.creditoGuadagnato)}</Text>
        </Card>
      ) : null}

      <Text style={styles.sezione}>Segnala un&apos;amica</Text>
      <Card style={styles.spazio}>
        <TextField label="Nome (facoltativo)" placeholder="Come si chiama" value={nome} onChangeText={setNome} editable={!occupato} />
        <TextField
          label="Il suo numero" placeholder="340 123 4567" keyboardType="phone-pad"
          value={telefono} onChangeText={setTelefono} editable={!occupato}
        />
        <Button title="Registra l'invito" onPress={invita} loading={occupato} disabled={telefono.replace(/\D/g, '').length < 9} />
      </Card>

      {d.righe.length ? (
        <>
          <Text style={styles.sezione}>Le tue amiche</Text>
          {d.righe.map((r, i) => {
            const s = STATI[r.stato] ?? STATI.invited;
            return (
              <Card key={i} style={styles.spazioMini}>
                <View style={styles.rigaTop}>
                  <View style={styles.testi}>
                    <Text style={styles.nomeAmica}>{r.nome || 'Amica'}</Text>
                    <Text style={styles.piccolo}>{r.telefono}</Text>
                  </View>
                  <Chip testo={s.testo} colore={s.colore} sfondo={s.sfondo} />
                </View>
              </Card>
            );
          })}
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
  etichetta: { ...typography.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },
  codice: { fontSize: 30, fontWeight: '700', color: colors.primaryDark, letterSpacing: 2, marginVertical: spacing.xs },
  piccolo: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  spazio: { marginTop: spacing.md },
  spazioMini: { marginTop: spacing.sm },
  numeri: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  numero: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  numeroValore: { ...typography.title, color: colors.textPrimary },
  guadagno: { ...typography.body, color: colors.success, fontWeight: '700' },
  sezione: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.lg },
  rigaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  testi: { flex: 1 },
  nomeAmica: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  fondo: { height: spacing.xl },
});
