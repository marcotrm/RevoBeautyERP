/**
 * Implementazione REALE del servizio di autenticazione:
 * parla con le route /api/mobile/auth/ del gestionale RevoBeauty.
 */
import { AuthProvider } from './AuthProvider';
import { apiRequest } from './http';
import { AuthSession, RichiestaCodice, User } from './types';

export class RealAuthService implements AuthProvider {
  richiediCodice(telefono: string): Promise<RichiestaCodice> {
    return apiRequest<RichiestaCodice>('/api/mobile/auth/request-otp', {
      method: 'POST',
      body: { telefono },
    });
  }

  verificaCodice(telefono: string, codice: string): Promise<AuthSession> {
    return apiRequest<AuthSession>('/api/mobile/auth/verify-otp', {
      method: 'POST',
      body: { telefono, codice },
    });
  }

  accediConPassword(telefono: string, password: string) {
    return apiRequest<AuthSession & { passwordDaImpostare?: boolean }>('/api/mobile/auth/login-password', {
      method: 'POST',
      body: { telefono, password },
    });
  }

  async impostaPassword(token: string, password: string): Promise<void> {
    await apiRequest<{ ok: boolean }>('/api/mobile/auth/set-password', {
      method: 'POST', token, body: { password },
    });
  }

  async signOut(token: string): Promise<void> {
    await apiRequest<{ success: boolean }>('/api/mobile/auth/logout', { method: 'POST', token });
  }

  async restoreSession(token: string): Promise<{ user: User; passwordDaImpostare: boolean } | null> {
    try {
      const r = await apiRequest<{ user: User; passwordDaImpostare?: boolean }>('/api/mobile/auth/me', { token });
      return { user: r.user, passwordDaImpostare: !!r.passwordDaImpostare };
    } catch {
      // Token scaduto/invalidato (o server irraggiungibile): niente sessione
      return null;
    }
  }
}
