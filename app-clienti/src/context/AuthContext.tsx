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
  salvaSceltaFaceId,
  saveSessionToken,
  sceltaFaceId,
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
   * true quando l'app si è riaperta con una sessione salvata e la cliente
   * ha ATTIVATO lo sblocco biometrico: prima di mostrare i dati si chiede
   * Face ID. Un accesso appena fatto col numero non lo richiede: è lì lei.
   */
  sbloccoNecessario: boolean;
  /** Chiamata dal blocco biometrico quando Face ID va a buon fine. */
  sblocca: () => void;
  /** true finché l'account non ha una password: l'app la fa creare subito. */
  passwordDaImpostare: boolean;
  /** Accesso con numero + password (la porta normale dopo la prima volta). */
  accediConPassword: (telefono: string, password: string) => Promise<void>;
  /** Crea la password dell'account e apre la porta. */
  creaPassword: (password: string) => Promise<void>;
  /**
   * true subito dopo il primo accesso, se il telefono ha Face ID/impronta
   * e la domanda non è mai stata fatta: si chiede il consenso una volta sola.
   */
  consensoFaceIdDaChiedere: boolean;
  /** Registra la risposta alla domanda sul Face ID ('Attiva' o 'Non ora'). */
  rispondiConsensoFaceId: (attiva: boolean) => Promise<void>;
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
  const [passwordDaImpostare, setPasswordDaImpostare] = useState<boolean>(false);
  const [consensoFaceIdDaChiedere, setConsensoFaceIdDaChiedere] = useState<boolean>(false);

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
          const restored = await authService.restoreSession(savedToken);
          const restoredUser = restored?.user ?? null;
          if (!cancelled && restored) setPasswordDaImpostare(restored.passwordDaImpostare);
          if (!cancelled && restoredUser) {
            // Sessione ripristinata senza che nessuno abbia digitato nulla:
            // se la cliente ha attivato lo sblocco biometrico, i dati restano
            // coperti finché Face ID (o l'impronta) non conferma che è lei.
            // Chi ha risposto "Non ora" entra diretta, come ha scelto.
            const scelta = await sceltaFaceId();
            if (scelta === 'attivo' && (await biometriaDisponibile())) {
              setSbloccoNecessario(true);
            }
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
   * Dopo un accesso fatto a mano: se la domanda sul Face ID non è mai stata
   * fatta e il telefono lo supporta, è il momento giusto per farla — una
   * volta sola, come le app delle banche.
   */
  const valutaConsensoFaceId = useCallback(async () => {
    const scelta = await sceltaFaceId();
    if (scelta === null && (await biometriaDisponibile())) {
      setConsensoFaceIdDaChiedere(true);
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
        await valutaConsensoFaceId();
        setPasswordDaImpostare(!!esito.passwordDaImpostare);
        setUser(esito.user);
        setToken(esito.token);
      }
      return esito;
    },
    [persistToken, valutaConsensoFaceId]
  );

  const verificaCodice = useCallback(
    async (telefono: string, codice: string) => {
      const session = await authService.verificaCodice(telefono, codice);
      await persistToken(session.token);
      await valutaConsensoFaceId();
      setUser(session.user);
      setToken(session.token);
    },
    [persistToken, valutaConsensoFaceId]
  );

  /**
   * Risposta alla domanda sul Face ID.
   *
   * "Attiva" fa partire subito una verifica biometrica: così il consenso di
   * sistema di iOS compare adesso, davanti alla cliente, e non a sorpresa
   * alla prossima apertura. Se la verifica non va a buon fine la scelta non
   * viene salvata e la schermata resta lì (torna false).
   */
  const rispondiConsensoFaceId = useCallback(async (attiva: boolean) => {
    if (!attiva) {
      await salvaSceltaFaceId(false);
      setConsensoFaceIdDaChiedere(false);
      return;
    }
    try {
      const esito = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Attiva lo sblocco con Face ID',
        cancelLabel: 'Annulla',
      });
      if (esito.success) {
        await salvaSceltaFaceId(true);
        setConsensoFaceIdDaChiedere(false);
      }
    } catch {
      // Biometria che non risponde: non si blocca nulla, la scelta resta aperta
    }
  }, []);

  // Il ricordo va tenuto anche qui, non solo sul telefono: la schermata di
  // accesso decide su questo valore, e se restasse a "non vista" rimanderebbe
  // subito indietro all'introduzione, in cerchio.
  const concludiIntro = useCallback(async () => {
    await segnaIntroVista();
    setIntroVista(true);
  }, []);

  const sblocca = useCallback(() => setSbloccoNecessario(false), []);

  const accediConPassword = useCallback(
    async (telefono: string, password: string) => {
      const session = await authService.accediConPassword(telefono, password);
      await persistToken(session.token);
      await valutaConsensoFaceId();
      setPasswordDaImpostare(false);
      setUser(session.user);
      setToken(session.token);
    },
    [persistToken, valutaConsensoFaceId]
  );

  const creaPassword = useCallback(
    async (password: string) => {
      if (!token) return;
      await authService.impostaPassword(token, password);
      setPasswordDaImpostare(false);
    },
    [token]
  );

  const signOut = useCallback(async () => {
    try {
      if (token) await authService.signOut(token);
    } finally {
      // La sessione locale va chiusa anche se la chiamata remota fallisce
      await clearSessionToken();
      setUser(null);
      setToken(null);
      setSbloccoNecessario(false);
      setConsensoFaceIdDaChiedere(false);
      setPasswordDaImpostare(false);
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user, token, isLoading, introVista, sbloccoNecessario,
      sblocca, consensoFaceIdDaChiedere, rispondiConsensoFaceId,
      passwordDaImpostare, accediConPassword, creaPassword,
      concludiIntro, richiediCodice, verificaCodice, signOut,
    }),
    [user, token, isLoading, introVista, sbloccoNecessario, sblocca,
     consensoFaceIdDaChiedere, rispondiConsensoFaceId,
     passwordDaImpostare, accediConPassword, creaPassword,
     concludiIntro, richiediCodice, verificaCodice, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
