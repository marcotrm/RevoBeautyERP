/**
 * "Porta un'amica": codice personale, invito e premio.
 *
 * La regola che decide se la cosa funziona o diventa una macchina per creare
 * account finti è **quando matura il premio**. Qui matura solo quando l'amica
 * è diventata cliente pagante — non alla registrazione. Chi invita vede subito
 * l'invito partito, ma il credito arriva quando l'amica ha speso davvero.
 *
 * I controlli sono gli stessi che il gestionale già applica agli affiliati,
 * perché i modi di imbrogliare sono sempre quelli: invitare sé stessi,
 * invitare chi è già cliente, invitare lo stesso numero due volte.
 */

import { prisma } from './prisma';
import { leggiConfig } from './appSettings';
import { accreditaCredito } from './wallet';
import { normalizePhone } from './whatsapp';
import { appUrl } from './links';

/** Le ultime 9 cifre: riconosce lo stesso numero scritto in modi diversi. */
const coda = (p: string | null | undefined) => (p || '').replace(/\D/g, '').slice(-9);

/**
 * Codice leggibile: niente 0/O e 1/I, che al telefono si confondono sempre.
 * Nasce dal nome così la cliente lo riconosce come suo.
 */
function generaCodice(nome: string, cognome: string): string {
  const base = `${nome}${cognome}`.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'REVO';
  const alfabeto = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let coda4 = '';
  for (let i = 0; i < 4; i++) coda4 += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return `${base}-${coda4}`;
}

/** Il codice della cliente; se non ce l'ha, glielo si crea adesso. */
export async function codiceCliente(clientId: string): Promise<string> {
  const esistente = await prisma.referralCode.findUnique({ where: { clientId } });
  if (esistente) return esistente.code;

  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true } });

  // In caso di collisione si riprova: con 32^4 combinazioni capita di rado,
  // ma "di rado" su mille clienti significa comunque una volta.
  for (let tentativo = 0; tentativo < 6; tentativo++) {
    const code = generaCodice(c?.firstName ?? '', c?.lastName ?? '');
    try {
      await prisma.referralCode.create({ data: { clientId, code, createdAt: new Date().toISOString() } });
      return code;
    } catch {
      continue;
    }
  }
  throw new Error('Non è stato possibile generare il codice invito');
}

export interface RiepilogoReferral {
  codice: string;
  link: string;
  testoDaCondividere: string;
  invitate: number;
  registrate: number;
  diventateClienti: number;
  creditoGuadagnato: number;
  premioInvitante: number;
  premioInvitata: number;
  righe: { nome: string | null; telefono: string; stato: string; quando: string }[];
}

export async function riepilogoReferral(clientId: string): Promise<RiepilogoReferral> {
  const [codice, config, righe, movimenti] = await Promise.all([
    codiceCliente(clientId),
    leggiConfig(),
    prisma.referral.findMany({ where: { inviterClientId: clientId }, orderBy: { createdAt: 'desc' } }),
    prisma.loyaltyMovement.findMany({
      where: { clientId, kind: 'credit', sourceType: 'referral', amount: { gt: 0 } },
      select: { amount: true },
    }),
  ]);

  const link = `${appUrl()}/invito/${codice}`;

  return {
    codice,
    link,
    testoDaCondividere:
      `Vieni con me da RevoBeauty! Usa il mio codice ${codice} quando prenoti: ` +
      `${config.referral.premioInvitata} € di benvenuto per te. ${link}`,
    invitate: righe.length,
    registrate: righe.filter(r => r.status === 'registered' || r.status === 'converted').length,
    diventateClienti: righe.filter(r => r.status === 'converted').length,
    creditoGuadagnato: Math.round(movimenti.reduce((s, m) => s + m.amount, 0) * 100) / 100,
    premioInvitante: config.referral.premioInvitante,
    premioInvitata: config.referral.premioInvitata,
    righe: righe.map(r => ({
      // Il numero non si mostra per intero nemmeno a chi ha invitato: basta
      // riconoscerlo, non serve rivelarlo.
      nome: r.invitedName,
      telefono: r.invitedPhone.slice(0, -4).replace(/\d/g, '•') + r.invitedPhone.slice(-4),
      stato: r.status,
      quando: r.createdAt,
    })),
  };
}

