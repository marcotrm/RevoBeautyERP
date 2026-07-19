'use server';

import { prisma } from '@/lib/prisma';
import { getTelegramConfig, sendTelegram, type TelegramConfig } from '@/lib/telegram';

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

export async function testTelegram(): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  return sendTelegram(`✅ <b>RevoBeauty — Test Telegram</b>\nSe leggi questo messaggio, le notifiche di incasso funzionano!\n🕒 ${now}`);
}

// Rileva automaticamente il Chat ID leggendo l'ultimo messaggio ricevuto dal bot.
// L'utente deve prima aprire una chat col proprio bot e scrivergli qualcosa.
export async function detectTelegramChatId(botToken: string): Promise<{ ok: boolean; chatId?: string; name?: string; error?: string }> {
  const token = (botToken || '').trim();
  if (!token) return { ok: false, error: 'Inserisci prima il Bot Token' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return { ok: false, error: 'Bot Token non valido' };
    const updates: Array<{ message?: { chat?: { id?: number; first_name?: string; title?: string } } }> = data.result || [];
    // Prendi l'ultimo messaggio con una chat
    for (let i = updates.length - 1; i >= 0; i--) {
      const chat = updates[i]?.message?.chat;
      if (chat?.id != null) {
        return { ok: true, chatId: String(chat.id), name: chat.title || chat.first_name || '' };
      }
    }
    return { ok: false, error: 'Nessun messaggio trovato. Apri il tuo bot su Telegram e scrivigli "ciao", poi riprova.' };
  } catch {
    return { ok: false, error: 'Connessione a Telegram fallita' };
  }
}
