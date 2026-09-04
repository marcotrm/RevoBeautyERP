/**
 * Accesso all'app clienti: numero di telefono e codice usa-e-getta.
 *
 * Perché non email e password: il numero di telefono in anagrafica ce l'hanno
 * tutte, l'email quasi nessuna, e una password in più da ricordare è il modo
 * più sicuro per far disinstallare l'app dopo una settimana. Il codice arriva
 * su WhatsApp, che è il canale che il centro usa già.
 *
 * Regole di sicurezza, tutte pensate per un caso concreto:
 *  - del codice si salva solo l'hash, mai il codice in chiaro: chi legge il
 *    database non può entrare negli account;
 *  - vale 5 minuti e si brucia al primo uso;
 *  - 5 tentativi sbagliati e va richiesto: senza limite, sei cifre si indovinano
 *    con qualche migliaio di richieste;
 *  - non più di un invio ogni 60 secondi per numero, altrimenti il tasto
 *    "rimanda" diventa un modo per riempire di messaggi il telefono di qualcun
 *    altro (e per bruciare i messaggi a pagamento del centro).
 */

import { createHash, randomInt, randomBytes, timingSafeEqual } from 'crypto';
import { prisma } from './prisma';
import { normalizePhone, isSendablePhone } from './whatsapp';

/** Quanto vive un codice, in minuti. */
export const OTP_DURATA_MIN = 5;
/** Tentativi sbagliati ammessi prima di dover richiedere il codice. */
export const OTP_MAX_TENTATIVI = 5;
/** Secondi da aspettare fra un invio e il successivo, per numero. */
export const OTP_ATTESA_SEC = 60;

/**
 * Il numero riservato alla verifica di Apple.
 *
 * Chi rivede l'app per Apple deve poterci entrare, ma non ha un numero
 * nell'anagrafica del centro e non riceverebbe comunque il codice su WhatsApp:
 * senza una via d'accesso l'app viene respinta con "impossibile completare la
 * verifica", che è il motivo di rifiuto più comune per le app riservate ai
 * clienti.
 *
 * Per QUEL SOLO numero il codice è fisso e non parte nessun messaggio. Vale
 * solo se entrambe le variabili sono impostate, quindi si spegne togliendone
 * una — e la scheda cliente collegata va marcata `interno`, o le sue prove
 * finiscono nelle statistiche del centro.
 */
function numeroDiProva(): { phone: string; codice: string } | null {
  const phone = normalizePhone(String(process.env.DEMO_PHONE || ''));
  const codice = String(process.env.DEMO_OTP || '').replace(/\D/g, '');
  if (!phone || codice.length !== 6) return null;
  return { phone, codice };
}

/** Vero se questo numero è quello della verifica Apple. */
export function eNumeroDiProva(phone: string): boolean {
  const p = numeroDiProva();
  return Boolean(p && p.phone === phone);
}

const sha = (v: string) => createHash('sha256').update(v).digest('hex');

/** Come il token di sessione viene salvato: mai in chiaro. */
export const hashToken = (token: string) => sha(String(token || '').trim());

