/**
 * Servizio chat: conversazione della cliente con il centro estetico.
 * Parla con gli endpoint /api/mobile/chat del gestionale (identità dal token).
 */
import { apiRequest } from './http';

export interface ChatMessage {
  id: string;
  sender: 'client' | 'operator';
  body: string;
  operatorName?: string | null;
  createdAt: string;
}

export interface ChatProvider {
  list(token: string): Promise<ChatMessage[]>;
  send(token: string, body: string): Promise<ChatMessage>;
  /** Quante risposte dell'operatrice non sono ancora state lette. */
  nonLetti(token: string): Promise<number>;
}

export class RealChatService implements ChatProvider {
  async list(token: string): Promise<ChatMessage[]> {
    const res = await apiRequest<{ messages: ChatMessage[] }>('/api/mobile/chat', { token });
    return res.messages;
  }

  async nonLetti(token: string): Promise<number> {
    const res = await apiRequest<{ nonLetti: number }>('/api/mobile/chat/unread', { token });
    return res.nonLetti;
  }

  async send(token: string, body: string): Promise<ChatMessage> {
    const res = await apiRequest<{ message: ChatMessage }>('/api/mobile/chat', {
      method: 'POST',
      token,
      body: { body },
    });
    return res.message;
  }
}
