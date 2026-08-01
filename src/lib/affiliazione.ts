/**
 * Affiliazione tramite QR code.
 *
 * Il giro completo: un'attività partner (bar, palestra, parrucchiere…) espone
 * il suo QR → il cliente lo inquadra e atterra su /q/[slug] → si registra →
 * riceve un codice OTP su WhatsApp → verificato il numero nasce il voucher del
 * trattamento gratuito e il cliente entra in anagrafica legato per sempre a
 * quell'affiliato. Da lì in poi ogni suo incasso in cassa matura la commissione.
 *
 * La commissione NON nasce dalla scansione: serve registrazione completata,
 * numero verificato via OTP, e un incasso vero in cassa. È la difesa di base
 * contro i furbi (scansioni ripetute, auto-registrazioni, doppioni).
 */

import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';

/** Dove si trova il centro: compare su landing, voucher e locandine. */
export const CENTRO = {
  nome: 'RevoBeauty',
  indirizzo: 'Via Caudina, Maddaloni (CE)',
};

export const QR_STATUS_LABELS: Record<string, string> = {
  draft: 'Bozza',
  active: 'Attivo',
  suspended: 'Sospeso',
  expired: 'Scaduto',
  disabled: 'Disattivato',
  blocked: 'Bloccato per anomalia',
};

// ------------------------------------------------------------
// Generatori di codici
// ------------------------------------------------------------

/** Alfabeto senza caratteri ambigui (niente 0/O, 1/I/l): finisce su volantini e telefonate. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function codiceCasuale(len: number): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALFABETO[bytes[i] % ALFABETO.length];
  return out;
}

/** Slug del QR: corto (sta comodo nel QR) ma non indovinabile. */
export function nuovoSlug(): string {
  return codiceCasuale(8).toLowerCase();
}

/** Token del portale affiliato: è l'unica chiave d'accesso, quindi lungo. */
export function nuovoPortalToken(): string {
  return codiceCasuale(24).toLowerCase();
}

/** Codice del voucher omaggio, da dire a voce in negozio: corto e leggibile. */
export function nuovoVoucher(): string {
  return `RB-${codiceCasuale(6)}`;
}

/** Codice affiliato leggibile ricavato dal nome attività (es. "Bar Rossi" → BAR-ROSSI). */
export function codiceDaNome(nome: string): string {
  const base = nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 24);
  return base || `AFF-${codiceCasuale(4)}`;
}

// ------------------------------------------------------------
// URL pubblici
// ------------------------------------------------------------

/** Origine pubblica dell'app: APP_URL in produzione, l'origine della richiesta in locale. */
export function publicOrigin(requestUrl?: string): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (requestUrl) return new URL(requestUrl).origin;
  return '';
}

export function landingUrl(slug: string, requestUrl?: string): string {
  return `${publicOrigin(requestUrl)}/q/${slug}`;
}

// ------------------------------------------------------------
// Telefono e dispositivo
// ------------------------------------------------------------

/** Chiave di confronto dei numeri: ultime 9 cifre, come nel resto del gestionale. */
export function phoneKey(raw: string | null | undefined): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.slice(-9);
}

/** "iPhone" / "Android" / "Computer": basta questo per capire da dove scansionano. */
export function descriviDevice(userAgent: string | null | undefined): string {
  const ua = String(userAgent || '');
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone';
  if (/Android/i.test(ua)) return 'Android';
  if (!ua) return 'Sconosciuto';
  return 'Computer';
}

// ------------------------------------------------------------
// Stato effettivo di un QR
// ------------------------------------------------------------

export interface QrRow {
  id: string;
  slug: string;
  status: string;
  expiresAt: string | null;
  maxUses: number | null;
}

/**
 * Lo stato "vero" di un QR: quello salvato, più la scadenza calcolata al volo.
 * La scadenza non viene scritta da un cron: si valuta ogni volta che serve.
 */
export async function statoEffettivo(qr: QrRow): Promise<string> {
  if (qr.status !== 'active') return qr.status;
  if (qr.expiresAt) {
    const oggi = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
    if (oggi > qr.expiresAt) return 'expired';
  }
  if (qr.maxUses && qr.maxUses > 0) {
    const usati = await prisma.affiliateLead.count({ where: { qrId: qr.id, status: 'verified' } });
    if (usati >= qr.maxUses) return 'expired';
  }
  return 'active';
}

