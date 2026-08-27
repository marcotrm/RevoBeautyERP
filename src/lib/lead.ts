/**
 * I contatti interessati: chi lascia i suoi dati e non è (ancora) cliente.
 *
 * Nasce da un guasto silenzioso. Il modulo di revobeauty.it/contatti non
 * inviava niente: `action="#"`, un `preventDefault()` e un tasto che diventava
 * verde con scritto «Messaggio Inviato!». Sotto c'era anche la riga «Oppure
 * utilizza il modulo Contact Form 7:» seguita dallo shortcode stampato a
 * schermo — `[contact-form-7 id="" title="Contatti"]` — perché quel plugin sul
 * sito non c'è. Quindi: ogni persona che ha scritto dal sito ha visto una
 * conferma e non ha mandato niente a nessuno.
 *
 * Da qui in poi il modulo posta su `/api/lead` e il contatto finisce in
 * gestionale. Il primo messaggio su WhatsApp parte da solo: è lì che si
 * verifica il numero (se il messaggio non arriva, il numero era sbagliato) ed
 * è lì che la segretaria porta avanti la conversazione fino all'appuntamento.
 */

import { prisma } from './prisma';
import { normalizePhone, isSendablePhone, sendWhatsAppApertura } from './whatsapp';
import { notifyNuovaIscrizione } from './telegram';

/** Gli stati del contatto, dal primo modulo compilato alla scheda cliente. */
export const STATI_LEAD = {
  nuovo: 'Nuovo',
  contattato: 'Contattato',
  in_chat: 'In chat',
  prenotato: 'Prenotato',
  cliente: 'Diventato cliente',
  perso: 'Perso',
} as const;

export type StatoLead = keyof typeof STATI_LEAD;

export function etichettaStato(stato: string): string {
  return (STATI_LEAD as Record<string, string>)[stato] || stato;
}

/**
 * Quanto a lungo una nuova richiesta dallo stesso numero è la stessa richiesta.
 *
 * Il doppio invio del modulo (tasto premuto due volte, pagina ricaricata) è la
 * norma, non l'eccezione. Ma una richiesta che arriva due mesi dopo è un'altra
 * persona che ha cambiato idea, e va trattata come nuova.
 */
const GIORNI_DEDUP = 30;

// ============================================================
// Sito → gestionale
// ============================================================

