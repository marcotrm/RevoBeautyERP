/**
 * Configurazione del collegamento al gestionale.
 *
 * In sviluppo l'URL del server viene ricavato automaticamente dall'IP
 * del Mac che serve il bundle Expo (stessa macchina su cui gira il
 * gestionale con `npm run dev`, porta 3000). Può essere forzato con la
 * variabile EXPO_PUBLIC_API_URL (es. per puntare al gestionale in cloud):
 *
 *   EXPO_PUBLIC_API_URL=https://gestionale.revobeauty.it npx expo start
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const GESTIONALE_DEV_PORT = 3000;

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // Sul web l'app è servita dallo stesso Mac del gestionale: usiamo l'host
  // della pagina (funziona sia da localhost sia dal telefono via IP di rete)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:${GESTIONALE_DEV_PORT}`;
  }

  // Nativo (Expo Go): hostUri es. "192.168.68.104:8081" → il gestionale
  // è sullo stesso host che serve il bundle
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${GESTIONALE_DEV_PORT}`;

  return `http://localhost:${GESTIONALE_DEV_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();
