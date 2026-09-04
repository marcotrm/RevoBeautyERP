/**
 * Schermate di secondo livello: si aprono sopra le schede, con il tasto
 * indietro. Stanno fuori da (tabs) di proposito — cinque schede sono già il
 * massimo leggibile in fondo allo schermo, e wallet, percorsi e inviti si
 * raggiungono da lì.
 */
import { Stack } from 'expo-router';

import { colors, typography } from '@/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Indietro',
        headerTintColor: colors.primaryDark,
        headerTitleStyle: { ...typography.subtitle, color: colors.textPrimary },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="appuntamenti" options={{ title: 'I miei appuntamenti' }} />
      <Stack.Screen name="percorsi" options={{ title: 'I miei percorsi' }} />
      <Stack.Screen name="wallet" options={{ title: 'Beauty Wallet' }} />
      <Stack.Screen name="club" options={{ title: 'Beauty Club' }} />
      <Stack.Screen name="invita" options={{ title: 'Porta un\'amica' }} />
      <Stack.Screen name="contatti" options={{ title: 'Scrivici' }} />
      <Stack.Screen name="lista-attesa" options={{ title: 'Avvisami se si libera' }} />
      <Stack.Screen name="score" options={{ title: 'Revo Score' }} />
      <Stack.Screen name="assistente" options={{ title: 'Revo AI' }} />
      <Stack.Screen name="missioni" options={{ title: 'Missioni' }} />
      <Stack.Screen name="passport" options={{ title: 'Beauty Passport' }} />
      <Stack.Screen name="modifica-profilo" options={{ title: 'Il mio profilo' }} />
      <Stack.Screen name="reclamo" options={{ title: 'Reclamo anonimo' }} />
      <Stack.Screen name="sorprese" options={{ title: 'Beauty Box e sfide' }} />
      <Stack.Screen name="checkup" options={{ title: 'Check-up estetico' }} />
      <Stack.Screen name="consulenza" options={{ title: 'Consulenza' }} />
      <Stack.Screen name="risultati" options={{ title: 'I miei risultati' }} />
      <Stack.Screen name="consensi" options={{ title: 'I miei consensi' }} />
    </Stack>
  );
}
