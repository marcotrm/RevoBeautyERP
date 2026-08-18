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
  indirizzo: 'Via Caudina 30, Maddaloni (CE)',
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
  verifiedAt: string | null;
  createdAt: string;
}

/**
 * Statistiche per un insieme di QR (un affiliato intero o un QR solo).
 *
 * Il fatturato si aggancia per nome cliente: la cassa (PosTransaction) non
 * salva l'id del cliente ma solo il nome, quindi si sommano gli incassi veri
 * (non resi, importo > 0) intestati ai clienti portati dall'affiliato.
 * Contano SOLO le spese dal giorno della registrazione in poi: se un omonimo
 * (o la stessa persona con un altro numero) aveva già speso in passato, quei
 * soldi non c'entrano niente con l'affiliato e non devono generare commissioni.
 */
export async function statsPerQrIds(qrIds: string[], commissionPercent: number): Promise<AffStats> {
  if (qrIds.length === 0) return { ...STATS_VUOTE };

  const [scans, leads] = await Promise.all([
    prisma.affiliateScan.findMany({ where: { qrId: { in: qrIds } }, select: { visitorId: true } }),
    prisma.affiliateLead.findMany({
      where: { qrId: { in: qrIds } },
      select: { qrId: true, status: true, clientId: true, voucherUsedAt: true, verifiedAt: true, createdAt: true },
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

    // Per ogni nome, il giorno (italiano) in cui quel cliente è stato portato:
    // gli incassi precedenti non contano. Con più registrazioni omonime vale
    // la più vecchia.
    const registratoIl = new Map<string, string>();
    for (const l of verificatiLeads) {
      const c = clienti.find(x => x.id === l.clientId);
      if (!c) continue;
      const nome = `${c.firstName} ${c.lastName}`.trim().toLowerCase();
      const giorno = new Date(l.verifiedAt || l.createdAt).toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
      const attuale = registratoIl.get(nome);
      if (!attuale || giorno < attuale) registratoIl.set(nome, giorno);
    }

    if (registratoIl.size > 0) {
      const vendite = await prisma.posTransaction.findMany({
        where: { isRefund: false, total: { gt: 0 } },
        select: { clientName: true, total: true, date: true },
      });
      const pagatori = new Set<string>();
      for (const v of vendite) {
        const nome = String(v.clientName || '').trim().toLowerCase();
        const dal = nome ? registratoIl.get(nome) : undefined;
        if (dal && v.date >= dal) {
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

// ============================================================
// Avvisi all'affiliato
// ============================================================

/**
 * L'affiliato viene pagato in percentuale, ma se non vede muoversi niente
 * smette di mandare gente.
 *
 * Finora l'unico modo per sapere quanto aveva guadagnato era aprire il portale
 * col link che gli avevamo passato a mano — cosa che nessuno fa. Qui l'avviso
 * parte da solo quando una persona che ha portato lui spende davvero.
 *
 * Regole che questo pezzo deve rispettare, tutte imparate leggendo la cassa:
 *  - non deve MAI far fallire un incasso: gira dentro al suo try/catch e non
 *    viene atteso da nessuno;
 *  - non deve mandare due volte lo stesso avviso, nemmeno se qualcuno fa due
 *    volte lo stesso incasso o il server ritenta: la riga di prenotazione si
 *    crea in modo atomico PRIMA di spendere il messaggio;
 *  - non dice mai chi è la cliente: l'affiliato ha diritto alla sua
 *    percentuale, non alla scheda di chi entra.
 */
export async function avvisaAffiliatoIncasso(params: {
  clientId: string;
  importo: number;
  /** Id della vendita: rende l'avviso ripetibile una volta sola. */
  sourceId: string;
}): Promise<{ inviato: boolean; motivo?: string }> {
  const { clientId, importo, sourceId } = params;
  if (!clientId || !(importo > 0)) return { inviato: false, motivo: 'niente da segnalare' };

  const { getWaAutomationsConfig } = await import('@/lib/wa-automations');
  const cfg = await getWaAutomationsConfig();
  if (!cfg.affiliatoIncasso) return { inviato: false, motivo: 'avviso spento' };

  // Il legame vero è qui: AffiliateLead.clientId. Il campo `referredBy` sul
  // cliente è solo il nome scritto a parole e non serve a pagare nessuno.
  const lead = await prisma.affiliateLead.findFirst({
    where: { clientId, status: 'verified' },
    include: { affiliate: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!lead?.affiliate) return { inviato: false, motivo: 'cliente non portato da un affiliato' };

  const aff = lead.affiliate;
  if (!aff.isActive) return { inviato: false, motivo: 'affiliato non attivo' };

  const { normalizePhone, isSendablePhone, sendWhatsAppTemplate } = await import('@/lib/whatsapp');
  if (!isSendablePhone(aff.phone || '')) return { inviato: false, motivo: 'numero affiliato mancante o non valido' };

  const provvigione = Math.round(importo * aff.commissionPercent) / 100;
  if (provvigione <= 0) return { inviato: false, motivo: 'provvigione a zero' };

  // Prenotazione atomica: chi perde la corsa non manda niente.
  const rowId = `wa:affiliato:incasso:${sourceId}`;
  try {
    await prisma.adminEntry.create({
      data: {
        rowId, kind: 'wa_log', entityId: aff.id,
        data: { affiliateId: aff.id, clientId, importo, provvigione, ok: false, at: new Date().toISOString() },
        createdAt: new Date().toISOString(),
      },
    });
  } catch {
    return { inviato: false, motivo: 'avviso già mandato per questo incasso' };
  }

  const { sanitizeParam } = await import('@/lib/wa-templates');
  const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
  const res = await sendWhatsAppTemplate(normalizePhone(aff.phone as string), 'affiliatoIncasso', {
    bodyParams: [
      sanitizeParam(aff.contactName || aff.businessName),
      sanitizeParam(eur(importo)),
      sanitizeParam(eur(provvigione)),
    ],
    source: 'automation',
  });

  await prisma.adminEntry.update({
    where: { rowId },
    data: { data: { affiliateId: aff.id, clientId, importo, provvigione, ok: res.ok, error: res.error, at: new Date().toISOString() } },
  }).catch(() => {});

  return { inviato: res.ok, motivo: res.error };
}

/** Il mese appena chiuso, in numeri: "2026-07". */
function meseScorso(oggi = new Date()): { chiave: string; nome: string; dal: string; al: string } {
  const d = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  const anno = d.getUTCFullYear();
  const mese = d.getUTCMonth();
  const ultimo = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate();
  const due = (n: number) => String(n).padStart(2, '0');
  return {
    chiave: `${anno}-${due(mese + 1)}`,
    nome: new Intl.DateTimeFormat('it-IT', { month: 'long', timeZone: 'UTC' }).format(d),
    dal: `${anno}-${due(mese + 1)}-01`,
    al: `${anno}-${due(mese + 1)}-${due(ultimo)}`,
  };
}

/**
 * Il riepilogo del mese a tutti gli affiliati attivi.
 *
 * Gli avvisi singoli fanno vedere il movimento, questo fa vedere il totale — ed
 * è il numero su cui si discute, se non lo mandi tu per primo.
 *
 * Il fatturato si conta come nel portale (incassi dei clienti portati, dal
 * giorno in cui sono stati registrati in poi), ma ristretto al mese chiuso.
 */
export async function riepilogoMensileAffiliati(quando = new Date()): Promise<{ mandati: number; saltati: string[] }> {
  const { getWaAutomationsConfig } = await import('@/lib/wa-automations');
  const cfg = await getWaAutomationsConfig();
  if (!cfg.affiliatoMese) return { mandati: 0, saltati: ['riepilogo spento'] };

  const mese = meseScorso(quando);
  const affiliati = await prisma.affiliate.findMany({ where: { isActive: true }, include: { leads: true } });
  const { normalizePhone, isSendablePhone, sendWhatsAppTemplate } = await import('@/lib/whatsapp');
  const { sanitizeParam } = await import('@/lib/wa-templates');

  let mandati = 0;
  const saltati: string[] = [];

  for (const aff of affiliati) {
    if (!isSendablePhone(aff.phone || '')) { saltati.push(`${aff.businessName}: numero mancante`); continue; }

    const clientIds = aff.leads.filter(l => l.clientId && l.status === 'verified').map(l => l.clientId as string);
    if (!clientIds.length) { saltati.push(`${aff.businessName}: nessun cliente portato`); continue; }

    const clienti = await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { firstName: true, lastName: true } });
    const nomi = new Set(clienti.map(c => `${c.firstName} ${c.lastName}`.trim().toLowerCase()));

    const incassi = await prisma.posTransaction.findMany({
      where: { date: { gte: mese.dal, lte: mese.al }, isRefund: false, total: { gt: 0 } },
      select: { clientName: true, total: true },
    });
    let fatturato = 0;
    const teste = new Set<string>();
    for (const t of incassi) {
      const k = (t.clientName || '').trim().toLowerCase();
      if (!nomi.has(k)) continue;
      fatturato += t.total;
      teste.add(k);
    }

    // Un mese a zero non si manda: un messaggio che dice "hai guadagnato 0 €"
    // non informa, ricorda soltanto che non è arrivato nessuno.
    if (fatturato <= 0) { saltati.push(`${aff.businessName}: mese a zero`); continue; }

    const rowId = `wa:affiliato:mese:${aff.id}:${mese.chiave}`;
    try {
      await prisma.adminEntry.create({
        data: { rowId, kind: 'wa_log', entityId: aff.id, data: { mese: mese.chiave, fatturato, ok: false }, createdAt: new Date().toISOString() },
      });
    } catch {
      saltati.push(`${aff.businessName}: già mandato per ${mese.chiave}`);
      continue;
    }

    const guadagno = Math.round(fatturato * aff.commissionPercent) / 100;
    const persone = teste.size === 1 ? 'una persona' : `${teste.size} persone`;
    const res = await sendWhatsAppTemplate(normalizePhone(aff.phone as string), 'affiliatoMese', {
      bodyParams: [
        sanitizeParam(aff.contactName || aff.businessName),
        sanitizeParam(mese.nome),
        sanitizeParam(`${guadagno.toFixed(2).replace('.', ',')} €`),
        sanitizeParam(persone),
      ],
      source: 'automation',
    });

    await prisma.adminEntry.update({
      where: { rowId },
      data: { data: { mese: mese.chiave, fatturato, guadagno, persone: teste.size, ok: res.ok, error: res.error } },
    }).catch(() => {});

    if (res.ok) mandati++;
    else saltati.push(`${aff.businessName}: ${res.error || 'invio fallito'}`);
  }

  return { mandati, saltati };
}