// ------------------------------------------------------------
// Statistiche: dalle scansioni alle commissioni
// ------------------------------------------------------------

export interface AffStats {
  scansioni: number;
  scansioniUniche: number;
  registrazioni: number;   // registrazioni iniziate (esclusi i bloccati antifrode)
  verificati: number;      // OTP confermato = cliente acquisito
  abbandonate: number;     // hanno iniziato ma non confermato il codice
  bloccati: number;        // fermati dall'antifrode
  conversione: number;     // verificati / scansioni uniche, in %
  appuntamenti: number;
  omaggiUsati: number;
  clientiPaganti: number;
  fatturato: number;
  commissioni: number;
}

const STATS_VUOTE: AffStats = {
  scansioni: 0, scansioniUniche: 0, registrazioni: 0, verificati: 0,
  abbandonate: 0, bloccati: 0, conversione: 0, appuntamenti: 0,
  omaggiUsati: 0, clientiPaganti: 0, fatturato: 0, commissioni: 0,
};

interface LeadPerStats {
  qrId: string;
  status: string;
  clientId: string | null;
  voucherUsedAt: string | null;
}

/**
 * Statistiche per un insieme di QR (un affiliato intero o un QR solo).
 *
 * Il fatturato si aggancia per nome cliente: la cassa (PosTransaction) non
 * salva l'id del cliente ma solo il nome, quindi si sommano gli incassi veri
 * (non resi, importo > 0) intestati ai clienti portati dall'affiliato.
 */
export async function statsPerQrIds(qrIds: string[], commissionPercent: number): Promise<AffStats> {
  if (qrIds.length === 0) return { ...STATS_VUOTE };

  const [scans, leads] = await Promise.all([
    prisma.affiliateScan.findMany({ where: { qrId: { in: qrIds } }, select: { visitorId: true } }),
    prisma.affiliateLead.findMany({
      where: { qrId: { in: qrIds } },
      select: { qrId: true, status: true, clientId: true, voucherUsedAt: true },
    }) as Promise<LeadPerStats[]>,
  ]);

  const visitatori = new Set<string>();
  let anonime = 0;
  for (const s of scans) {
    if (s.visitorId) visitatori.add(s.visitorId);
    else anonime++;
  }

  const verificatiLeads = leads.filter(l => l.status === 'verified');
  const bloccati = leads.filter(l => l.status === 'blocked').length;
  const registrazioni = leads.length - bloccati;

  const clientIds = verificatiLeads.map(l => l.clientId).filter((id): id is string => Boolean(id));

  let appuntamenti = 0;
  let clientiPaganti = 0;
  let fatturato = 0;
  if (clientIds.length > 0) {
    const clienti = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    appuntamenti = await prisma.appointment.count({
      where: { clientId: { in: clientIds }, status: { notIn: ['cancelled', 'no_show'] } },
    });

    const nomi = new Set(clienti.map(c => `${c.firstName} ${c.lastName}`.trim().toLowerCase()));
    if (nomi.size > 0) {
      const vendite = await prisma.posTransaction.findMany({
        where: { isRefund: false, total: { gt: 0 } },
        select: { clientName: true, total: true },
      });
      const pagatori = new Set<string>();
      for (const v of vendite) {
        const nome = String(v.clientName || '').trim().toLowerCase();
        if (nome && nomi.has(nome)) {
          fatturato += v.total;
          pagatori.add(nome);
        }
      }
      clientiPaganti = pagatori.size;
    }
  }

  const scansioniUniche = visitatori.size + anonime;
  return {
    scansioni: scans.length,
    scansioniUniche,
    registrazioni,
    verificati: verificatiLeads.length,
    abbandonate: leads.filter(l => l.status === 'otp').length,
    bloccati,
    conversione: scansioniUniche > 0 ? Math.round((verificatiLeads.length / scansioniUniche) * 100) : 0,
    appuntamenti,
    omaggiUsati: leads.filter(l => l.voucherUsedAt).length,
    clientiPaganti,
    fatturato: Math.round(fatturato * 100) / 100,
    commissioni: Math.round(fatturato * commissionPercent) / 100,
  };
}