export type EsitoInvito =
  | { ok: true; id: string }
  | { ok: false; code: 'VALIDATION' | 'DUPLICATO' | 'GIA_CLIENTE' | 'SE_STESSA' | 'LIMITE'; error: string };

/** Registra un invito. Il premio non si tocca: matura solo alla conversione. */
export async function registraInvito(params: {
  inviterClientId: string;
  nome?: string;
  telefono: string;
}): Promise<EsitoInvito> {
  const config = await leggiConfig();
  const phone = normalizePhone(params.telefono);
  const chiave = coda(phone);
  if (chiave.length < 9) {
    return { ok: false, code: 'VALIDATION', error: 'Numero non valido.' };
  }

  const invitante = await prisma.client.findUnique({
    where: { id: params.inviterClientId },
    select: { phone: true },
  });
  if (invitante && coda(invitante.phone) === chiave) {
    return { ok: false, code: 'SE_STESSA', error: 'Non puoi invitare te stessa.' };
  }

  const quanti = await prisma.referral.count({ where: { inviterClientId: params.inviterClientId } });
  if (quanti >= config.referral.maxInviti) {
    return { ok: false, code: 'LIMITE', error: `Hai raggiunto il massimo di ${config.referral.maxInviti} inviti.` };
  }

  const clienti = await prisma.client.findMany({ select: { phone: true } });
  if (clienti.some(c => coda(c.phone) === chiave)) {
    return { ok: false, code: 'GIA_CLIENTE', error: 'Questo numero è già cliente del centro.' };
  }

  const gia = await prisma.referral.findMany({ where: { status: { not: 'blocked' } }, select: { invitedPhone: true } });
  if (gia.some(r => coda(r.invitedPhone) === chiave)) {
    return { ok: false, code: 'DUPLICATO', error: 'Questo numero è già stato invitato.' };
  }

  const creato = await prisma.referral.create({
    data: {
      inviterClientId: params.inviterClientId,
      invitedName: params.nome?.trim() || null,
      invitedPhone: phone,
      status: 'invited',
      createdAt: new Date().toISOString(),
    },
  });

  return { ok: true, id: creato.id };
}

/**
 * L'amica è diventata cliente pagante: si pagano i due premi.
 *
 * Da chiamare quando la nuova cliente fa il primo incasso vero. È idempotente:
 * i campi `inviterRewardAt` e `invitedRewardAt` impediscono di pagare due
 * volte anche se la funzione viene richiamata.
 */
export async function maturaReferral(nuovoClientId: string, telefonoNuovo: string): Promise<boolean> {
  const chiave = coda(telefonoNuovo);
  if (chiave.length < 9) return false;

  const candidati = await prisma.referral.findMany({
    where: { status: { in: ['invited', 'registered'] }, inviterRewardAt: null },
  });
  const invito = candidati.find(r => coda(r.invitedPhone) === chiave);
  if (!invito) return false;

  const config = await leggiConfig();
  const adesso = new Date().toISOString();

  await accreditaCredito({
    clientId: invito.inviterClientId,
    importo: config.referral.premioInvitante,
    bucket: 'referral',
    motivo: `Hai portato ${invito.invitedName || 'un\'amica'}`,
    sourceType: 'referral',
    sourceId: invito.id,
    validoGiorni: config.referral.validoGiorni,
  });

  await accreditaCredito({
    clientId: nuovoClientId,
    importo: config.referral.premioInvitata,
    bucket: 'referral',
    motivo: 'Benvenuta in RevoBeauty',
    sourceType: 'referral',
    sourceId: invito.id,
    validoGiorni: config.referral.validoGiorni,
  });

  await prisma.referral.update({
    where: { id: invito.id },
    data: {
      status: 'converted',
      invitedClientId: nuovoClientId,
      convertedAt: adesso,
      inviterRewardAt: adesso,
      invitedRewardAt: adesso,
    },
  });

  return true;
}
