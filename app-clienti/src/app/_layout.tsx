/**
 * Layout radice dell'app.
 *
 * Avvolge tutto nell'AuthProvider e usa le route protette di Expo Router:
 * - utente loggata  → gruppo (tabs)
 * - non loggata     → gruppo (auth)
 * Il redirect è automatico: quando `user` cambia, Expo Router sposta
 * la navigazione sul gruppo la cui guardia è attiva.
 */
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BloccoBiometrico } from '@/components/BloccoBiometrico';
import { ConsensoFaceId } from '@/components/ConsensoFaceId';
import { NotifichePush } from '@/components/NotifichePush';
import { SplashAnimata } from '@/components/SplashAnimata';
import { AuthProvider } from '@/context/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { colors, fontAssets } from '@/theme';

function RootNavigator({ fontPronti }: { fontPronti: boolean }) {
  const { user, isLoading, sbloccoNecessario, consensoFaceIdDaChiedere } = useAuth();

  // Splash minimale finché la sessione viene ripristinata da SecureStore:
  // evita il "flash" della schermata di login per un'utente già loggata.
  // Si aspettano anche i font: senza, la prima schermata appare col font di
  // sistema e poi salta al serif sotto gli occhi della cliente.
  if (isLoading || !fontPronti) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // App riaperta con una sessione salvata e Face ID attivo: i dati restano
  // coperti finché la biometria non conferma. Vedi BloccoBiometrico.
  if (user && sbloccoNecessario) {
    return <BloccoBiometrico />;
  }

  // Subito dopo il primo accesso: la domanda sul Face ID, una volta sola.
  if (user && consensoFaceIdDaChiedere) {
    return <ConsensoFaceId />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Se un font non si carica non si resta sullo splash per sempre: meglio
  // l'app col font di sistema che un'app che non parte.
  const [caricati, errore] = useFonts(fontAssets);
  // La splash animata copre l'avvio (caricamento sessione compreso) e
  // si congeda da sola; un tocco la salta.
  const [splashFinita, setSplashFinita] = useState(false);

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <NotifichePush />
      <View style={styles.radice}>
        <RootNavigator fontPronti={caricati || !!errore} />
        {!splashFinita ? <SplashAnimata onFine={() => setSplashFinita(true)} /> : null}
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  radice: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
