/**
 * I vocali di WhatsApp, letti.
 *
 * In Italia una richiesta su due arriva così: quaranta secondi di vocale
 * mentre si guida. Prima cadevano nel vuoto — il modello non apre l'audio — e
 * la cliente rimandava il vocale, poi scriveva «ci sei?». Il silenzio è il modo
 * peggiore di dire «non ci arrivo».
 *
 * La trascrizione la fa Deepgram (`nova-3`, che dal settembre 2025 parla
 * italiano): una richiesta sola, i byte nel corpo, la risposta subito. Costa
 * meno di mezzo centesimo al minuto, che è meno di niente rispetto a un
 * appuntamento non preso.
 *
 * ── Sul non fidarsi troppo ──────────────────────────────────────────────
 * Una trascrizione sbagliata su un cognome o su un orario è peggio di un
 * vocale non ascoltato, perché nessuno se ne accorge finché la cliente non si
 * presenta. Due difese, e nessuna delle due è scritta nel prompt:
 *
 *  - sotto una certa confidenza il testo non si usa: si chiede di riscrivere,
 *    che è quello che si faceva prima e resta la risposta giusta quando
 *    davvero non si è capito;
 *  - la prenotazione passa comunque dal gettone di conferma, quindi prima di
 *    scrivere in agenda il riepilogo va scritto in chat e confermato. Un nome
 *    storpiato dall'audio si ferma lì, come al telefono.
 */

import { fetchD360Media } from './whatsapp360';
import { logInbound, type WaMedia } from './wa-conversations';

const ENDPOINT = 'https://api.deepgram.com/v1/listen';

/**
 * Sotto questa confidenza il testo non si usa.
 *
 * Deepgram la restituisce per l'intera alternativa. Con l'audio compresso di
 * WhatsApp e una cliente che parla in strada si scende in fretta, ed è
 * esattamente il caso in cui è meglio chiedere di riscrivere.
 */
const CONFIDENZA_MINIMA = 0.6;

/** Un vocale più lungo di così non è una richiesta, è una storia: la legge una persona. */
const MAX_BYTE = 10_000_000;

/** Quanto si aspetta Deepgram prima di lasciar perdere e rispondere «me lo scrivi?». */
const TIMEOUT_MS = 20_000;

export type EsitoTrascrizione =
  | { ok: true; testo: string; confidenza: number }
  | { ok: false; motivo: string };

export function trascrizioneConfigurata(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

/**
 * Trascrive un vocale arrivato su WhatsApp.
 *
 * Non lancia mai: chi la chiama deve poter ripiegare sul «me lo scrivi?»
 * senza un try attorno.
 */
export async function trascriviVocale(media: WaMedia): Promise<EsitoTrascrizione> {
  const chiave = process.env.DEEPGRAM_API_KEY;
  if (!chiave) return { ok: false, motivo: 'manca DEEPGRAM_API_KEY' };

  const scaricato = await fetchD360Media(media.id).catch(() => null);
  if (!scaricato?.ok) return { ok: false, motivo: 'audio non scaricato' };
  if (scaricato.body.byteLength > MAX_BYTE) return { ok: false, motivo: 'vocale troppo lungo' };

  // I vocali di WhatsApp sono ogg/opus. Il tipo lo dichiara chi ce l'ha mandato:
  // dedurlo dall'estensione qui non si può, il file non ha nome.
  const tipo = (scaricato.mimeType || media.mimeType || 'audio/ogg').split(';')[0].trim();

  const url = new URL(ENDPOINT);
  url.searchParams.set('model', 'nova-3');
  url.searchParams.set('language', 'it');
  // La punteggiatura non è cosmetica: «alle tre e mezza no» e «alle tre e mezza, no?»
  // sono due appuntamenti diversi.
  url.searchParams.set('punctuate', 'true');
  url.searchParams.set('smart_format', 'true');

  const stop = AbortSignal.timeout(TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Token ${chiave}`, 'Content-Type': tipo },
      body: scaricato.body,
      signal: stop,
    });

    if (!res.ok) {
      const dettaglio = await res.text().catch(() => '');
      console.error('[trascrizione] Deepgram', res.status, dettaglio.slice(0, 300));
      return { ok: false, motivo: `Deepgram ${res.status}` };
    }

    const body = await res.json().catch(() => null) as {
      results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string; confidence?: number }> }> };
    } | null;

    const prima = body?.results?.channels?.[0]?.alternatives?.[0];
    const testo = (prima?.transcript || '').trim();
    const confidenza = typeof prima?.confidence === 'number' ? prima.confidence : 0;

    if (!testo) return { ok: false, motivo: 'nessuna parola riconosciuta' };
    if (confidenza < CONFIDENZA_MINIMA) {
      return { ok: false, motivo: `capito male (confidenza ${confidenza.toFixed(2)})` };
    }

    return { ok: true, testo, confidenza };
  } catch (err) {
    console.error('[trascrizione] richiesta fallita', err);
    return { ok: false, motivo: stop.aborted ? 'Deepgram non ha risposto in tempo' : 'connessione a Deepgram fallita' };
  }
}

/**
 * Mette la trascrizione in chat, sotto il vocale.
 *
 * Vale a prescindere dal bot: dal gestionale il numero non si apre più su
 * WhatsApp, quindi finora un vocale in archivio era una riga «🎤 Messaggio
 * vocale» che non diceva niente a chi rileggeva la conversazione. Adesso c'è
 * scritto cosa ha detto.
 */
export async function archiviaTrascrizione(params: {
  phone: string;
  messageId?: string;
  testo: string;
}): Promise<void> {
  await logInbound({
    phone: params.phone,
    text: `🎤 «${params.testo}»`,
    // Chiave derivata da quella del vocale: se il webhook riconsegna, questa
    // riga si sovrascrive invece di duplicarsi in chat.
    messageId: params.messageId ? `${params.messageId}:trascritto` : undefined,
  }).catch(() => {});
}
