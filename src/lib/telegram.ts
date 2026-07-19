import { prisma } from '@/lib/prisma';

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  reportIncassi?: boolean; // report incassi serali alle 20:00
  reportStaff?: boolean;   // classifica estetiste alle 20:00
}

const ROW_ID = 'integration:telegram';

export async function getTelegramConfig(): Promise<TelegramConfig> {
  try {
    const row = await prisma.adminEntry.findUnique({ where: { rowId: ROW_ID } });
    const d = (row?.data as Partial<TelegramConfig>) || {};
    return { enabled: !!d.enabled, botToken: d.botToken || '', chatId: d.chatId || '', reportIncassi: !!d.reportIncassi, reportStaff: !!d.reportStaff };
  } catch {
    return { enabled: false, botToken: '', chatId: '', reportIncassi: false, reportStaff: false };
  }
}

// Invia un messaggio Telegram usando la config salvata. Non lancia eccezioni:
// se non è configurato o fallisce, ritorna semplicemente ok:false.
export async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getTelegramConfig();
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) {
    return { ok: false, error: 'Telegram non configurato' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[telegram] send failed', res.status, body);
      return { ok: false, error: `Telegram ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error('[telegram] fetch error', err);
    return { ok: false, error: 'Connessione a Telegram fallita' };
  }
}

// Notifica di incasso — chiamata a ogni transazione di cassa (vendite, pacchetti, ecc.)
export async function notifyIncasso(params: {
  amount: number; client?: string | null; items?: string; method?: string; operator?: string;
}): Promise<void> {
  if (!params.amount || params.amount <= 0) return;
  const cfg = await getTelegramConfig();
  if (!cfg.enabled) return;
  const now = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
  const euro = params.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  const lines = [
    `💰 <b>Nuovo incasso: ${euro}</b>`,
    params.client ? `👤 ${params.client}` : '',
    params.items ? `🧾 ${params.items}` : '',
    params.method ? `💳 ${params.method}` : '',
    params.operator ? `💇‍♀️ ${params.operator}` : '',
    `🕒 ${now}`,
  ].filter(Boolean);
  await sendTelegram(lines.join('\n'));
}
