/**
 * Tipi condivisi del layer API.
 * Rispecchiano le risposte delle route /api/mobile/ del gestionale.
 */

/** Cliente autenticata del centro estetico */
export interface User {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string | null;
  /** 'F' | 'M' — determina i prezzi del listino */
  gender: 'F' | 'M' | null;
  loyaltyPoints: number;
  /** Credito accumulato, in euro */
  cashback: number;
  /** Livello fedeltà assegnato dal centro (0 = nessuno) */
  vipLevel: number;
  /** Data di creazione della scheda cliente (ISO 8601) */
  createdAt: string;
}

/** Risposta di login/registrazione: utente + token di sessione */
export interface AuthSession {
  user: User;
  /** Token Bearer per le chiamate autenticate */
  token: string;
}

/**
 * Esito della richiesta del codice.
 *
 * `codiceDiProva` arriva SOLO dai server di sviluppo, dove WhatsApp non è
 * configurato: in produzione il codice viaggia solo su WhatsApp.
 */
export interface RichiestaCodice {
  ok: true;
  inviato: boolean;
  scadeTraMinuti: number;
  nome?: string;
  codiceDiProva?: string;
  avviso?: string;
}

// ---------- Listino (tab Pacchetti) ----------

export interface CatalogPackage {
  id: string;
  name: string;
  type: string;
  price: number;
  totalSessions: number;
  description: string | null;
  treatmentName: string | null;
  color: string;
}

export interface CatalogTreatment {
  id: string;
  name: string;
  /** Durata in minuti, già personalizzata per sesso */
  duration: number;
  /** Prezzo già personalizzato per sesso */
  price: number;
  description: string | null;
}

export interface CatalogCategory {
  name: string;
  treatments: CatalogTreatment[];
}

export interface ListinoData {
  gender: 'F' | 'M' | null;
  packages: CatalogPackage[];
  categories: CatalogCategory[];
}

// ---------- Appuntamenti ----------

export interface Appointment {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  startTime: string;
  endTime: string;
  treatmentName: string;
  treatmentCategory: string;
  operatorName: string;
  status: string;
  price: number;
  /** true se la disdetta è consentita (calcolato dal server, regola 24h) */
  canCancel: boolean;
}

export interface AppointmentsData {
  upcoming: Appointment[];
  past: Appointment[];
}

// ---------- Errori ----------

export type ApiErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'NOT_CANCELLABLE'
  | 'LOCKED'
  | 'TOO_LATE'
  | 'TOO_MANY'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

/**
 * Errore applicativo del layer API.
 * `code` permette alla UI di distinguere i casi senza fare
 * parsing dei messaggi (che sono comunque già in italiano).
 */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
