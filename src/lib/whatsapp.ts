/**
 * Invio messaggi WhatsApp via Evolution API (stessa infrastruttura usata
 * per gli allarmi dei distributori su instantcase).
 *
 * Variabili d'ambiente richieste:
 *  - EVOLUTION_URL      es. https://evolution.example.com
 *  - EVOLUTION_INSTANCE nome dell'istanza collegata al numero WhatsApp
 *  - EVOLUTION_APIKEY   chiave API dell'istanza
 */

export function whatsappConfigured(): boolean {
  return Boolean(process.env.EVOLUTION_URL && process.env.EVOLUTION_INSTANCE && process.env.EVOLUTION_APIKEY);
}

export function whatsappMissingVars(): string[] {
  return [
    ['EVOLUTION_URL', !!process.env.EVOLUTION_URL],
    ['EVOLUTION_INSTANCE', !!process.env.EVOLUTION_INSTANCE],
    ['EVOLUTION_APIKEY', !!process.env.EVOLUTION_APIKEY],
  ].filter(([, ok]) => !ok).map(([name]) => name as string);
}

export interface WaSendResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/** Invia un messaggio di testo a un numero (formato internazionale, es. 393331234567). */
export async function sendWhatsApp(number: string, text: string): Promise<WaSendResult> {
  if (!whatsappConfigured()) {
    return { ok: false, error: `WhatsApp non configurato: mancano ${whatsappMissingVars().join(', ')}` };
  }
  const url = `${(process.env.EVOLUTION_URL || '').replace(/\/+$/, '')}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_APIKEY as string },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[whatsapp] Evolution error', res.status, body);
      return { ok: false, status: res.status, error: `Evolution ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    console.error('[whatsapp] Evolution fetch failed', err);
    return { ok: false, error: 'Connessione a Evolution fallita' };
  }
}

/** Normalizza un numero italiano in formato internazionale per Evolution (es. 3331234567 → 393331234567). */
export function normalizePhone(raw: string): string {
  let n = raw.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('00')) n = n.slice(2);
  if (!n.startsWith('39') && n.length === 10 && n.startsWith('3')) n = '39' + n;
  return n;
}
