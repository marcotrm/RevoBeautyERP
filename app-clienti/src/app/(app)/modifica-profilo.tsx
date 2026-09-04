/**
 * Completa il tuo profilo: la foto del volto e i dati personali.
 *
 * La foto si sceglie dal rullino, si ritaglia quadrata e viene compressa
 * QUI sul telefono (400px, jpeg) prima di partire: al server arrivano
 * ~40 KB, non la foto originale da 8 MB.
 */
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { ApiError, ModificheProfilo, ProfiloCliente, profiloService } from '@/api';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { GenderSelector } from '@/components/ui/GenderSelector';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/theme';

export default function ModificaProfiloScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [profilo, setProfilo] = useState<ProfiloCliente | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [nascita, setNascita] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [citta, setCitta] = useState('');
  const [gender, setGender] = useState<'F' | 'M' | undefined>(undefined);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!token) return;
    profiloService
      .get(token)
      .then((r) => {
        setProfilo(r.profilo);
        setAvatar(r.profilo.avatar);
        setEmail(r.profilo.email);
        setNascita(r.profilo.birthDate);
        setIndirizzo(r.profilo.address);
        setCitta(r.profilo.city);
        setGender(r.profilo.gender ?? undefined);
      })
      .catch(() => setErrore('Non riusciamo a caricare il profilo.'));
  }, [token]);

  const scegliFoto = async () => {
    setErrore(null);
    try {
      const esito = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (esito.canceled || !esito.assets?.[0]) return;
      // Compressione sul telefono: 400px bastano per un tondo da profilo
      const piccola = await ImageManipulator.manipulateAsync(
        esito.assets[0].uri,
        [{ resize: { width: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (piccola.base64) setAvatar(`data:image/jpeg;base64,${piccola.base64}`);
    } catch {
      setErrore('Non siamo riusciti a leggere la foto. Riprova.');
    }
  };

  const salva = async () => {
    if (!token) return;
    setErrore(null);
    setSalvando(true);
    try {
      const dati: ModificheProfilo = {
        email, birthDate: nascita, address: indirizzo, city: citta,
      };
      if (gender) dati.gender = gender;
      if (avatar !== profilo?.avatar) dati.avatar = avatar ?? '';
      await profiloService.aggiorna(token, dati);
      router.back();
    } catch (e) {
      setErrore(e instanceof ApiError ? e.message : 'Salvataggio non riuscito. Riprova.');
    } finally {
      setSalvando(false);
    }
  };

  if (!profilo && !errore) {
    return <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>;
  }

  const iniziali = `${user?.nome?.[0] ?? ''}${user?.cognome?.[0] ?? ''}`.toUpperCase();

  return (
    <KeyboardAvoidingView style={styles.sfondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenuto} keyboardShouldPersistTaps="handled">
        {/* ── La foto ── */}
        <View style={styles.fotoZona}>
          <Pressable onPress={() => void scegliFoto()}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.foto} />
            ) : (
              <View style={styles.fotoVuota}><Text style={styles.iniziali}>{iniziali}</Text></View>
            )}
            <View style={styles.fotoMatita}>
              <Ionicons name="camera" size={15} color={colors.white} />
            </View>
          </Pressable>
          <Pressable onPress={() => void scegliFoto()}>
            <Text style={styles.fotoTesto}>{avatar ? 'Cambia foto' : 'Aggiungi la tua foto'}</Text>
          </Pressable>
          {avatar ? (
            <Pressable onPress={() => setAvatar(null)}>
              <Text style={styles.fotoTogli}>Togli la foto</Text>
            </Pressable>
          ) : null}
        </View>

        <FormError message={errore} />

        {/* ── I dati (nome e telefono si cambiano in negozio: sono l'identità) ── */}
        <Text style={styles.fisso}>
          {profilo?.nome} {profilo?.cognome} · {profilo?.telefono}
        </Text>

        <TextField
          label="Email"
          placeholder="latuaemail@esempio.it"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!salvando}
        />
        <TextField
          label="Data di nascita"
          placeholder="GG/MM/AAAA"
          keyboardType="numbers-and-punctuation"
          value={nascita}
          onChangeText={setNascita}
          editable={!salvando}
        />
        <TextField
          label="Indirizzo"
          placeholder="Via, numero civico"
          value={indirizzo}
          onChangeText={setIndirizzo}
          editable={!salvando}
        />
        <TextField
          label="Città"
          placeholder="La tua città"
          value={citta}
          onChangeText={setCitta}
          editable={!salvando}
        />
        <GenderSelector value={gender} onChange={setGender} disabled={salvando} />

        <Button title="Salva" onPress={() => void salva()} loading={salvando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sfondo: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  contenuto: { padding: spacing.lg, paddingBottom: spacing.xxl },
  fotoZona: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  foto: { width: 110, height: 110, borderRadius: 55 },
  fotoVuota: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  iniziali: { fontFamily: fonts.w700, fontSize: 34, color: colors.white },
  fotoMatita: {
    position: 'absolute', bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: radius.full,
    backgroundColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  fotoTesto: { ...typography.labelForte, color: colors.primaryDark, marginTop: spacing.xs },
  fotoTogli: { ...typography.caption, color: colors.textSecondary },
  fisso: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
});
