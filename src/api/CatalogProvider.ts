/**
 * Contratto del servizio listino (tab Pacchetti) + implementazione reale.
 */
import { apiRequest } from './http';
import { ListinoData } from './types';

export interface CatalogProvider {
  /** Pacchetti + trattamenti con prezzi personalizzati per la cliente */
  getListino(token: string): Promise<ListinoData>;
}

export class RealCatalogService implements CatalogProvider {
  getListino(token: string): Promise<ListinoData> {
    return apiRequest<ListinoData>('/api/mobile/listino', { token });
  }
}
