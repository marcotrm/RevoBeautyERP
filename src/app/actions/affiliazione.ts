'use server';

/**
 * Gestione del programma affiliati dal gestionale: anagrafica degli affiliati,
 * i loro QR code (creazione, sospensione, sostituzione), le registrazioni che
 * arrivano dalle landing e i numeri che ne derivano (fino alle commissioni).
 *
 * Le pagine pubbliche (landing, portale) NON passano da qui: hanno le loro
 * rotte API. Qui c'è solo quello che si fa da dentro il gestionale.
 */

import { prisma } from '@/lib/prisma';
import {
  nuovoSlug, nuovoPortalToken, nuovoVoucher, codiceDaNome, statoEffettivo,
  statsPerQrIds, publicOrigin,
  type AffStats,
} from '@/lib/affiliazione';

// ------------------------------------------------------------
// Affiliati
// ------------------------------------------------------------

export interface AffiliatoRiga {
  id: string;
  code: string;
  businessName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  commissionPercent: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  portalUrl: string;
  numQr: number;
  stats: AffStats;
}

export async function listaAffiliati(): Promise<AffiliatoRiga[]> {
  const affiliati = await prisma.affiliate.findMany({
    orderBy: { createdAt: 'desc' },
    include: { qrs: { select: { id: true } } },
  });
  const origin = publicOrigin();
  return Promise.all(affiliati.map(async a => ({
    id: a.id,
    code: a.code,
    businessName: a.businessName,
    contactName: a.contactName,
    phone: a.phone,
    email: a.email,
    commissionPercent: a.commissionPercent,
    isActive: a.isActive,
    notes: a.notes,
    createdAt: a.createdAt,
    portalUrl: `${origin}/affiliato/${a.portalToken}`,
    numQr: a.qrs.length,
    stats: await statsPerQrIds(a.qrs.map(q => q.id), a.commissionPercent),
  })));
}

