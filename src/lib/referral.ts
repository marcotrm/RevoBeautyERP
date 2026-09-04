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
  // Prima il legame esplicito (codice inserito al banco), poi il telefono.
  const invito = candidati.find(r => r.invitedClientId === nuovoClientId)
    ?? candidati.find(r => coda(r.invitedPhone) === chiave);
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

  // L'amica può aver già avuto il benvenuto al banco (codice inserito al
  // check-in): in quel caso qui non si paga due volte.
  if (!invito.invitedRewardAt) {
    await accreditaCredito({
      clientId: nuovoClientId,
      importo: config.referral.premioInvitata,
      bucket: 'referral',
      motivo: 'Benvenuta in RevoBeauty',
      sourceType: 'referral',
      sourceId: invito.id,
      validoGiorni: config.referral.validoGiorni,
    });
  }

  await prisma.referral.update({
    where: { id: invito.id },
    data: {
      status: 'converted',
      invitedClientId: nuovoClientId,
      convertedAt: adesso,
      inviterRewardAt: adesso,
      invitedRewardAt: invito.invitedRewardAt ?? adesso,
    },
  });

  return true;
}

export type EsitoCodice =
  | { ok: true; inviter: string; importo: number }
  | { ok: false; error: string };

/**
 * Il codice invito arriva al banco: la nuova cliente lo dice, l'operatrice
 * lo scrive nella sua scheda.
 *
 * Qui l'amica prende SUBITO il suo benvenuto (spendibile già alla prima
 * cassa), mentre il premio di chi l'ha invitata matura come sempre al primo
 * incasso vero — così il legame è chiuso ma nessuno fabbrica credito
 * inventando amiche che non verranno mai.
 */
export async function collegaCodiceInvito(params: {
  clientId: string;
  codice: string;
  operatore?: string;
}): Promise<EsitoCodice> {
  const code = params.codice.trim().toUpperCase();
  if (!code) return { ok: false, error: 'Scrivi il codice.' };

  const riga = await prisma.referralCode.findUnique({ where: { code } });
  if (!riga) return { ok: false, error: 'Codice non trovato: controlla le lettere (niente 0/O né 1/I).' };
  if (riga.clientId === params.clientId) {
    return { ok: false, error: 'È il codice della cliente stessa: non può invitare sé stessa.' };
  }

  const cliente = await prisma.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  if (!cliente) return { ok: false, error: 'Cliente non trovata.' };

  // Un solo invito a testa: se questa cliente è già legata a un invito
  // (per telefono o per id), non se ne apre un altro.
  const chiave = coda(cliente.phone);
  const esistenti = await prisma.referral.findMany({ where: { status: { not: 'blocked' } } });
  const gia = esistenti.find(r => r.invitedClientId === cliente.id)
    ?? esistenti.find(r => chiave.length >= 9 && coda(r.invitedPhone) === chiave);
  if (gia?.invitedRewardAt) {
    return { ok: false, error: 'Questa cliente ha già avuto il credito di benvenuto.' };
  }

  // La cliente deve essere DAVVERO nuova: se ha già pagato qualcosa in
  // passato, il benvenuto non ha senso e il codice serve solo a far credito.
  // (La cassa registra il nome, non l'id: si confronta quello.)
  const spese = await prisma.posTransaction.count({
    where: { clientName: { equals: `${cliente.firstName} ${cliente.lastName}`.trim(), mode: 'insensitive' } },
  });
  if (spese > 0 && !gia) {
    return { ok: false, error: 'Questa cliente ha già acquistato in passato: il codice vale solo per le nuove.' };
  }

  // Il codice scritto deve appartenere a chi risulta invitante, se il legame
  // esisteva già da app: due invitanti per la stessa amica non stanno in piedi.
  if (gia && gia.inviterClientId !== riga.clientId) {
    return { ok: false, error: 'Questa cliente risulta già invitata da un\'altra persona.' };
  }

  const config = await leggiConfig();
  const adesso = new Date().toISOString();
  const nome = `${cliente.firstName} ${cliente.lastName}`.trim();

  // Lega (o crea) l'invito e paga il benvenuto adesso.
  const invito = gia
    ? await prisma.referral.update({
        where: { id: gia.id },
        data: { invitedClientId: cliente.id, status: gia.status === 'invited' ? 'registered' : gia.status, invitedName: gia.invitedName || nome },
      })
    : await prisma.referral.create({
        data: {
          inviterClientId: riga.clientId,
          invitedName: nome,
          invitedPhone: cliente.phone || '',
          invitedClientId: cliente.id,
          status: 'registered',
          createdAt: adesso,
        },
      });

  await accreditaCredito({
    clientId: cliente.id,
    importo: config.referral.premioInvitata,
    bucket: 'referral',
    motivo: 'Benvenuta in RevoBeauty',
    sourceType: 'referral',
    sourceId: invito.id,
    validoGiorni: config.referral.validoGiorni,
  });
  await prisma.referral.update({ where: { id: invito.id }, data: { invitedRewardAt: adesso } });

  const invitante = await prisma.client.findUnique({
    where: { id: riga.clientId },
    select: { firstName: true, lastName: true },
  });
  return {
    ok: true,
    inviter: `${invitante?.firstName ?? ''} ${invitante?.lastName ?? ''}`.trim() || 'una cliente',
    importo: config.referral.premioInvitata,
  };
}
