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
/** Se l'introduzione è già stata vista: si mostra una volta sola. */
const INTRO_KEY = 'revobeauty.intro.vista';
/** Scelta sullo sblocco biometrico: '1' attivo, '0' rifiutato, assente = mai chiesto. */
const FACEID_KEY = 'revobeauty.faceid.scelta';

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

/**
 * L'introduzione si vede solo la prima volta.
 *
 * Il ricordo sta sul telefono e non sul server perché riguarda l'installazione,
 * non la persona: chi cambia telefono la rivede, ed è giusto così. Un errore di
 * lettura non deve bloccare l'avvio, quindi in caso di dubbio si considera già
 * vista — meglio non mostrarla che tenere una cliente ferma davanti a un errore.
 */
export async function introGiaVista(): Promise<boolean> {
  try {
    const v = isWeb ? localStorage.getItem(INTRO_KEY) : await SecureStore.getItemAsync(INTRO_KEY);
    return v === '1';
  } catch {
    return true;
  }
}

export async function segnaIntroVista(): Promise<void> {
  try {
    if (isWeb) localStorage.setItem(INTRO_KEY, '1');
    else await SecureStore.setItemAsync(INTRO_KEY, '1');
  } catch {
    // Se non si riesce a ricordarlo, al massimo la rivede: non è un problema
  }
}

/**
 * La scelta sullo sblocco con Face ID, come le app delle banche:
 * si chiede una volta dopo il primo accesso, e si può rispondere no.
 * 'attivo' | 'rifiutato' | null (null = mai chiesto).
 * In caso di errore di lettura si considera "mai chiesto": al massimo
 * la domanda ricompare, nessuno resta chiuso fuori.
 */
export async function sceltaFaceId(): Promise<'attivo' | 'rifiutato' | null> {
  try {
    const v = isWeb ? localStorage.getItem(FACEID_KEY) : await SecureStore.getItemAsync(FACEID_KEY);
    if (v === '1') return 'attivo';
    if (v === '0') return 'rifiutato';
    return null;
  } catch {
    return null;
  }
}

export async function salvaSceltaFaceId(attiva: boolean): Promise<void> {
  try {
    const v = attiva ? '1' : '0';
    if (isWeb) localStorage.setItem(FACEID_KEY, v);
    else await SecureStore.setItemAsync(FACEID_KEY, v);
  } catch {
    // Non memorizzata: la domanda ricomparirà alla prossima apertura
  }
}
