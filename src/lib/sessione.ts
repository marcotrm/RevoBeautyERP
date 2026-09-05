/**
 * La sessione, dalla parte del server.
 *
 * Fino a oggi «essere loggati» era una riga nel browser: lo store di
 * autenticazione salva l'utente in localStorage, e ogni schermata si fida di
 * quella riga. Funziona finche' tutti sono d'accordo, ma non e' una difesa:
 * le API del gestionale rispondono a chiunque le chiami, e chi ha in mano un
 * tablet ha anche una barra degli indirizzi.
 *
 * Con un tablet che passa di mano fra clienti e operatrici quella riga non
 * basta piu'. Qui la sessione diventa un cookie firmato, che il browser non
 * puo' leggere ne' modificare (httpOnly) e che il server verifica a ogni
 * richiesta: da li' escono chi sei, che ruolo hai e — per il tablet — se sei
 * in modalita' cliente, dove si vede solo quello che riguarda la persona che
 * ha in mano il dispositivo in questo momento.
 *
 * La firma usa lo stesso segreto e lo stesso meccanismo dei link del consenso
 * (VOICE_API_SECRET, HMAC): un pezzo gia' in produzione da mesi, invece di un
 * secondo sistema da tenere allineato.
 */

import { cookies } from 'next/headers';
import { firmaConferma, leggiConferma } from '@/lib/conferma';

/** Il nome del cookie. Corto e senza riferimenti: e' visibile a chiunque guardi. */
const COOKIE = 'revo_s';

/** Una giornata di lavoro piu' un margine: chi apre la mattina non rifa' l'accesso. */
const DURATA_OPERATRICE_MS = 14 * 60 * 60 * 1000;

/**
 * La sessione della cliente col tablet in mano dura poco per costruzione.
 *
 * Non e' un accesso: e' il permesso di compilare le proprie cose, e finisce
 * quando lei si alza. Il timeout vero (inattivita') lo applica anche la
 * pagina, ma qui c'e' il tetto che nessuno puo' allungare da fuori.
 */
const DURATA_CLIENTE_MS = 30 * 60 * 1000;

export type TipoSessione = 'operatrice' | 'cliente-tablet';

export interface Sessione {
  tipo: TipoSessione;
  /** L'account del gestionale: c'e' sempre per l'operatrice. */
  accountId?: string;
  roleId?: string;
  nome?: string;
  /*
    In modalita' cliente: l'unica scheda a cui questa sessione puo' arrivare.

    E' il cardine dell'isolamento. Le API della modalita' cliente non
    accettano un id di cliente dalla richiesta — lo leggono da qui: cosi'
    cambiare un numero nell'indirizzo non porta da nessuna parte.
  */
  clientId?: string;
  appointmentId?: string;
  /** Il dispositivo da cui e' nata, per il registro degli accessi. */
  dispositivo?: string;
}

interface Contenuto extends Sessione {
  emessa: string;
}

/** Apre la sessione e la scrive nel cookie. Torna false se manca il segreto. */
export async function apriSessione(s: Sessione): Promise<boolean> {
  const durata = s.tipo === 'cliente-tablet' ? DURATA_CLIENTE_MS : DURATA_OPERATRICE_MS;
  const gettone = firmaConferma({ ...s, emessa: new Date().toISOString() } as Contenuto, durata);
  if (!gettone) return false;

  const c = await cookies();
  c.set(COOKIE, gettone, {
    httpOnly: true,
    sameSite: 'lax',
    // In locale il browser non manda i cookie `secure` su http.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(durata / 1000),
  });
  return true;
}

/** Chi sta chiamando, o null. Non lancia mai: chi decide e' chi la chiede. */
export async function sessioneCorrente(): Promise<Sessione | null> {
  try {
    const c = await cookies();
    const gettone = c.get(COOKIE)?.value;
    if (!gettone) return null;
    const dati = leggiConferma<Contenuto>(gettone);
    if (!dati?.tipo) return null;
    return dati;
  } catch {
    return null;
  }
}

/** Chiude la sessione: il cookie sparisce, non scade e basta. */
export async function chiudiSessione(): Promise<void> {
  try {
    const c = await cookies();
    c.delete(COOKIE);
  } catch { /* fuori da una richiesta non c'e' niente da chiudere */ }
}

/**
 * L'operatrice dietro questa richiesta, o un errore.
 *
 * Si usa all'inizio di ogni azione che tocca dati di altre clienti. Il
 * messaggio e' scritto per chi sta al banco, non per chi programma: davanti a
 * «Unauthorized» non si puo' fare niente, davanti a «la sessione e' scaduta,
 * rifai l'accesso» si'.
 */
export async function operatriceCorrente(): Promise<Sessione> {
  const s = await sessioneCorrente();
  if (!s || s.tipo !== 'operatrice') {
    throw new Error('SESSIONE: la sessione è scaduta o non hai i permessi. Rifai l\'accesso.');
  }
  return s;
}

/**
 * La cliente col tablet in mano, o un errore.
 *
 * Torna la sessione, e chi la usa prende l'id della cliente DA QUI e da
 * nessun'altra parte.
 */
export async function clienteDalTablet(): Promise<Sessione> {
  const s = await sessioneCorrente();
  if (!s || s.tipo !== 'cliente-tablet' || !s.clientId) {
    throw new Error('SESSIONE: questa sessione è finita. Chiedi aiuto in reception.');
  }
  return s;
}
