'use server';

/**
 * Campagne WhatsApp fatte a mano dal gestionale: creazione dei template e invio
 * a clienti scelti uno per uno.
 *
 * Perché passa tutto da qui e non da 360dialog: il centro deve poter scrivere
 * un messaggio, farlo approvare e mandarlo senza uscire dal gestionale.
 */

import { prisma } from '@/lib/prisma';
import { createD360Template, listD360Templates } from '@/lib/whatsapp360';
import { sendD360Template } from '@/lib/whatsapp360';
import { normalizePhone, isSendablePhone, waProvider } from '@/lib/whatsapp';
import { logOutbound } from '@/lib/wa-conversations';
import { sanitizeParam } from '@/lib/wa-templates';

const LOG_KIND = 'wa_log';

export interface TemplateRemoto {
  name: string;
  status: string;
  category: string;
  language: string;
}

/** Tutti i template del canale, non solo quelli del catalogo interno. */
export async function listaTemplate(): Promise<{ ok: boolean; templates: TemplateRemoto[]; error?: string }> {
  const res = await listD360Templates();
  if (!res.ok) return { ok: false, templates: [], error: res.error };
  return { ok: true, templates: res.templates };
}

/**
 * Crea il template su Meta. Il nome viene normalizzato (minuscolo, underscore)
 * perché Meta accetta solo quel formato e un nome sbagliato fa fallire l'invio
 * settimane dopo, quando nessuno si ricorda più il perché.
 */
export async function creaTemplate(params: {
  nome: string;
  categoria: 'MARKETING' | 'UTILITY';
  testo: string;
}): Promise<{ ok: boolean; status?: string; error?: string; nome?: string }> {
  const nome = params.nome.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!nome) return { ok: false, error: 'Serve un nome per il template' };
  const testo = params.testo.trim();
  if (!testo) return { ok: false, error: 'Serve il testo del messaggio' };

  // Un esempio per ogni {{n}} presente nel testo: senza, Meta rifiuta.
  const segnaposti = [...new Set([...testo.matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1])))].sort((a, b) => a - b);
  const esempi = segnaposti.map(n => (n === 1 ? 'Maria' : 'esempio'));

  const res = await createD360Template({
    name: nome,
    category: params.categoria,
    language: 'it',
    body: testo,
    example: esempi.length ? esempi : undefined,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, status: res.status, nome };
}

export interface DestinatarioCampagna {
  id: string;
  nome: string;
  phone: string;
  marketingConsent: boolean;
  /** 'F', 'M' oppure null quando in scheda non è stato indicato. */
  sesso: 'F' | 'M' | null;
}

/** Clienti con un numero valido, per la scelta dei destinatari. */
export async function clientiPerCampagna(): Promise<DestinatarioCampagna[]> {
  const clients = await prisma.client.findMany({
    select: { id: true, firstName: true, lastName: true, phone: true, marketingConsent: true, gender: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  return clients
    .filter(c => isSendablePhone(c.phone))
    .map(c => {
      // In scheda il sesso è 'F'/'M', ma tante schede non ce l'hanno: chi non
      // l'ha indicato resta a parte invece di finire d'ufficio fra le donne.
      const g = String(c.gender || '').trim().toUpperCase();
      return {
        id: c.id,
        nome: `${c.firstName} ${c.lastName}`.trim(),
        phone: normalizePhone(c.phone),
        marketingConsent: c.marketingConsent,
        sesso: g === 'F' ? 'F' as const : g === 'M' ? 'M' as const : null,
      };
    });
}

export interface EsitoCampagna {
  inviati: number;
  falliti: number;
  saltati: number;
  errori: string[];
}

/**
 * Manda un template approvato ai clienti scelti.
 *
 * `{{1}}` viene riempito col nome del cliente: è la personalizzazione che serve
 * nel 99% dei casi e evita di far compilare parametri a mano per ogni persona.
 * Gli altri segnaposto prendono il testo fisso passato in `parametriFissi`.
 */
export async function inviaCampagna(params: {
  templateName: string;
  categoria: string;
  clientIds: string[];
  parametriFissi?: string[];
  anteprima: string;
}): Promise<EsitoCampagna> {
  const esito: EsitoCampagna = { inviati: 0, falliti: 0, saltati: 0, errori: [] };
  if (!waProvider()) {
    esito.errori.push('WhatsApp non configurato');
    return esito;
  }

  const clients = await prisma.client.findMany({
    where: { id: { in: params.clientIds } },
    select: { id: true, firstName: true, lastName: true, phone: true, marketingConsent: true },
  });

  const marketing = params.categoria.toUpperCase() === 'MARKETING';
  const oggi = new Date().toISOString().slice(0, 10);

  for (const c of clients) {
    if (!isSendablePhone(c.phone)) { esito.saltati++; continue; }
    // Il consenso vale solo per i messaggi promozionali
    if (marketing && !c.marketingConsent) { esito.saltati++; continue; }

    // Stesso template, stesso cliente, stesso giorno: non parte due volte
    const rowId = `wa:campagna:${params.templateName}:${c.id}:${oggi}`;
    const gia = await prisma.adminEntry.findUnique({ where: { rowId } });
    if ((gia?.data as { ok?: boolean } | null)?.ok) { esito.saltati++; continue; }

    const nome = sanitizeParam(c.firstName || `${c.firstName} ${c.lastName}`);
    const bodyParams = [nome, ...(params.parametriFissi || []).map(p => sanitizeParam(p))];
    const phone = normalizePhone(c.phone);
    const testo = params.anteprima.replace(/\{\{1\}\}/g, nome);

    const res = await sendD360Template(phone, params.templateName, { language: 'it', bodyParams });

    await logOutbound({ phone, text: testo, source: 'automation', messageId: res.messageId, ok: res.ok, error: res.error });
    await prisma.adminEntry.upsert({
      where: { rowId },
      update: { data: { campagna: params.templateName, clientId: c.id, phone, ok: res.ok, error: res.error, sentAt: new Date().toISOString() } },
      create: {
        rowId, kind: LOG_KIND, entityId: rowId,
        data: { campagna: params.templateName, clientId: c.id, phone, ok: res.ok, error: res.error, sentAt: new Date().toISOString() },
        createdAt: new Date().toISOString(),
      },
    });

    if (res.ok) esito.inviati++;
    else {
      esito.falliti++;
      if (res.error && !esito.errori.includes(res.error)) esito.errori.push(res.error);
    }
  }

  return esito;
}
