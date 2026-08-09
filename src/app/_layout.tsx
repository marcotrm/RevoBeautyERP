/**
 * Layout radice dell'app.
 *
 * Avvolge tutto nell'AuthProvider e usa le route protette di Expo Router:
 * - utente loggata  → gruppo (tabs)
 * - non loggata     → gruppo (auth)
 * Il redirect è automatico: quando `user` cambia, Expo Router sposta
 * la navigazione sul gruppo la cui guardia è attiva.
 */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider } from '@/context/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme';

function RootNavigator() {
  const { user, isLoading } = useAuth();

  // Splash minimale finché la sessione viene ripristinata da SecureStore:
  // evita il "flash" della schermata di login per un'utente già loggata.
  if (isLoading) {
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
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
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
