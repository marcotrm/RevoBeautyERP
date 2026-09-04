/**
 * Contesto di autenticazione globale.
 *
 * Espone `user`, `isLoading` e le azioni richiediCodice/verificaCodice/signOut.
 * Al mount ripristina la sessione dal token salvato in SecureStore;
 * finché il ripristino è in corso `isLoading` resta true e il root
 * layout mostra lo splash (nessun flash della schermata sbagliata).
 */
import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import { authService, RichiestaCodice, User } from '@/api';
import {
  clearSessionToken,
  getSessionToken,
  introGiaVista,
  saveSessionToken,
  segnaIntroVista,
} from '@/storage/secureSession';

export interface AuthContextValue {
  /** Utente loggata, o null se non autenticata */
  user: User | null;
  /** Token di sessione per le chiamate API autenticate */
  token: string | null;
  /** true durante il ripristino iniziale della sessione */
  isLoading: boolean;
  /** false solo alla primissima apertura dell'app su questo telefono */
  introVista: boolean;
  /**
   * true quando l'app si è riaperta con una sessione salvata e il telefono
   * ha Face ID/impronta: prima di mostrare i dati si chiede lo sblocco.
   * Un accesso appena fatto col numero non lo richiede: la persona è lì.
   */
  sbloccoNecessario: boolean;
  /** Chiamata dal blocco biometrico quando Face ID va a buon fine. */
  sblocca: () => void;
  /** Chiude l'introduzione: la ricorda sul telefono e sblocca l'accesso. */
  concludiIntro: () => Promise<void>;
  /** Manda il codice su WhatsApp. Non apre ancora nessuna sessione. */
  richiediCodice: (telefono: string) => Promise<RichiestaCodice>;
  /** Verifica il codice: se torna, la cliente è dentro. */
  verificaCodice: (telefono: string, codice: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * C'è una biometria utilizzabile su questo dispositivo?
 * Sul web non esiste; su un telefono senza Face ID/impronta configurati
 * la risposta è no e l'app si apre come sempre, senza blocco.
 */
async function biometriaDisponibile(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const [hardware, registrata] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hardware && registrata;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [introVista, setIntroVista] = useState<boolean>(true);
  const [sbloccoNecessario, setSbloccoNecessario] = useState<boolean>(false);

  // Ripristino sessione al primo avvio
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Si legge insieme alla sessione: due attese in fila allungherebbero
        // lo splash senza motivo.
        const vista = await introGiaVista();
        if (!cancelled) setIntroVista(vista);

        const savedToken = await getSessionToken();
        if (savedToken) {
          const restoredUser = await authService.restoreSession(savedToken);
          if (!cancelled && restoredUser) {
            // Sessione ripristinata senza che nessuno abbia digitato nulla:
            // se il telefono ha la biometria, i dati restano coperti finché
            // Face ID (o l'impronta) non conferma che è davvero lei.
            if (await biometriaDisponibile()) setSbloccoNecessario(true);
            setUser(restoredUser);
            setToken(savedToken);
          } else if (!cancelled) {
            // Token scaduto o non valido: pulizia
            await clearSessionToken();
          }
        }
      } catch {
        // In caso di errore imprevisto si riparte da non autenticata
        await clearSessionToken();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Salva il token senza propagare eventuali errori di storage:
   * un problema di persistenza non deve annullare un login riuscito
   * (al peggio la sessione non sopravvive al riavvio dell'app).
   */
  const persistToken = useCallback(async (sessionToken: string) => {
    try {
      await saveSessionToken(sessionToken);
    } catch (error) {
      console.warn('Impossibile salvare il token di sessione:', error);
    }
  }, []);

  /**
   * Primo passo dell'accesso.
   *
   * Se il gestionale risponde con una sessione gia' aperta (accesso col solo
   * numero) si entra qui, senza passare dalla schermata del codice: la
   * navigazione la fa da sola il layout radice appena `user` cambia.
   */
  const richiediCodice = useCallback(
    async (telefono: string) => {
      const esito = await authService.richiediCodice(telefono);
      if (esito.accessoDiretto && esito.token && esito.user) {
        await persistToken(esito.token);
        setUser(esito.user);
        setToken(esito.token);
      }
      return esito;
    },
    [persistToken]
  );

  const verificaCodice = useCallback(
    async (telefono: string, codice: string) => {
      const session = await authService.verificaCodice(telefono, codice);
      await persistToken(session.token);
      setUser(session.user);
      setToken(session.token);
    },
    [persistToken]
  );

  // Il ricordo va tenuto anche qui, non solo sul telefono: la schermata di
  // accesso decide su questo valore, e se restasse a "non vista" rimanderebbe
  // subito indietro all'introduzione, in cerchio.
  const concludiIntro = useCallback(async () => {
    await segnaIntroVista();
    setIntroVista(true);
  }, []);

  const sblocca = useCallback(() => setSbloccoNecessario(false), []);

  const signOut = useCallback(async () => {
    try {
      if (token) await authService.signOut(token);
    } finally {
      // La sessione locale va chiusa anche se la chiamata remota fallisce
      await clearSessionToken();
      setUser(null);
      setToken(null);
      setSbloccoNecessario(false);
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user, token, isLoading, introVista, sbloccoNecessario,
      sblocca, concludiIntro, richiediCodice, verificaCodice, signOut,
    }),
    [user, token, isLoading, introVista, sbloccoNecessario, sblocca, concludiIntro, richiediCodice, verificaCodice, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
