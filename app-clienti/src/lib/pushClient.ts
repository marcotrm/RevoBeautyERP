/**
 * Registrazione alle notifiche push.
 *
 * Chiede il permesso, prende il token Expo del telefono e lo consegna al
 * gestionale. Tutto in punta di piedi: se qualcosa non c'è (web, Expo Go,
 * permesso negato) l'app funziona identica, solo senza avvisi.
 *
 * Nota: dentro Expo Go le push remote non sono supportate — il token non
 * si ottiene e va bene così. Si provano davvero sulla build TestFlight.
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

export async function registraNotifichePush(tokenSessione: string): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;

    const attuale = await Notifications.getPermissionsAsync();
    let stato = attuale.status;
    if (stato !== 'granted') {
      const richiesta = await Notifications.requestPermissionsAsync();
      stato = richiesta.status;
    }
    if (stato !== 'granted') return;

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
  } catch (err) {
    // Expo Go, permessi, rete: qualunque cosa sia, l'app vive lo stesso
    console.log('[push] registrazione saltata:', (err as Error)?.message);
  }
}
