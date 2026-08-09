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

export type EsitoRichiesta =
  | { ok: true; codice: string; phone: string; nome: string }
  | { ok: false; code: 'VALIDATION' | 'USER_NOT_FOUND' | 'TOO_MANY'; error: string; attesa?: number };

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

  // Il numero in anagrafica è scritto in mille modi: si confronta la coda
  const chiave = coda(phone);
  const candidati = await prisma.client.findMany({ select: { id: true, firstName: true, phone: true } });
  const cliente = candidati.find(c => coda(c.phone) === chiave);
  if (!cliente) {
    return {
      ok: false,
      code: 'USER_NOT_FOUND',
      error: 'Questo numero non risulta fra le clienti del centro. Chiedi in negozio di essere registrata, poi riprova.',
    };
  }

  const adesso = new Date();
  const account = await prisma.mobileAccount.findUnique({ where: { clientId: cliente.id } });

  if (account?.otpSentAt) {
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

  const codice = nuovoCodice();
  const dati = {
    otpHash: sha(codice),
    otpExpiresAt: new Date(adesso.getTime() + OTP_DURATA_MIN * 60_000).toISOString(),
    otpAttempts: 0,
    otpSentAt: adesso.toISOString(),
  };

  await prisma.mobileAccount.upsert({
    where: { clientId: cliente.id },
    // L'account nasce al primo accesso: non c'è una registrazione da fare,
    // chi è già cliente del centro è già "iscritto".
    create: { clientId: cliente.id, phone, createdAt: adesso.toISOString(), ...dati },
    update: { phone, ...dati },
  });

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