/** Confronto a tempo costante: un confronto normale perde informazione. */
function uguali(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function nuovoCodice(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function nuovoToken(): string {
  return randomBytes(32).toString('hex');
}

/** Le ultime 9 cifre: come si riconosce lo stesso numero scritto in modi diversi. */
const coda = (p: string | null | undefined) => (p || '').replace(/\D/g, '').slice(-9);

/**
 * La scheda cliente dietro un numero, o null.
 *
 * Il numero in anagrafica e' scritto in mille modi — con lo zero davanti, col
 * prefisso, con gli spazi — quindi si confrontano le ultime nove cifre.
 *
 * Della stessa persona puo' esserci piu' di una scheda: il blocco sui doppioni
 * e' arrivato dopo, e quelli gia' dentro sono rimasti. Se un account app esiste
 * gia' per quel numero comanda lui, perche' e' quello che ha lo storico degli
 * accessi e l'unicita' nel database e' sul numero, non sulla scheda.
 */
async function trovaCliente(phone: string) {
  const chiave = coda(phone);
  const candidati = await prisma.client.findMany({ select: { id: true, firstName: true, phone: true } });
  const conQuelNumero = candidati.filter(c => coda(c.phone) === chiave);
  if (conQuelNumero.length === 0) return null;

  const perNumero = await prisma.mobileAccount.findUnique({ where: { phone } });
  const cliente = (perNumero && conQuelNumero.find(c => c.id === perNumero.clientId)) || conQuelNumero[0];
  const account = perNumero ?? await prisma.mobileAccount.findUnique({ where: { clientId: cliente.id } });
  return { cliente, account };
}

/**
 * Se all'accesso serve il codice usa-e-getta.
 *
 * Il centro ha chiesto di entrare col solo numero: chi scarica l'app e' gia'
 * cliente, e il codice su WhatsApp arrivava solo a chi aveva scritto nelle
 * ultime 24 ore — tutte le altre restavano fuori.
 *
 * L'interruttore vive QUI e non nell'app di proposito. Riaccendere il codice
 * dovendo ricompilare l'app vorrebbe dire una nuova revisione di Apple e
 * giorni di attesa; cosi' invece e' una variabile, e ha effetto al primo
 * accesso successivo.
 *
 * Da sapere, perche' e' il prezzo di questa scelta: senza codice l'app
 * verifica CHI E' (il numero e' in anagrafica) ma non che chi scrive quel
 * numero abbia in mano quel telefono. Dentro ci sono appuntamenti, spese e le
 * note su allergie e pelle.
 */
export function serveIlCodice(): boolean {
  return /^(1|si|true|on)$/i.test(String(process.env.APP_CLIENTI_CHIEDI_CODICE || '').trim());
}

export type EsitoAccesso =
  | { ok: true; token: string; clientId: string; nome: string }
  | { ok: false; code: 'VALIDATION' | 'USER_NOT_FOUND' | 'CONFLICT'; error: string };

/** Accesso col solo numero: se e' in anagrafica, si entra. */
export async function entraDirettamente(telefonoGrezzo: string): Promise<EsitoAccesso> {
  const phone = normalizePhone(String(telefonoGrezzo || ''));
  if (!isSendablePhone(phone)) {
    return { ok: false, code: 'VALIDATION', error: 'Numero di cellulare non valido. Scrivilo come 3401234567.' };
  }

  const trovata = await trovaCliente(phone);
  if (!trovata) {
    return {
      ok: false,
      code: 'USER_NOT_FOUND',
      error: 'Questo numero non risulta fra le clienti del centro. Chiedi in negozio di essere registrata, poi riprova.',
    };
  }

  const { cliente, account } = trovata;
  const token = nuovoToken();
  const adesso = new Date().toISOString();
  const dati = {
    sessionToken: hashToken(token),
    lastLoginAt: adesso,
    // Un codice eventualmente in attesa si butta: la sessione e' aperta.
    otpHash: null, otpExpiresAt: null, otpAttempts: 0,
  };

  try {
    if (account) {
      await prisma.mobileAccount.update({ where: { id: account.id }, data: { phone, ...dati } });
    } else {
      // L'account nasce al primo accesso: chi e' gia' cliente del centro e'
      // gia' "iscritto", non c'e' una registrazione da fare.
      await prisma.mobileAccount.create({
        data: { clientId: cliente.id, phone, createdAt: adesso, ...dati },
      });
    }
  } catch {
    return { ok: false, code: 'CONFLICT', error: 'Non siamo riusciti ad aprire la sessione. Riprova fra qualche secondo.' };
  }

  return { ok: true, token, clientId: cliente.id, nome: cliente.firstName };
}

export type EsitoRichiesta =
  | { ok: true; codice: string; phone: string; nome: string }
  | { ok: false; code: 'VALIDATION' | 'USER_NOT_FOUND' | 'TOO_MANY' | 'CONFLICT'; error: string; attesa?: number };

/**
 * Prepara il codice per un numero e restituisce il codice in chiaro *una sola
 * volta*, a chi lo deve spedire. Se il numero non è in anagrafica non si
 * inventa un account: l'app clienti è per chi è già cliente del centro.
 */
export async function preparaCodice(telefonoGrezzo: string): Promise<EsitoRichiesta> {
  const phone = normalizePhone(String(telefonoGrezzo || ''));
  if (!isSendablePhone(phone)) {
    return { ok: false, code: 'VALIDATION', error: 'Numero di cellulare non valido. Scrivilo come 3401234567.' };
  }

  const trovata = await trovaCliente(phone);
  if (!trovata) {
    return {
      ok: false,
      code: 'USER_NOT_FOUND',
      error: 'Questo numero non risulta fra le clienti del centro. Chiedi in negozio di essere registrata, poi riprova.',
    };
  }
  const { cliente, account } = trovata;
  const adesso = new Date();

  // Il numero di prova non aspetta: se il revisore chiede due codici di fila
  // e si becca un errore, chiude l'app e scrive che non funziona.
  if (account?.otpSentAt && !eNumeroDiProva(phone)) {
    const passati = (adesso.getTime() - Date.parse(account.otpSentAt)) / 1000;
    if (passati < OTP_ATTESA_SEC) {
      return {
        ok: false,
        code: 'TOO_MANY',
        error: `Abbiamo appena mandato un codice. Riprova fra ${Math.ceil(OTP_ATTESA_SEC - passati)} secondi.`,
        attesa: Math.ceil(OTP_ATTESA_SEC - passati),
      };
    }
  }

  const codice = numeroDiProva()?.phone === phone ? numeroDiProva()!.codice : nuovoCodice();
  const dati = {
    otpHash: sha(codice),
    otpExpiresAt: new Date(adesso.getTime() + OTP_DURATA_MIN * 60_000).toISOString(),
    otpAttempts: 0,
    otpSentAt: adesso.toISOString(),
  };

  try {
    if (account) {
      await prisma.mobileAccount.update({ where: { id: account.id }, data: { phone, ...dati } });
    } else {
      // L'account nasce al primo accesso: non c'è una registrazione da fare,
      // chi è già cliente del centro è già "iscritto".
      await prisma.mobileAccount.create({
        data: { clientId: cliente.id, phone, createdAt: adesso.toISOString(), ...dati },
      });
    }
  } catch {
    // Resta il caso di due richieste nello stesso istante. Meglio dirlo in
    // italiano che lasciare andare fuori un errore del database.
    return {
      ok: false,
      code: 'CONFLICT',
      error: 'Non siamo riusciti a preparare il codice. Riprova fra qualche secondo.',
    };
  }

  return { ok: true, codice, phone, nome: cliente.firstName };
}

export type EsitoVerifica =
  | { ok: true; token: string; clientId: string }
  | { ok: false; code: 'VALIDATION' | 'INVALID_CREDENTIALS' | 'USER_NOT_FOUND' | 'TOO_MANY'; error: string };

/** Controlla il codice e, se torna, apre la sessione. */
export async function verificaCodice(telefonoGrezzo: string, codice: string): Promise<EsitoVerifica> {
  const phone = normalizePhone(String(telefonoGrezzo || ''));
  const pulito = String(codice || '').replace(/\D/g, '');
  if (pulito.length !== 6) {
    return { ok: false, code: 'VALIDATION', error: 'Il codice è di 6 cifre.' };
  }

  const account = await prisma.mobileAccount.findUnique({ where: { phone } });
  if (!account || !account.otpHash || !account.otpExpiresAt) {
    return { ok: false, code: 'USER_NOT_FOUND', error: 'Nessun codice in attesa per questo numero. Richiedine uno nuovo.' };
  }

  if (Date.parse(account.otpExpiresAt) < Date.now()) {
    return { ok: false, code: 'INVALID_CREDENTIALS', error: 'Il codice è scaduto. Richiedine uno nuovo.' };
  }

  if (account.otpAttempts >= OTP_MAX_TENTATIVI) {
    return { ok: false, code: 'TOO_MANY', error: 'Troppi tentativi sbagliati. Richiedi un codice nuovo.' };
  }

  if (!uguali(sha(pulito), account.otpHash)) {
    await prisma.mobileAccount.update({
      where: { id: account.id },
      data: { otpAttempts: { increment: 1 } },
    });
    const rimasti = OTP_MAX_TENTATIVI - account.otpAttempts - 1;
    return {
      ok: false,
      code: 'INVALID_CREDENTIALS',
      error: rimasti > 0 ? `Codice sbagliato. Hai ancora ${rimasti} tentativ${rimasti === 1 ? 'o' : 'i'}.` : 'Codice sbagliato. Richiedi un codice nuovo.',
    };
  }

  // Codice giusto: si brucia subito, così non vale una seconda volta
  const token = nuovoToken();
  await prisma.mobileAccount.update({
    where: { id: account.id },
    data: {
      sessionToken: hashToken(token),
      lastLoginAt: new Date().toISOString(),
      otpHash: null, otpExpiresAt: null, otpAttempts: 0,
    },
  });

  return { ok: true, token, clientId: account.clientId };
}

/** La cliente dietro un token di sessione, oppure null se il token non vale più. */
export async function clienteDaToken(token: string | null | undefined) {
  const pulito = String(token || '').trim();
  if (!pulito) return null;
  const account = await prisma.mobileAccount.findUnique({
    where: { sessionToken: hashToken(pulito) },
    include: { client: true },
  });
  return account?.client ?? null;
}

/** Il token dall'header Authorization: Bearer xxx. */
export function tokenDaRichiesta(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function chiudiSessione(token: string): Promise<void> {
  const pulito = String(token || '').trim();
  if (!pulito) return;
  await prisma.mobileAccount.updateMany({
    where: { sessionToken: hashToken(pulito) },
    data: { sessionToken: null },
  });
}

/* ------------------------------------------------------------------ */
/* La password dell'account                                            */
/* ------------------------------------------------------------------ */

/**
 * Il numero da solo dice CHI SEI, non che sei tu: chiunque conosca il
 * numero di una cliente potrebbe entrarle nell'account. La password si
 * crea (obbligatoria) al primo accesso, e da lì in poi si entra con
 * numero + password. La azzera il centro dalla scheda cliente quando
 * una cliente la dimentica: l'identità la verifica una persona, di
 * persona — che per un centro estetico è la cosa più naturale del mondo.
 */

import bcrypt from 'bcryptjs';

export function passwordValida(p: string): boolean {
  return typeof p === 'string' && p.length >= 8;
}

/** L'account di questo numero ha già una password? (E come si chiama lei.) */
export async function statoPassword(
  telefonoGrezzo: string
): Promise<{ ok: true; haPassword: boolean; nome: string } | { ok: false; code: 'VALIDATION' | 'USER_NOT_FOUND'; error: string }> {
  const phone = normalizePhone(String(telefonoGrezzo || ''));
  if (!isSendablePhone(phone)) {
    return { ok: false, code: 'VALIDATION', error: 'Numero di cellulare non valido. Scrivilo come 3401234567.' };
  }
  const trovata = await trovaCliente(phone);
  if (!trovata) {
    return { ok: false, code: 'USER_NOT_FOUND', error: 'Questo numero non risulta fra le clienti del centro. Chiedi in negozio di essere registrata, poi riprova.' };
  }
  return { ok: true, haPassword: !!trovata.account?.passwordHash, nome: trovata.cliente.firstName };
}

/** Accesso con numero + password: la porta normale, dopo la prima volta. */
export async function entraConPassword(telefonoGrezzo: string, password: string): Promise<EsitoAccesso> {
  const phone = normalizePhone(String(telefonoGrezzo || ''));
  if (!isSendablePhone(phone)) {
    return { ok: false, code: 'VALIDATION', error: 'Numero di cellulare non valido.' };
  }
  const trovata = await trovaCliente(phone);
  // Stesso errore per numero sconosciuto e password sbagliata: rispondere in
  // due modi diversi direbbe a un curioso quali numeri hanno l'account.
  const rifiuto = { ok: false as const, code: 'VALIDATION' as const, error: 'Numero o password non corretti.' };
  if (!trovata?.account?.passwordHash) return rifiuto;
  if (!bcrypt.compareSync(String(password || ''), trovata.account.passwordHash)) return rifiuto;

  const token = nuovoToken();
  const adesso = new Date().toISOString();
  await prisma.mobileAccount.update({
    where: { id: trovata.account.id },
    data: {
      phone,
      sessionToken: hashToken(token),
      lastLoginAt: adesso,
      otpHash: null, otpExpiresAt: null, otpAttempts: 0,
    },
  });
  return { ok: true, token, clientId: trovata.cliente.id, nome: trovata.cliente.firstName };
}

/** Salva la password (hash bcrypt) sull'account della cliente. */
export async function impostaPassword(clientId: string, password: string): Promise<boolean> {
  if (!passwordValida(password)) return false;
  const account = await prisma.mobileAccount.findUnique({ where: { clientId } });
  if (!account) return false;
  await prisma.mobileAccount.update({
    where: { id: account.id },
    data: { passwordHash: bcrypt.hashSync(password, 10) },
  });
  return true;
}

/** L'account di questa cliente ha la password? (Per /me e per i gate dell'app.) */
export async function passwordImpostata(clientId: string): Promise<boolean> {
  const account = await prisma.mobileAccount.findUnique({
    where: { clientId },
    select: { passwordHash: true },
  });
  return !!account?.passwordHash;
}
