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

  async signOut(token: string): Promise<void> {
    await apiRequest<{ success: boolean }>('/api/mobile/auth/logout', { method: 'POST', token });
  }

  async restoreSession(token: string): Promise<User | null> {
    try {
      const { user } = await apiRequest<{ user: User }>('/api/mobile/auth/me', { token });
      return user;
    } catch {
      // Token scaduto/invalidato (o server irraggiungibile): niente sessione
      return null;
    }
  }
}
