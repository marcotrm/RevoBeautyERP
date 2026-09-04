/**
 * La bacheca: promo del giorno e lavori del salone.
 */
import { apiRequest } from './http';

export interface PostBacheca {
  id: string;
  tipo: 'promo' | 'lavoro';
  titolo: string;
  testo: string;
  /** data-URI jpeg, o null per i post di solo testo */
  foto: string | null;
  createdAt: string;
}

export const bachecaService = {
  list: (token: string) =>
    apiRequest<{ posts: PostBacheca[] }>('/api/mobile/posts', { token }),
};
