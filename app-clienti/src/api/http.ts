/**
 * Client HTTP minimale verso le API /api/mobile/ del gestionale.
 * Converte le risposte di errore del server in ApiError tipizzati.
 */
import { API_BASE_URL } from './config';
import { ApiError, ApiErrorCode } from './types';

const KNOWN_CODES: ApiErrorCode[] = [
  'INVALID_CREDENTIALS',
  'USER_NOT_FOUND',
  'UNAUTHORIZED',
  'VALIDATION',
  'NOT_FOUND',
  'NOT_CANCELLABLE',
  'LOCKED',
  'TOO_LATE',
  'TOO_MANY',
];

interface RequestOptions {
  method?: 'GET' | 'POST';
  /** Token di sessione: aggiunge l'header Authorization */
  token?: string;
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token, body } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'Impossibile contattare il server. Controlla la connessione e riprova.'
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const code: ApiErrorCode = KNOWN_CODES.includes(data?.code) ? data.code : 'UNKNOWN';
    const message =
      typeof data?.error === 'string' ? data.error : 'Si è verificato un errore. Riprova.';
    throw new ApiError(code, message);
  }

  return data as T;
}
