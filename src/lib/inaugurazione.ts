import { randomBytes } from 'crypto';

/**
 * Configurazione e helper condivisi per il flusso "Inaugurazione".
 *
 * Il sito WordPress (revobeauty.it) invia i lead del coupon a questo ERP,
 * che salva il contatto come "non confermato", invia un'email di conferma
 * (double opt-in) e aggiorna lo stato a "confermato" quando l'utente clicca.
 */

// ── Trattamenti selezionabili nel coupon ─────────────────────────────
export const TREATMENTS = {
  lampada: 'Lampada',
  pressoterapia: 'Pressoterapia',
  body_sculpting: 'Body Sculpting',
} as const;

export type TreatmentKey = keyof typeof TREATMENTS;

export function isValidTreatment(value: unknown): value is TreatmentKey {
  return typeof value === 'string' && value in TREATMENTS;
}

export function treatmentLabel(key: string): string {
  return (TREATMENTS as Record<string, string>)[key] ?? key;
}

// ── URL di base (con default sul dominio di produzione) ──────────────
export function erpBaseUrl(): string {
  return (process.env.ERP_URL || 'https://erp.revobeauty.it').replace(/\/$/, '');
}

export function siteBaseUrl(): string {
  return (process.env.SITE_URL || 'https://revobeauty.it').replace(/\/$/, '');
}

// ── Sicurezza dell'ingestione lead (segreto condiviso con WordPress) ──
/**
 * Se INAUGURAZIONE_SECRET è impostato lato ERP, il sito deve inviarlo
 * nell'header "x-inaugurazione-secret". Se non è impostato, l'endpoint
 * resta comunque protetto dal double opt-in (nessun contatto è valido
 * finché l'email non viene confermata).
 */
export function checkIngestSecret(request: Request): boolean {
  const expected = process.env.INAUGURAZIONE_SECRET;
  if (!expected) return true; // nessun segreto configurato → non bloccare
  return request.headers.get('x-inaugurazione-secret') === expected;
}

// ── CORS (il form del sito può inviare direttamente in fallback) ─────
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': siteBaseUrl(),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-inaugurazione-secret',
    'Access-Control-Max-Age': '86400',
  };
}

// ── Token di conferma univoco ────────────────────────────────────────
export function generateConfirmToken(): string {
  return randomBytes(24).toString('hex');
}

export function confirmUrl(token: string): string {
  return `${erpBaseUrl()}/api/inaugurazione/confirm?token=${encodeURIComponent(token)}`;
}

// ── Validazione contatto ─────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LeadInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  treatment: TreatmentKey;
  source?: string;
}

export function validateLead(body: unknown): { ok: true; data: LeadInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body mancante' };
  const b = body as Record<string, unknown>;

  const firstName = typeof b.firstName === 'string' ? b.firstName.trim() : '';
  const lastName = typeof b.lastName === 'string' ? b.lastName.trim() : '';
  const phone = typeof b.phone === 'string' ? b.phone.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const treatment = b.treatment;
  const source = typeof b.source === 'string' ? b.source.trim().slice(0, 60) : undefined;

  if (!firstName) return { ok: false, error: 'Nome obbligatorio' };
  if (!lastName) return { ok: false, error: 'Cognome obbligatorio' };
  if (!phone || phone.replace(/\D/g, '').length < 6) return { ok: false, error: 'Numero di telefono non valido' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Email non valida' };
  if (!isValidTreatment(treatment)) return { ok: false, error: 'Trattamento non valido' };

  return {
    ok: true,
    data: {
      firstName: firstName.slice(0, 80),
      lastName: lastName.slice(0, 80),
      phone: phone.slice(0, 40),
      email: email.slice(0, 120),
      treatment,
      source,
    },
  };
}
