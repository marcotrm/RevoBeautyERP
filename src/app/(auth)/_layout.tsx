/**
 * Stack di autenticazione (utente NON loggata).
 *
 * Una schermata sola: si entra con numero e codice WhatsApp, quindi non
 * servono registrazione né recupero password — chi è cliente del centro ha
 * già un account, chi non lo è si registra in negozio.
 */
import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="login" />
    </Stack>
  );
}
