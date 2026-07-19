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
