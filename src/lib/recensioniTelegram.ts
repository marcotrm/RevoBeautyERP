/**
 * Recensioni Google che arrivano su Telegram.
 *
 * Due velocità diverse, per un motivo pratico:
 *  - da 1 a 3 stelle si avvisa SUBITO, una per messaggio. Una recensione brutta
 *    ha una finestra di poche ore in cui rispondere serve ancora a qualcosa;
 *    dentro un riepilogo serale si perde.
 *  - da 4 a 5 stelle si accumula e si manda un riepilogo la sera. Sono belle
 *    notizie, ma se ogni complimento fa vibrare il telefono, dopo una settimana
 *    il gruppo lo si silenzia — e con lui si silenziano anche le brutte.
 *
 * Limite che viene da Google, non da noi: la Places API dà al massimo cinque
 * testi e non per data. Quindi può succedere che il conteggio salga senza che
 * nessun testo nuovo compaia: in quel caso si avvisa lo stesso, dicendo
 * chiaramente che il testo non si vede e che va letto sulla scheda. Tacere
 * sarebbe peggio: quella invisibile potrebbe essere proprio una da una stella.
 */

import {
  aggiornaRecensioni, leggiStato, salvaStato,
  type Recensione, type StatoRecensioni,
} from '@/lib/recensioni';
import { sendTelegram } from '@/lib/telegram';

/** Sotto questa soglia si avvisa subito. */
export const SOGLIA_NEGATIVA = 3;

const esc = (t: string) =>
  String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const stelline = (n: number) => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n));

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** "24 agosto alle 14:32", ora italiana. Se Google non dà la data, il suo "2 settimane fa". */
function quando(r: Recensione): string {
  if (!r.quando) return r.quandoTesto || 'data non disponibile';
  const d = new Date(r.quando);
  if (Number.isNaN(d.getTime())) return r.quandoTesto || 'data non disponibile';
  const p = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find(x => x.type === t)?.value || '';
  return `${g('day')} ${g('month')} ${g('year')} alle ${g('hour')}:${g('minute')}`;
}

const oggiRoma = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());

/** Dove: la scheda Google del centro, con l'indirizzo se lo sappiamo. */
function dove(stato: StatoRecensioni): string {
  const nome = stato.nomeScheda || 'la scheda Google del centro';
  return stato.indirizzo ? `${nome} — ${stato.indirizzo}` : nome;
}

function media(stato: StatoRecensioni): string {
  if (!stato.totale) return '';
  return `Media adesso: <b>${stato.media.toFixed(1).replace('.', ',')}</b> su ${stato.totale} recensioni`;
}

/** Il messaggio di una recensione negativa: chi, quanto, quando, dove, cosa. */
function messaggioNegativa(r: Recensione, stato: StatoRecensioni): string {
  const righe = [
    `⚠️ <b>Recensione da ${r.stelle} ${r.stelle === 1 ? 'stella' : 'stelle'}</b>`,
    `${stelline(r.stelle)}  ·  <b>${esc(r.autore)}</b>`,
    `🕓 ${quando(r)}`,
    `📍 ${esc(dove(stato))}`,
    '',
    r.testo ? `«${esc(r.testo)}»` : '<i>Ha messo solo le stelle, senza scrivere niente.</i>',
    '',
  ];
  if (r.link) righe.push(`<a href="${esc(r.link)}">Aprila su Google per rispondere</a>`);
  const m = media(stato);
  if (m) righe.push(m);
  return righe.join('\n');
}

/** Quando il conteggio sale ma Google non mostra il testo. */
function messaggioInvisibili(quante: number, stato: StatoRecensioni): string {
  const righe = [
    `📝 <b>${quante === 1 ? 'È arrivata una recensione nuova' : `Sono arrivate ${quante} recensioni nuove`}</b>`,
    `📍 ${esc(dove(stato))}`,
    '',
    'Google non ce ne fa vedere il testo: la sua API mostra solo cinque recensioni ' +
    'per volta, scelte da lei. Va letta sulla scheda.',
    '',
  ];
  if (stato.placeId) {
    righe.push(`<a href="https://search.google.com/local/reviews?placeid=${esc(stato.placeId)}">Vai alle recensioni</a>`);
  }
  const m = media(stato);
  if (m) righe.push(m);
  return righe.join('\n');
}

