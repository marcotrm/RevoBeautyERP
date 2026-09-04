/**
 * Interfaccia astratta del servizio di autenticazione.
 *
 * Si entra con numero di telefono e codice usa-e-getta ricevuto su WhatsApp:
 * niente password. Chi è già cliente del centro è già "iscritto" — l'account
 * nasce da solo al primo accesso, quindi non esiste una registrazione da fare.
 *
 * Il resto dell'app dipende SOLO da questa interfaccia, mai
 * dall'implementazione concreta.
 */
import { AuthSession, RichiestaCodice, User } from './types';

export interface AuthProvider {
  /** Manda il codice di accesso sul WhatsApp della cliente */
  richiediCodice(telefono: string): Promise<RichiestaCodice>;

  /** Verifica il codice e apre la sessione */
  verificaCodice(telefono: string, codice: string): Promise<AuthSession>;

  /** Accesso con numero + password: la porta normale, dopo la prima volta. */
  accediConPassword(telefono: string, password: string): Promise<AuthSession & { passwordDaImpostare?: boolean }>;

  /** Crea (o cambia) la password dell'account. */
  impostaPassword(token: string, password: string): Promise<void>;

  /** Chiude la sessione lato server */
  signOut(token: string): Promise<void>;

  /**
   * Verifica un token salvato e restituisce l'utente associato,
   * oppure null se il token non è più valido.
   * Usata al riavvio dell'app per ripristinare la sessione.
   */
  restoreSession(token: string): Promise<{ user: User; passwordDaImpostare: boolean } | null>;
}
