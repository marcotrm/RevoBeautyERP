/**
 * Contratto del servizio appuntamenti + implementazione reale.
 */
import { apiRequest } from './http';
import { AppointmentsData } from './types';

export interface AppointmentsProvider {
  /** Prossimi appuntamenti + storico della cliente loggata */
  list(token: string): Promise<AppointmentsData>;

  /**
   * Disdice un appuntamento. Il server applica la regola delle 24 ore:
   * oltre il limite lancia ApiError con code 'TOO_LATE'.
   */
  cancel(token: string, appointmentId: string): Promise<void>;
  /** Sposta un appuntamento su nuova data/ora (stessa regola 24h). */
  move(token: string, appointmentId: string, date: string, time: string): Promise<void>;
}

export class RealAppointmentsService implements AppointmentsProvider {
  list(token: string): Promise<AppointmentsData> {
    return apiRequest<AppointmentsData>('/api/mobile/appointments', { token });
  }

  async move(token: string, appointmentId: string, date: string, time: string): Promise<void> {
    await apiRequest<{ ok: boolean }>('/api/mobile/appointments/move', {
      method: 'POST', token, body: { appointmentId, date, time },
    });
  }

  async cancel(token: string, appointmentId: string): Promise<void> {
    await apiRequest<{ success: boolean }>('/api/mobile/appointments/cancel', {
      method: 'POST',
      token,
      body: { appointmentId },
    });
  }
}
