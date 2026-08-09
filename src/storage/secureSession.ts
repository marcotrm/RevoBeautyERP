/**
 * Persistenza del token di sessione.
 *
 * - iOS/Android: expo-secure-store (Keychain / Keystore, cifrato).
 * - Web: localStorage — expo-secure-store non esiste nel browser e farebbe
 *   fallire il login quando l'app viene aperta dal dev server in Safari/Chrome.
 *   Il web è solo un canale di sviluppo/anteprima, quindi il fallback è accettabile.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'revobeauty.session.token';

const isWeb = Platform.OS === 'web';

export async function saveSessionToken(token: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getSessionToken(): Promise<string | null> {
  if (isWeb) {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearSessionToken(): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
