'use server';

import { prisma } from '@/lib/prisma';
import { waProvider, whatsappMissingVars } from '@/lib/whatsapp';
import { listD360Templates } from '@/lib/whatsapp360';
import { WA_TEMPLATES, type TemplateKey } from '@/lib/wa-templates';
import {
  getWaAutomationsConfig, saveWaAutomationsConfig, runWaAutomations,
  type WaAutomationsConfig, type RunResult,
} from '@/lib/wa-automations';

export async function loadWaConfig(): Promise<WaAutomationsConfig> {
  return getWaAutomationsConfig();
}

export async function saveWaConfig(cfg: WaAutomationsConfig): Promise<{ ok: boolean }> {
  await saveWaAutomationsConfig(cfg);
  return { ok: true };
}

export interface WaStatus {
  provider: '360dialog' | 'evolution' | null;
  missing: string[];
}

export async function loadWaStatus(): Promise<WaStatus> {
  return { provider: waProvider(), missing: whatsappMissingVars() };
}

/**
 * Simulazione: elenca chi verrebbe contattato adesso e con quale testo,
 * senza mandare nulla.
 */
export async function previewAutomation(which: TemplateKey): Promise<RunResult | null> {
  const res = await runWaAutomations({ which, force: true, dryRun: true });
  return res[0] || null;
}

/** Esecuzione reale su richiesta (tasto "Invia ora"). */
export async function runAutomationNow(which: TemplateKey): Promise<RunResult | null> {
  const res = await runWaAutomations({ which, force: true, dryRun: false });
  return res[0] || null;
}

export interface WaInboxMessage {
  phone: string;
  name?: string;
  text: string;
  receivedAt: string;
}

/**
 * Ultimi messaggi ricevuti dai clienti. Serve soprattutto a verificare che il
 * webhook 360dialog sia collegato: se qui non compare nulla dopo aver scritto
 * al numero del centro, il webhook non sta consegnando.
 */
export async function loadWaInbox(limit = 15): Promise<WaInboxMessage[]> {
  const rows = await prisma.adminEntry.findMany({
    where: { kind: 'wa_inbox' },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });
  return rows.map(r => {
    const d = (r.data || {}) as { phone?: string; name?: string; text?: string; receivedAt?: string };
    return {
      phone: d.phone || r.entityId || '',
      name: d.name,
      text: d.text || '',
      receivedAt: d.receivedAt || r.createdAt,
    };
  });
}

export interface TemplateCheck {
  key: TemplateKey;
  name: string;
  category: string;
  /** Stato su 360dialog: APPROVED, PENDING, REJECTED, MISSING. */
  status: string;
}

/**
 * Confronta i template del catalogo con quelli davvero approvati su 360dialog.
 * Un'automazione con template MISSING o PENDING non può partire.
 */
export async function checkTemplates(): Promise<{ ok: boolean; error?: string; checks?: TemplateCheck[] }> {
  const remote = await listD360Templates();
  if (!remote.ok) return { ok: false, error: remote.error };

  const checks = (Object.keys(WA_TEMPLATES) as TemplateKey[]).map(key => {
    const tpl = WA_TEMPLATES[key];
    const found = remote.templates.find(t => t.name === tpl.name && t.language === tpl.language);
    return { key, name: tpl.name, category: tpl.category, status: found?.status || 'MISSING' };
  });
  return { ok: true, checks };
}