/** Il riepilogo serale delle positive. */
function messaggioRiepilogo(positive: Recensione[], stato: StatoRecensioni): string {
  const righe = [
    `✨ <b>${positive.length === 1 ? 'Una recensione buona oggi' : `${positive.length} recensioni buone oggi`}</b>`,
    `📍 ${esc(dove(stato))}`,
    '',
  ];
  for (const r of positive) {
    righe.push(`${stelline(r.stelle)}  <b>${esc(r.autore)}</b>  ·  ${quando(r)}`);
    if (r.testo) {
      // Nel riepilogo il testo si accorcia: cinque recensioni intere fanno un
      // muro che nessuno legge. Il link porta a quella intera.
      const t = r.testo.length > 220 ? `${r.testo.slice(0, 217)}…` : r.testo;
      righe.push(`«${esc(t)}»`);
    }
    if (r.link) righe.push(`<a href="${esc(r.link)}">Rispondi</a>`);
    righe.push('');
  }
  const m = media(stato);
  if (m) righe.push(m);
  return righe.join('\n');
}

export interface EsitoControllo {
  negativeInviate: number;
  positiveInCoda: number;
  invisibili: number;
  errore?: string;
}

/**
 * Rilegge Google e manda subito quelle brutte. Le belle le mette in coda.
 * Da chiamare ogni tanto dallo scheduler: ogni lettura è una chiamata a
 * pagamento alla Places API, quindi non ha senso farla al minuto.
 */
export async function controllaRecensioni(): Promise<EsitoControllo> {
  const stato = await aggiornaRecensioni();
  if (stato.errore) return { negativeInviate: 0, positiveInCoda: 0, invisibili: 0, errore: stato.errore };

  const notificate = new Set(stato.notificate || []);
  const nuove = stato.recensioni.filter(r => !notificate.has(r.id));

  const negative = nuove.filter(r => r.stelle > 0 && r.stelle <= SOGLIA_NEGATIVA);
  const positive = nuove.filter(r => r.stelle > SOGLIA_NEGATIVA);

  // Quelle che ci sono ma non si vedono: il conteggio è salito più di quanto
  // spieghino i testi nuovi.
  const primaDi = stato.totaleAllUltimoAvviso ?? stato.totale;
  const invisibili = Math.max(0, stato.totale - primaDi - nuove.length);

  for (const r of negative) {
    await sendTelegram(messaggioNegativa(r, stato));
  }
  if (invisibili > 0) {
    await sendTelegram(messaggioInvisibili(invisibili, stato));
  }

  await salvaStato({
    ...stato,
    notificate: [...notificate, ...nuove.map(r => r.id)],
    totaleAllUltimoAvviso: stato.totale,
    positiveInAttesa: [...(stato.positiveInAttesa || []), ...positive],
  });

  return {
    negativeInviate: negative.length,
    positiveInCoda: positive.length,
    invisibili,
  };
}

/**
 * Il riepilogo della sera. Se non c'è niente di nuovo non manda niente: un
 * "oggi nessuna recensione" tutte le sere è rumore, e insegna a ignorare il
 * gruppo.
 */
export async function riepilogoRecensioni(opts: { force?: boolean } = {}): Promise<{ inviato: boolean; quante: number }> {
  const stato = await leggiStato();
  const oggi = oggiRoma();

  if (!opts.force && stato.ultimoRiepilogo === oggi) return { inviato: false, quante: 0 };

  const positive = stato.positiveInAttesa || [];
  if (positive.length === 0) {
    // Si segna comunque la data: così un riavvio dell'app non fa ripartire il
    // controllo ogni minuto fino a mezzanotte.
    await salvaStato({ ...stato, ultimoRiepilogo: oggi });
    return { inviato: false, quante: 0 };
  }

  const esito = await sendTelegram(messaggioRiepilogo(positive, stato));
  if (!esito.ok) return { inviato: false, quante: positive.length };

  await salvaStato({ ...stato, positiveInAttesa: [], ultimoRiepilogo: oggi });
  return { inviato: true, quante: positive.length };
}
