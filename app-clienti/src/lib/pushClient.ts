/**
 * Registrazione alle notifiche push — in due tempi, come vuole Apple.
 *
 * 1. All'accesso: registrazione SILENZIOSA. Su iOS si usa il permesso
 *    "provvisorio": le notifiche partono subito, senza nessuna finestra di
 *    richiesta — arrivano discrete nel centro notifiche ed è iOS stesso, sulla
 *    prima, a chiedere "Mantieni / Disattiva". Su Android non esiste il
 *    provvisorio: si registra solo se il permesso c'è già, senza disturbare.
 *
 * 2. Nel momento giusto (es. quando la cliente attiva un avviso di lista
 *    d'attesa): `attivaNotifichePiene` mostra la richiesta vera, quella con
 *    banner e suono. Chiesta lì, quando il valore è evidente, quasi tutte
 *    dicono sì.
 *
 * Nota: dentro Expo Go le push remote non sono supportate — qualsiasi
 * errore muore in silenzio e si prova tutto sulla build TestFlight.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiRequest } from '@/api/http';

// Con l'app aperta, l'avviso si mostra comunque (banner discreto, no suono):
// un posto liberato in lista d'attesa vale anche se stai guardando il listino.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function consegnaTokenAlServer(tokenSessione: string): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'RevoBeauty',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  await apiRequest('/api/mobile/push/register', {
    method: 'POST',
    token: tokenSessione,
    body: { token: pushToken, platform: Platform.OS },
  });
}

/**
 * Registrazione silenziosa all'accesso: mai una finestra di permesso qui.
 * iOS → permesso provvisorio (notifiche discrete, subito attive).
 * Android → solo se il permesso è già stato concesso altrove.
 */
export async function registraNotifichePush(tokenSessione: string): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;

    const attuale = await Notifications.getPermissionsAsync();

    if (attuale.status !== 'granted') {
      if (Platform.OS === 'ios') {
        // allowProvisional: iOS concede senza mostrare nulla alla cliente
        const esito = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowProvisional: true,
          },
        });
        if (esito.status !== 'granted') return;
      } else {
        // Android: niente prompt all'avvio, se ne parla al momento giusto
        return;
      }
    }

    await consegnaTokenAlServer(tokenSessione);
  } catch (err) {
    // Expo Go, permessi, rete: qualunque cosa sia, l'app vive lo stesso
    console.log('[push] registrazione silenziosa saltata:', (err as Error)?.message);
  }
}

/**
 * La richiesta piena (banner + suono), da chiamare quando la cliente fa
 * qualcosa per cui le notifiche servono chiaramente — es. attiva un avviso
 * di lista d'attesa. Se il permesso arriva, il token va subito al server.
 */
export async function attivaNotifichePiene(tokenSessione: string): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;

    const esito = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    if (esito.status !== 'granted') return;

    await consegnaTokenAlServer(tokenSessione);
  } catch (err) {
    console.log('[push] richiesta piena saltata:', (err as Error)?.message);
  }
}
