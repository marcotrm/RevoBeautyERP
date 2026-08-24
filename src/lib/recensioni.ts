/**
 * Recensioni Google dentro il gestionale.
 *
 * Si legge la scheda del centro con la Places API (New): serve solo una chiave
 * API, niente OAuth e niente domanda di accesso da far approvare a Google.
 *
 * Cosa dà e cosa NON dà, perché la differenza conta:
 *  - `rating` e `userRatingCount` sono esatti e aggiornati: da qui si capisce
 *    con certezza QUANTE recensioni ci sono e quanto vale la media. È su questi
 *    che si accorge l'arrivo di una nuova.
 *  - `reviews` torna al massimo CINQUE recensioni, ordinate per "rilevanza" e
 *    non per data. Quindi il testo di una recensione nuova di solito si vede,
 *    ma non è garantito: se il conteggio sale e nessun testo nuovo compare, si
 *    dice che è arrivata e si manda a leggerla su Google.
 *
 * Per avere tutte le recensioni e poter rispondere dal gestionale servirebbe la
 * Business Profile API: profilo verificato da almeno 60 giorni, domanda a
 * Google e circa due settimane di attesa per l'approvazione. Si può aggiungere
 * dopo senza buttare via niente di questo.
 */

import { prisma } from '@/lib/prisma';

const BASE = 'https://places.googleapis.com/v1';
const RIGA_STATO = 'recensioni:google';