/** I domini da cui il modulo può postare. Il resto viene rifiutato dal browser. */
export function originiAmmesse(): string[] {
  const extra = (process.env.LEAD_ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return [...new Set([
    'https://revobeauty.it',
    'https://www.revobeauty.it',
    ...extra,
  ])];
}

export function corsLead(origin: string | null): Record<string, string> {
  const ammesse = originiAmmesse();
  // Senza Origin (curl, server-to-server) non c'è CORS da concedere: si
  // risponde col primo dominio buono, che il browser non userà mai.
  const consentito = origin && ammesse.includes(origin) ? origin : ammesse[0];
  return {
    'Access-Control-Allow-Origin': consentito,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-lead-secret',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * Segreto condiviso col sito, se impostato.
 *
 * Non è protezione forte — sta in chiaro nel tema di WordPress — ma alza il
 * costo di chi vuole riempire la rubrica di contatti finti trovando l'endpoint
 * per caso. Se non è configurato, l'endpoint resta aperto: meglio raccogliere
 * i contatti che perderli aspettando che qualcuno imposti una variabile.
 */
export function segretoLeadValido(request: Request): boolean {
  const atteso = process.env.LEAD_SECRET;
  if (!atteso) return true;
  return request.headers.get('x-lead-secret') === atteso;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContattoInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  service: string;
  message: string;
  source: string;
  page: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
}

export type Validazione =
  | { ok: true; dati: ContattoInput }
  | { ok: false; errore: string }
  /** Campo trappola compilato: è un robot. Si risponde ok e non si salva niente. */
  | { ok: false; robot: true; errore: string };

function testo(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function booleano(v: unknown): boolean {
  return v === true || v === 'true' || v === 'on' || v === '1' || v === 1;
}

/**
 * Legge e controlla quello che manda il modulo.
 *
 * Il telefono è obbligatorio e l'email no: il seguito di questa conversazione
 * è su WhatsApp, e senza numero il contatto resta una riga in un elenco che
 * nessuno richiama. Sul sito il campo era facoltativo — ed è il motivo per cui
 * va cambiato anche là, non solo qui.
 */
export function validaContatto(body: unknown): Validazione {
  if (!body || typeof body !== 'object') return { ok: false, errore: 'Dati mancanti' };
  const b = body as Record<string, unknown>;

  // Campo trappola: invisibile alle persone, irresistibile per i bot.
  if (testo(b.azienda, 120)) return { ok: false, robot: true, errore: 'Richiesta ignorata' };

  const firstName = testo(b.firstName ?? b.nome, 80);
  const lastName = testo(b.lastName ?? b.cognome, 80);
  const phoneRaw = testo(b.phone ?? b.telefono, 40);
  const email = testo(b.email, 120).toLowerCase();

  if (!firstName) return { ok: false, errore: 'Il nome è obbligatorio' };
  if (phoneRaw.replace(/\D/g, '').length < 8) {
    return { ok: false, errore: 'Serve un numero di cellulare valido' };
  }
  if (email && !EMAIL_RE.test(email)) return { ok: false, errore: 'Email non valida' };
  if (!booleano(b.privacy ?? b.privacyConsent)) {
    return { ok: false, errore: 'Serve il consenso al trattamento dei dati' };
  }

  return {
    ok: true,
    dati: {
      firstName,
      lastName,
      phone: normalizePhone(phoneRaw),
      email,
      service: testo(b.service ?? b.servizio, 120),
      message: testo(b.message ?? b.messaggio, 2000),
      source: testo(b.source, 40) || 'sito',
      page: testo(b.page, 200),
      privacyConsent: true,
      marketingConsent: booleano(b.marketing ?? b.marketingConsent),
    },
  };
}

// ============================================================
// Salvataggio
// ============================================================

function giorniFa(giorni: number): string {
  return new Date(Date.now() - giorni * 86_400_000).toISOString();
}

export interface EsitoSalvataggio {
  id: string;
  duplicato: boolean;
  /** Vero se questo numero è già una scheda cliente: non è un contatto freddo. */
  giaCliente: boolean;
}

/**
 * Salva il contatto, o aggiorna quello che c'era già.
 *
 * La richiesta nuova non sovrascrive la vecchia: si accoda nelle note. Chi
 * scrive due volte a due settimane di distanza di solito la seconda volta
 * chiede un'altra cosa, e perdere la prima significa richiamarlo sapendo metà
 * della storia.
 */
export async function salvaLead(dati: ContattoInput): Promise<EsitoSalvataggio> {
  const adesso = new Date().toISOString();
  const coda = dati.phone.slice(-9);

  const [esistente, cliente] = await Promise.all([
    coda
      ? prisma.lead.findFirst({
          where: {
            phone: { endsWith: coda },
            status: { notIn: ['cliente', 'perso'] },
            createdAt: { gte: giorniFa(GIORNI_DEDUP) },
          },
          orderBy: { createdAt: 'desc' },
        })
      : null,
    coda ? prisma.client.findFirst({ where: { phone: { endsWith: coda } }, select: { id: true } }) : null,
  ]);

  if (esistente) {
    const aggiunta = [
      `— ${adesso.slice(0, 10)}: nuova richiesta dal sito`,
      dati.service && `servizio: ${dati.service}`,
      dati.message,
    ].filter(Boolean).join('\n');

    await prisma.lead.update({
      where: { id: esistente.id },
      data: {
        // Il servizio e il messaggio nuovi diventano quelli correnti, i vecchi
        // restano leggibili nelle note.
        service: dati.service || esistente.service,
        message: dati.message || esistente.message,
        email: dati.email || esistente.email,
        lastName: dati.lastName || esistente.lastName,
        marketingConsent: dati.marketingConsent || esistente.marketingConsent,
        notes: [esistente.notes, aggiunta].filter(Boolean).join('\n\n').slice(0, 4000),
        updatedAt: adesso,
      },
    });
    return { id: esistente.id, duplicato: true, giaCliente: Boolean(cliente) };
  }

  const lead = await prisma.lead.create({
    data: {
      firstName: dati.firstName,
      lastName: dati.lastName,
      phone: dati.phone,
      email: dati.email,
      service: dati.service,
      message: dati.message,
      source: dati.source,
      page: dati.page,
      status: 'nuovo',
      privacyConsent: dati.privacyConsent,
      marketingConsent: dati.marketingConsent,
      clientId: cliente?.id || null,
      createdAt: adesso,
      updatedAt: adesso,
    },
    select: { id: true },
  });

  return { id: lead.id, duplicato: false, giaCliente: Boolean(cliente) };
}

/** Avvisa il centro su Telegram. Non blocca niente: se fallisce, il lead c'è comunque. */
export function avvisaCentro(dati: ContattoInput): void {
  notifyNuovaIscrizione({
    name: `${dati.firstName} ${dati.lastName}`.trim(),
    phone: dati.phone,
    email: dati.email || '—',
    treatment: dati.service || 'richiesta generica',
  }).catch(() => {});
}

// ============================================================
// Primo contatto su WhatsApp
// ============================================================

export interface EsitoContatto { inviato: boolean; motivo?: string }

/**
 * Scrive per primo a chi ha lasciato i contatti.
 *
 * Due cose in un colpo solo: verifica il numero — se il messaggio non viene
 * consegnato, quel numero è sbagliato e lo si scopre subito invece che al
 * terzo tentativo di telefonata — e apre la finestra 24h, che è la porta da
 * cui la segretaria può poi parlare a testo libero.
 *
 * Un contatto si contatta UNA volta sola: `contactedAt` non è decorativo, è il
 * fermo che impedisce a un doppio invio del modulo, o a un riavvio del server
 * a metà richiesta, di far arrivare due messaggi identici a distanza di pochi
 * secondi.
 */
export async function contattaLead(leadId: string): Promise<EsitoContatto> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { inviato: false, motivo: 'contatto non trovato' };
  if (lead.contactedAt) return { inviato: false, motivo: 'già contattato' };
  if (!isSendablePhone(lead.phone)) return { inviato: false, motivo: 'numero non contattabile' };

  // Il fermo si mette PRIMA dell'invio: se lo mettessimo dopo, due richieste
  // in parallelo passerebbero entrambe il controllo e manderebbero due volte.
  const adesso = new Date().toISOString();
  const preso = await prisma.lead.updateMany({
    where: { id: leadId, contactedAt: null },
    data: { contactedAt: adesso, status: 'contattato', updatedAt: adesso },
  });
  if (preso.count === 0) return { inviato: false, motivo: 'già contattato' };

  const res = await sendWhatsAppApertura(
    lead.phone,
    { nome: lead.firstName, motivo: lead.service || 'una richiesta di informazioni' },
    'automation'
  );

  if (!res.ok) {
    // Invio fallito: si toglie il fermo, così chi guarda l'elenco vede un
    // contatto ancora da contattare invece di uno "contattato" che non ha mai
    // ricevuto niente.
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        contactedAt: null,
        status: 'nuovo',
        notes: [lead.notes, `— ${adesso.slice(0, 10)}: primo messaggio non partito (${res.error || 'errore'})`]
          .filter(Boolean).join('\n\n').slice(0, 4000),
        updatedAt: new Date().toISOString(),
      },
    }).catch(() => {});
    return { inviato: false, motivo: res.error || 'invio fallito' };
  }

  return { inviato: true };
}