export async function creaAffiliato(params: {
  businessName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  commissionPercent?: number;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const nome = params.businessName.trim();
  if (!nome) return { ok: false, error: 'Il nome dell\'attività è obbligatorio.' };

  // Codice leggibile dal nome; se è già preso si aggiunge un numero.
  let code = codiceDaNome(nome);
  for (let i = 2; await prisma.affiliate.findUnique({ where: { code } }); i++) {
    code = `${codiceDaNome(nome)}-${i}`;
  }

  await prisma.affiliate.create({
    data: {
      code,
      businessName: nome,
      contactName: params.contactName?.trim() || null,
      phone: params.phone?.trim() || null,
      email: params.email?.trim() || null,
      commissionPercent: Math.max(0, Math.min(100, params.commissionPercent ?? 10)),
      notes: params.notes?.trim() || null,
      portalToken: nuovoPortalToken(),
      createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}

export async function aggiornaAffiliato(id: string, params: {
  businessName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  commissionPercent?: number;
  notes?: string;
  isActive?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  await prisma.affiliate.update({
    where: { id },
    data: {
      ...(params.businessName !== undefined ? { businessName: params.businessName.trim() } : {}),
      ...(params.contactName !== undefined ? { contactName: params.contactName.trim() || null } : {}),
      ...(params.phone !== undefined ? { phone: params.phone.trim() || null } : {}),
      ...(params.email !== undefined ? { email: params.email.trim() || null } : {}),
      ...(params.commissionPercent !== undefined ? { commissionPercent: Math.max(0, Math.min(100, params.commissionPercent)) } : {}),
      ...(params.notes !== undefined ? { notes: params.notes.trim() || null } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    },
  });
  return { ok: true };
}

// ------------------------------------------------------------
// QR code
// ------------------------------------------------------------

export interface QrRiga {
  id: string;
  slug: string;
  affiliateId: string;
  affiliato: string;
  name: string;
  channel: string | null;
  treatment: string;
  message: string | null;
  conditions: string | null;
  status: string;       // stato salvato
  statoEffettivo: string; // con scadenza/limite calcolati
  expiresAt: string | null;
  maxUses: number | null;
  replacesId: string | null;
  createdAt: string;
  url: string;
  stats: AffStats;
}

export async function listaQr(): Promise<QrRiga[]> {
  const qrs = await prisma.affiliateQr.findMany({
    orderBy: { createdAt: 'desc' },
    include: { affiliate: { select: { businessName: true, commissionPercent: true } } },
  });
  const origin = publicOrigin();
  return Promise.all(qrs.map(async qr => ({
    id: qr.id,
    slug: qr.slug,
    affiliateId: qr.affiliateId,
    affiliato: qr.affiliate.businessName,
    name: qr.name,
    channel: qr.channel,
    treatment: qr.treatment,
    message: qr.message,
    conditions: qr.conditions,
    status: qr.status,
    statoEffettivo: await statoEffettivo(qr),
    expiresAt: qr.expiresAt,
    maxUses: qr.maxUses,
    replacesId: qr.replacesId,
    createdAt: qr.createdAt,
    url: `${origin}/q/${qr.slug}`,
    stats: await statsPerQrIds([qr.id], qr.affiliate.commissionPercent),
  })));
}

export async function creaQr(params: {
  affiliateId: string;
  name: string;
  channel?: string;
  treatment: string;
  message?: string;
  conditions?: string;
  expiresAt?: string;
  maxUses?: number;
  bozza?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!params.affiliateId) return { ok: false, error: 'Scegli l\'affiliato.' };
  if (!params.name.trim()) return { ok: false, error: 'Dai un nome al QR (es. "Espositore banco").' };
  if (!params.treatment.trim()) return { ok: false, error: 'Indica il trattamento gratuito offerto.' };

  await prisma.affiliateQr.create({
    data: {
      slug: nuovoSlug(),
      affiliateId: params.affiliateId,
      name: params.name.trim(),
      channel: params.channel?.trim() || null,
      treatment: params.treatment.trim(),
      message: params.message?.trim() || null,
      conditions: params.conditions?.trim() || null,
      status: params.bozza ? 'draft' : 'active',
      expiresAt: params.expiresAt || null,
      maxUses: params.maxUses && params.maxUses > 0 ? Math.floor(params.maxUses) : null,
      createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}

export async function aggiornaQr(id: string, params: {
  name?: string;
  channel?: string;
  treatment?: string;
  message?: string;
  conditions?: string;
  expiresAt?: string | null;
  maxUses?: number | null;
}): Promise<{ ok: boolean }> {
  await prisma.affiliateQr.update({
    where: { id },
    data: {
      ...(params.name !== undefined ? { name: params.name.trim() } : {}),
      ...(params.channel !== undefined ? { channel: params.channel.trim() || null } : {}),
      ...(params.treatment !== undefined ? { treatment: params.treatment.trim() } : {}),
      ...(params.message !== undefined ? { message: params.message.trim() || null } : {}),
      ...(params.conditions !== undefined ? { conditions: params.conditions.trim() || null } : {}),
      ...(params.expiresAt !== undefined ? { expiresAt: params.expiresAt || null } : {}),
      ...(params.maxUses !== undefined ? { maxUses: params.maxUses && params.maxUses > 0 ? Math.floor(params.maxUses) : null } : {}),
    },
  });
  return { ok: true };
}

/** Cambia stato: attiva (anche da bozza), sospendi, disattiva, blocca per anomalia. */
export async function cambiaStatoQr(id: string, status: 'active' | 'suspended' | 'disabled' | 'blocked'): Promise<{ ok: boolean }> {
  await prisma.affiliateQr.update({ where: { id }, data: { status } });
  return { ok: true };
}

/**
 * Sostituisce un QR: ne nasce uno nuovo identico (slug nuovo) e il vecchio
 * viene disattivato. Lo storico — scansioni, registrazioni, commissioni —
 * resta tutto sul vecchio, che continua a contare nelle statistiche.
 */
export async function sostituisciQr(id: string): Promise<{ ok: boolean; error?: string }> {
  const vecchio = await prisma.affiliateQr.findUnique({ where: { id } });
  if (!vecchio) return { ok: false, error: 'QR non trovato.' };

  await prisma.$transaction([
    prisma.affiliateQr.create({
      data: {
        slug: nuovoSlug(),
        affiliateId: vecchio.affiliateId,
        name: vecchio.name,
        channel: vecchio.channel,
        treatment: vecchio.treatment,
        message: vecchio.message,
        conditions: vecchio.conditions,
        status: 'active',
        expiresAt: vecchio.expiresAt,
        maxUses: vecchio.maxUses,
        replacesId: vecchio.id,
        createdAt: new Date().toISOString(),
      },
    }),
    prisma.affiliateQr.update({ where: { id }, data: { status: 'disabled' } }),
  ]);
  return { ok: true };
}

// ------------------------------------------------------------
// Registrazioni (lead)
// ------------------------------------------------------------

export interface LeadRiga {
  id: string;
  nome: string;
  phone: string;
  email: string | null;
  affiliato: string;
  qrNome: string;
  status: string;
  blockReason: string | null;
  voucherCode: string | null;
  voucherUsedAt: string | null;
  clientId: string | null;
  device: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

export async function listaRegistrazioni(): Promise<LeadRiga[]> {
  const leads = await prisma.affiliateLead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: {
      affiliate: { select: { businessName: true } },
      qr: { select: { name: true } },
    },
  });
  return leads.map(l => ({
    id: l.id,
    nome: `${l.firstName} ${l.lastName}`.trim(),
    phone: l.phone,
    email: l.email,
    affiliato: l.affiliate.businessName,
    qrNome: l.qr.name,
    status: l.status,
    blockReason: l.blockReason,
    voucherCode: l.voucherCode,
    voucherUsedAt: l.voucherUsedAt,
    clientId: l.clientId,
    device: l.device,
    createdAt: l.createdAt,
    verifiedAt: l.verifiedAt,
  }));
}

/** L'omaggio è stato consumato in negozio: si spunta a mano al banco. */
export async function segnaOmaggioUsato(leadId: string, usato: boolean): Promise<{ ok: boolean }> {
  await prisma.affiliateLead.update({
    where: { id: leadId },
    data: { voucherUsedAt: usato ? new Date().toISOString() : null },
  });
  return { ok: true };
}

/**
 * Verifica manuale di una registrazione rimasta in sospeso (OTP mai arrivato,
 * telefono senza WhatsApp...). Fa le stesse cose della verifica con codice:
 * cliente in anagrafica legato all'affiliato + voucher.
 */
export async function verificaManualmente(leadId: string): Promise<{ ok: boolean; error?: string }> {
  const lead = await prisma.affiliateLead.findUnique({
    where: { id: leadId },
    include: { affiliate: { select: { businessName: true } } },
  });
  if (!lead) return { ok: false, error: 'Registrazione non trovata.' };
  if (lead.status === 'verified') return { ok: true };
  if (lead.status !== 'otp') return { ok: false, error: 'Questa registrazione è bloccata dall\'antifrode.' };

  const adesso = new Date().toISOString();
  const cliente = await prisma.client.create({
    data: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      email: lead.email,
      gdprConsent: true,
      marketingConsent: false,
      referredBy: `Affiliato: ${lead.affiliate.businessName}`,
      tags: ['affiliazione'],
      createdAt: adesso.split('T')[0],
    },
  });
  await prisma.affiliateLead.update({
    where: { id: leadId },
    data: { status: 'verified', verifiedAt: adesso, otpCode: null, voucherCode: nuovoVoucher(), clientId: cliente.id },
  });
  return { ok: true };
}

