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
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider } from '@/context/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { colors, fontAssets } from '@/theme';

function RootNavigator({ fontPronti }: { fontPronti: boolean }) {
  const { user, isLoading } = useAuth();

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

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator fontPronti={caricati || !!errore} />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
