'use server';

/**
 * Campagne WhatsApp fatte a mano dal gestionale: creazione dei template e invio
 * a clienti scelti uno per uno.
 *
 * Perché passa tutto da qui e non da 360dialog: il centro deve poter scrivere
 * un messaggio, farlo approvare e mandarlo senza uscire dal gestionale.
 */

import { prisma } from '@/lib/prisma';
import { createD360Template, listD360Templates, deleteD360Template } from '@/lib/whatsapp360';
import { sendD360Template } from '@/lib/whatsapp360';
import { normalizePhone, isSendablePhone, waProvider } from '@/lib/whatsapp';
import { logOutbound } from '@/lib/wa-conversations';
import { sanitizeParam } from '@/lib/wa-templates';
import { sessoDaNome } from '@/lib/sessoDaNome';

const LOG_KIND = 'wa_log';

export interface TemplateRemoto {
  name: string;
  status: string;
  category: string;
  language: string;
  /**
   * Il testo della versione ATTIVA su Meta — quello che il cliente legge
   * davvero. Senza, dal gestionale si vedeva solo il nome tecnico e per sapere
   * cosa sarebbe partito bisognava aprire il pannello di 360dialog.
   */
  body?: string;
  header?: string;
  footer?: string;
  buttons?: { type: string; text?: string; url?: string }[];
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

/**
 * Toglie un template dal canale. Usato per i rifiutati, che altrimenti restano
 * in elenco per sempre in mezzo a quelli buoni.
 */
export async function eliminaTemplate(nome: string): Promise<{ ok: boolean; error?: string }> {
  if (!nome.trim()) return { ok: false, error: 'Serve il nome del template' };
  return deleteD360Template(nome.trim());
}

export interface DestinatarioCampagna {
  id: string;
  nome: string;
  phone: string;
  marketingConsent: boolean;
  /** 'F', 'M' oppure null: dalla scheda quando c'è, altrimenti dal nome. */
  sesso: 'F' | 'M' | null;
  /** true quando il sesso non era in scheda ed è stato dedotto dal nome. */
  dedotto: boolean;
  /** true quando la scheda dice una cosa e il nome un'altra: da controllare. */
  discordante: boolean;
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
      // Il campo in scheda è vuoto su una cliente su tre: dove manca si guarda
      // il nome di battesimo, altrimenti una campagna per sole donne perde
      // decine di clienti vere. Dove i due si contraddicono (in anagrafica
      // capita: uomini salvati come 'F' senza accorgersene) non si sceglie di
      // nascosto — si segnala, e chi manda decide guardando il nome.
      const inScheda = String(c.gender || '').trim().toUpperCase();
      const daNome = sessoDaNome(c.firstName);
      const valido = inScheda === 'F' || inScheda === 'M' ? (inScheda as 'F' | 'M') : null;
      return {
        id: c.id,
        nome: `${c.firstName} ${c.lastName}`.trim(),
        phone: normalizePhone(c.phone),
        marketingConsent: c.marketingConsent,
        sesso: valido ?? daNome,
        dedotto: !valido && !!daNome,
        discordante: !!valido && !!daNome && valido !== daNome,
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
  /**
   * Manda il promozionale anche a chi in scheda non risulta aver dato il
   * consenso. Sta a chi invia sapere se quel consenso esiste su carta e non è
   * mai stato registrato qui: di suo il gestionale salta queste persone.
   */
  includiSenzaConsenso?: boolean;
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
    // Il consenso vale solo per i messaggi promozionali, e si scavalca solo
    // se chi invia lo ha chiesto esplicitamente da questa schermata.
    if (marketing && !c.marketingConsent && !params.includiSenzaConsenso) { esito.saltati++; continue; }

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
