'use server';

import { prisma } from '@/lib/prisma';
import { getTelegramConfig, sendTelegram, type TelegramConfig } from '@/lib/telegram';
import { sendDailyReports } from '@/lib/reports-telegram';

const ROW_ID = 'integration:telegram';

export async function loadTelegramConfig(): Promise<TelegramConfig> {
  return getTelegramConfig();
}

export async function saveTelegramConfig(cfg: TelegramConfig) {
  await prisma.adminEntry.upsert({
    where: { rowId: ROW_ID },
    update: { data: cfg as object },
    create: { rowId: ROW_ID, kind: 'integration', entityId: 'telegram', data: cfg as object, createdAt: new Date().toISOString() },
  });
  return { ok: true };
}

// Invia subito un report (per il tasto "Invia ora"), ignorando gli orari.
export async function sendReportNow(which: 'incassi' | 'staff'): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getTelegramConfig();
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return { ok: false, error: 'Configura prima Telegram (token + chat)' };
  const res = await sendDailyReports({ which, force: true });
  return res.sent.length > 0 ? { ok: true } : { ok: false, error: 'Invio fallito' };
}

export async function testTelegram(): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  return sendTelegram(`✅ <b>RevoBeauty — Test Telegram</b>\nSe leggi questo messaggio, le notifiche di incasso funzionano!\n🕒 ${now}`);
}

export interface TelegramChat { id: string; name: string; type: 'privato' | 'gruppo' | 'canale' }

// Elenca tutte le chat (personale + gruppi) che hanno scritto al bot di recente,
// così l'utente sceglie con un tocco dove ricevere le notifiche.
export async function listTelegramChats(botToken: string): Promise<{ ok: boolean; chats?: TelegramChat[]; error?: string }> {
  const token = (botToken || '').trim();
  if (!token) return { ok: false, error: 'Inserisci prima il Bot Token' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return { ok: false, error: 'Bot Token non valido' };
    type Chat = { id?: number; type?: string; first_name?: string; last_name?: string; title?: string };
    const updates: Array<{ message?: { chat?: Chat }; my_chat_member?: { chat?: Chat }; channel_post?: { chat?: Chat } }> = data.result || [];
    const map = new Map<string, TelegramChat>();
    for (const u of updates) {
      const chat = u.message?.chat || u.my_chat_member?.chat || u.channel_post?.chat;
      if (!chat?.id) continue;
      const id = String(chat.id);
      const type: TelegramChat['type'] = chat.type === 'private' ? 'privato' : chat.type === 'channel' ? 'canale' : 'gruppo';
      const name = chat.title || `${chat.first_name || ''} ${chat.last_name || ''}`.trim() || id;
      map.set(id, { id, name, type });
    }
    const chats = Array.from(map.values());
    if (chats.length === 0) {
      return { ok: false, error: 'Nessuna chat trovata. Scrivi "ciao" al bot (o "/id" nel gruppo), poi riprova.' };
    }
    return { ok: true, chats };
  } catch {
    return { ok: false, error: 'Connessione a Telegram fallita' };
  }
}