export function recensioniConfigurate(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

export interface Recensione {
  /** Identificativo stabile dato da Google: serve a capire quali sono già viste. */
  id: string;
  autore: string;
  fotoAutore?: string;
  stelle: number;
  testo: string;
  /** Data ISO della recensione. */
  quando: string;
  /** "2 settimane fa", come lo scrive Google. */
  quandoTesto?: string;
  /** Indirizzo della recensione su Google, per rispondere. */
  link?: string;
}

export interface StatoRecensioni {
  placeId?: string;
  /** Nome della scheda su Google, per essere sicuri di aver preso quella giusta. */
  nomeScheda?: string;
  indirizzo?: string;
  media: number;
  totale: number;
  recensioni: Recensione[];
  /** Gli id già guardati dal centro: quello che resta fuori è "nuovo". */
  viste: string[];
  /** Quante recensioni c'erano all'ultima occhiata: se ora sono di più, ne è arrivata una. */
  totaleAllUltimaVista: number;
  ultimaLettura?: string;
  errore?: string;

  /**
   * Gli avvisi su Telegram tengono un conto loro, separato da `viste`.
   *
   * "Visto" vuol dire che qualcuno ha aperto la pagina del gestionale; se le due
   * cose stessero insieme, chi apre Marketing di mattina spegnerebbe senza
   * saperlo l'avviso della sera, e la recensione da una stella non arriverebbe
   * mai sul telefono.
   */
  notificate?: string[];
  /** Quante ce n'erano all'ultimo avviso: serve a contare quelle che Google non mostra. */
  totaleAllUltimoAvviso?: number;
  /** Le positive in coda per il riepilogo della sera. */
  positiveInAttesa?: Recensione[];
  /** Giorno dell'ultimo riepilogo mandato, per non ripeterlo. */
  ultimoRiepilogo?: string;
}

const VUOTO: StatoRecensioni = {
  media: 0, totale: 0, recensioni: [], viste: [], totaleAllUltimaVista: 0,
  notificate: [], totaleAllUltimoAvviso: 0, positiveInAttesa: [],
};

export async function leggiStato(): Promise<StatoRecensioni> {
  const riga = await prisma.adminEntry.findUnique({ where: { rowId: RIGA_STATO } });
  return { ...VUOTO, ...((riga?.data as Partial<StatoRecensioni> | null) || {}) };
}

export async function salvaStato(stato: StatoRecensioni): Promise<StatoRecensioni> {
  await prisma.adminEntry.upsert({
    where: { rowId: RIGA_STATO },
    update: { data: stato as unknown as object },
    create: {
      rowId: RIGA_STATO, kind: 'recensioni', entityId: 'google',
      data: stato as unknown as object, createdAt: new Date().toISOString(),
    },
  });
  return stato;
}

/** Le recensioni arrivate dopo l'ultima occhiata del centro. */
export function nuoveDi(stato: StatoRecensioni): Recensione[] {
  const viste = new Set(stato.viste);
  return stato.recensioni.filter(r => !viste.has(r.id));
}

/**
 * Vero quando il conteggio è salito ma nessun testo nuovo è comparso fra le
 * cinque: la recensione c'è, Google non ce la fa vedere.
 */
export function nuoveSenzaTesto(stato: StatoRecensioni): number {
  const scoperte = stato.totale - stato.totaleAllUltimaVista - nuoveDi(stato).length;
  return Math.max(0, scoperte);
}

interface RispostaLuogo {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: {
    name?: string;
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    relativePublishTimeDescription?: string;
    publishTime?: string;
    googleMapsUri?: string;
    authorAttribution?: { displayName?: string; photoUri?: string };
  }[];
}

function convertiRecensioni(raw: RispostaLuogo['reviews']): Recensione[] {
  return (raw || []).map((r, i) => ({
    // `name` è del tipo places/XXX/reviews/YYY: è stabile fra una lettura e
    // l'altra, quindi va bene come chiave del "già visto".
    id: r.name || `${r.publishTime || 'senza-data'}-${i}`,
    autore: r.authorAttribution?.displayName || 'Cliente Google',
    fotoAutore: r.authorAttribution?.photoUri,
    stelle: Number(r.rating || 0),
    testo: (r.text?.text || r.originalText?.text || '').trim(),
    quando: r.publishTime || '',
    quandoTesto: r.relativePublishTimeDescription,
    link: r.googleMapsUri,
  }));
}

/**
 * Cerca la scheda del centro su Google. Serve una volta sola, per prendere
 * l'identificativo: i nomi si assomigliano (c'è anche una "Revo Beauty" a
 * Marcianise) e sbagliare scheda vorrebbe dire guardare le recensioni di
 * un'altra attività.
 */
export async function cercaSchede(query: string): Promise<{
  ok: boolean;
  error?: string;
  schede: { placeId: string; nome: string; indirizzo: string; media: number; totale: number }[];
}> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { ok: false, error: 'Manca GOOGLE_MAPS_API_KEY', schede: [] };

  try {
    const res = await fetch(`${BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'it', maxResultCount: 5 }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: body?.error?.message || `HTTP ${res.status}`, schede: [] };

    const schede = ((body?.places || []) as RispostaLuogo[]).map(p => ({
      placeId: p.id || '',
      nome: p.displayName?.text || '',
      indirizzo: p.formattedAddress || '',
      media: Number(p.rating || 0),
      totale: Number(p.userRatingCount || 0),
    })).filter(s => s.placeId);
    return { ok: true, schede };
  } catch {
    return { ok: false, error: 'Google non risponde', schede: [] };
  }
}

/** Collega la scheda: da qui in poi si leggono le recensioni di questa. */
export async function collegaScheda(placeId: string, nome?: string, indirizzo?: string): Promise<StatoRecensioni> {
  const attuale = await leggiStato();
  // Cambiando scheda, "già viste" e conteggi della precedente non valgono più.
  return salvaStato({
    ...VUOTO,
    placeId: placeId.trim(),
    nomeScheda: nome,
    indirizzo,
    viste: attuale.placeId === placeId.trim() ? attuale.viste : [],
    totaleAllUltimaVista: attuale.placeId === placeId.trim() ? attuale.totaleAllUltimaVista : 0,
  });
}

/** Rilegge la scheda su Google e aggiorna quello che sappiamo. */
export async function aggiornaRecensioni(): Promise<StatoRecensioni> {
  const stato = await leggiStato();
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { ...stato, errore: 'Manca GOOGLE_MAPS_API_KEY' };
  if (!stato.placeId) return { ...stato, errore: 'Scheda Google non ancora collegata' };

  try {
    const res = await fetch(`${BASE}/places/${encodeURIComponent(stato.placeId)}?languageCode=it`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,reviews',
      },
    });
    const body = (await res.json().catch(() => null)) as RispostaLuogo & { error?: { message?: string } } | null;
    if (!res.ok) return { ...stato, errore: body?.error?.message || `HTTP ${res.status}` };

    const aggiornato: StatoRecensioni = {
      ...stato,
      nomeScheda: body?.displayName?.text || stato.nomeScheda,
      indirizzo: body?.formattedAddress || stato.indirizzo,
      media: Number(body?.rating || 0),
      totale: Number(body?.userRatingCount || 0),
      recensioni: convertiRecensioni(body?.reviews),
      ultimaLettura: new Date().toISOString(),
      errore: undefined,
    };

    // Prima lettura in assoluto: tutto quello che c'è ora è "già passato", non
    // ha senso far lampeggiare venti recensioni vecchie di mesi — né mandarle
    // tutte su Telegram al primo giro.
    if (!stato.ultimaLettura) {
      aggiornato.viste = aggiornato.recensioni.map(r => r.id);
      aggiornato.totaleAllUltimaVista = aggiornato.totale;
      aggiornato.notificate = aggiornato.recensioni.map(r => r.id);
      aggiornato.totaleAllUltimoAvviso = aggiornato.totale;
    }

    return salvaStato(aggiornato);
  } catch {
    return { ...stato, errore: 'Google non risponde' };
  }
}

/** Il centro ha guardato: si spegne il lampeggio. */
export async function segnaViste(): Promise<StatoRecensioni> {
  const stato = await leggiStato();
  return salvaStato({
    ...stato,
    viste: [...new Set([...stato.viste, ...stato.recensioni.map(r => r.id)])],
    totaleAllUltimaVista: stato.totale,
  });
}
