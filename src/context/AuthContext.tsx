/**
 * Contesto di autenticazione globale.
 *
 * Espone `user`, `isLoading` e le azioni richiediCodice/verificaCodice/signOut.
 * Al mount ripristina la sessione dal token salvato in SecureStore;
 * finché il ripristino è in corso `isLoading` resta true e il root
 * layout mostra lo splash (nessun flash della schermata sbagliata).
 */
import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { authService, RichiestaCodice, User } from '@/api';
import {
  clearSessionToken,
  getSessionToken,
  saveSessionToken,
} from '@/storage/secureSession';

export interface AuthContextValue {
  /** Utente loggata, o null se non autenticata */
  user: User | null;
  /** Token di sessione per le chiamate API autenticate */
  token: string | null;
  /** true durante il ripristino iniziale della sessione */
  isLoading: boolean;
  /** Manda il codice su WhatsApp. Non apre ancora nessuna sessione. */
  richiediCodice: (telefono: string) => Promise<RichiestaCodice>;
  /** Verifica il codice: se torna, la cliente è dentro. */
  verificaCodice: (telefono: string, codice: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Ripristino sessione al primo avvio
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const savedToken = await getSessionToken();
        if (savedToken) {
          const restoredUser = await authService.restoreSession(savedToken);
          if (!cancelled && restoredUser) {
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

  const richiediCodice = useCallback(
    (telefono: string) => authService.richiediCodice(telefono),
    []
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

  const signOut = useCallback(async () => {
    try {
      if (token) await authService.signOut(token);
    } finally {
      // La sessione locale va chiusa anche se la chiamata remota fallisce
      await clearSessionToken();
      setUser(null);
      setToken(null);
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, richiediCodice, verificaCodice, signOut }),
    [user, token, isLoading, richiediCodice, verificaCodice, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