// ============================================================
// Il contatto avanza
// ============================================================

/** Il contatto (se c'è) legato a un numero di telefono. */
export async function leadDaTelefono(phone: string) {
  const coda = normalizePhone(phone).slice(-9);
  if (coda.length < 6) return null;
  return prisma.lead.findFirst({
    where: { phone: { endsWith: coda }, status: { notIn: ['cliente', 'perso'] } },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Sposta avanti lo stato del contatto quando succede qualcosa su WhatsApp.
 *
 * Serve perché l'elenco dei contatti deve dire la verità senza che nessuno lo
 * aggiorni a mano: se la segretaria ha già preso l'appuntamento, quel contatto
 * non va richiamato dal centro.
 */
export async function avanzaLead(
  phone: string,
  stato: StatoLead,
  extra: { appointmentId?: string; clientId?: string; nota?: string } = {}
): Promise<void> {
  const lead = await leadDaTelefono(phone);
  if (!lead) return;

  // Nessun passo indietro: una risposta in chat non deve declassare un
  // contatto che ha già prenotato.
  const ordine: StatoLead[] = ['nuovo', 'contattato', 'in_chat', 'prenotato', 'cliente'];
  const attuale = ordine.indexOf(lead.status as StatoLead);
  const nuovo = ordine.indexOf(stato);
  if (attuale >= 0 && nuovo >= 0 && nuovo < attuale) return;

  const adesso = new Date().toISOString();
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: stato,
      appointmentId: extra.appointmentId ?? lead.appointmentId,
      clientId: extra.clientId ?? lead.clientId,
      notes: extra.nota
        ? [lead.notes, `— ${adesso.slice(0, 10)}: ${extra.nota}`].filter(Boolean).join('\n').slice(0, 4000)
        : lead.notes,
      updatedAt: adesso,
    },
  }).catch(() => {});
}
