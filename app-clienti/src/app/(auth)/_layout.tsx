/**
 * Stack di chi non ha ancora fatto l'accesso.
 *
 * Due schermate: l'introduzione (solo la prima volta che l'app viene aperta) e
 * l'accesso con numero e codice WhatsApp. Non servono registrazione né
 * recupero password — chi è cliente del centro ha già un account, chi non lo è
 * si registra in negozio.
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
      {/* L'accesso è dichiarato per primo perché è la schermata da cui parte
          il gruppo: l'introduzione si raggiunge solo se non è ancora stata
          vista, e lo decide la schermata di accesso. Con l'ordine invertito,
          l'introduzione ricomparirebbe a ogni apertura. */}
      <Stack.Screen name="login" />
      <Stack.Screen name="intro" />
    </Stack>
  );
}
