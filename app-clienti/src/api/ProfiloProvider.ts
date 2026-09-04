/**
 * Il profilo della cliente: lettura e completamento (foto compresa).
 */
import { apiRequest } from './http';

export interface ProfiloCliente {
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string;
  birthDate: string;
  address: string;
  city: string;
  gender: 'F' | 'M' | null;
  avatar: string | null;
}

export interface ModificheProfilo {
  email?: string;
  birthDate?: string;
  address?: string;
  city?: string;
  gender?: 'F' | 'M';
  /** data-URI jpeg; stringa vuota = togli la foto */
  avatar?: string;
}

/** Quanto è completo, da 0 a 100: guida la barra «completa il profilo». */
export function completezzaProfilo(p: ProfiloCliente): number {
  const voci = [!!p.avatar, !!p.email, !!p.birthDate, !!p.address, !!p.city, !!p.gender];
  return Math.round((voci.filter(Boolean).length / voci.length) * 100);
}

export const profiloService = {
  get: (token: string) =>
    apiRequest<{ profilo: ProfiloCliente }>('/api/mobile/profile', { token }),

  aggiorna: (token: string, dati: ModificheProfilo) =>
    apiRequest<{ ok: boolean }>('/api/mobile/profile', { method: 'POST', token, body: dati }),
};
