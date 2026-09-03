'use server';

/**
 * Email e SMS: configurazione, invio singolo e invio a una lista.
 *
 * Il senso non e' fare concorrenza a WhatsApp — WhatsApp resta il canale del
 * centro. Il senso e' avere una seconda strada per chi su WhatsApp non
 * arriva: numero cambiato, app mai installata, messaggio mai aperto. Quella
 * cliente prima era irraggiungibile e nessuno se ne accorgeva.
 *
 * L'SMS costa: si usa per le cose che devono arrivare per forza (un
 * promemoria, una disdetta), non per le promozioni.
 */

import { prisma } from '@/lib/prisma';
import {
  CONFIG_CANALI_DEFAULT, emailHtml, mandaEmail, mandaSms,
  type ConfigCanali, type EsitoInvio,
} from '@/lib/canali';
import { leggiCentro } from '@/lib/centro';

const RIGA = 'integration:canali';

export async function configCanali(): Promise<ConfigCanali> {
  try {
    const r = await prisma.adminEntry.findUnique({ where: { rowId: RIGA } });
    return { ...CONFIG_CANALI_DEFAULT, ...((r?.data as Partial<ConfigCanali>) || {}) };
  } catch {
    return CONFIG_CANALI_DEFAULT;
  }
}

/** Quello che si puo' mostrare a schermo: le chiavi non tornano mai indietro. */
export interface StatoCanali {
  emailAttiva: boolean;
  emailMittente: string;
  emailRispostaA: string;
  chiaveEmailPresente: boolean;
  smsAttivo: boolean;
  smsMittente: string;
  skebbyUser: string;
  passwordSmsPresente: boolean;
}

export async function statoCanali(): Promise<StatoCanali> {
  const c = await configCanali();
  return {
    emailAttiva: c.emailAttiva,
    emailMittente: c.emailMittente || process.env.INAUGURAZIONE_FROM || '',
    emailRispostaA: c.emailRispostaA,
    // Vale anche la chiave gia' presente fra le variabili del server.
    chiaveEmailPresente: !!c.resendApiKey || !!process.env.RESEND_API_KEY,
    smsAttivo: c.smsAttivo,
    smsMittente: c.smsMittente,
    skebbyUser: c.skebbyUser,
    passwordSmsPresente: !!c.skebbyPassword,
  };
}

/**
 * Salva la configurazione. Le chiavi vuote non cancellano quelle salvate: chi
 * cambia il mittente non deve reincollare la chiave che non ha sottomano.
 */
export async function salvaConfigCanali(patch: Partial<ConfigCanali>): Promise<{ ok: boolean }> {
  const attuale = await configCanali();
  const nuova: ConfigCanali = {
    ...attuale,
    ...patch,
    resendApiKey: patch.resendApiKey?.trim() ? patch.resendApiKey.trim() : attuale.resendApiKey,
    skebbyPassword: patch.skebbyPassword?.trim() ? patch.skebbyPassword.trim() : attuale.skebbyPassword,
  };
  await prisma.adminEntry.upsert({
    where: { rowId: RIGA },
    update: { data: nuova as unknown as object },
    create: { rowId: RIGA, kind: 'integration', entityId: 'canali', data: nuova as unknown as object, createdAt: new Date().toISOString() },
  });
  return { ok: true };
}

/** Una email a un indirizzo, col vestito del centro. */
export async function inviaEmail(p: {
  a: string; oggetto: string; testo: string; bottone?: { testo: string; link: string };
}): Promise<EsitoInvio> {
  const cfg = await configCanali();
  const centro = await leggiCentro();
  const piede = [centro.nome, centro.indirizzo, centro.telefono].filter(Boolean).join(' · ');
  return mandaEmail(cfg, {
    a: p.a,
    oggetto: p.oggetto,
    testo: p.testo,
    html: emailHtml({ titolo: p.oggetto, testo: p.testo, bottone: p.bottone, centro: piede }),
  });
}

export async function inviaSms(p: { a: string; testo: string }): Promise<EsitoInvio> {
  const cfg = await configCanali();
  return mandaSms(cfg, p);
}

/** La prova: si manda a se stessi prima di mandarla a duecento clienti. */
export async function provaCanale(canale: 'email' | 'sms', destinatario: string): Promise<EsitoInvio> {
  if (canale === 'email') {
    return inviaEmail({
      a: destinatario,
      oggetto: 'Prova da Revobeauty',
      testo: 'Se stai leggendo questa email, il canale funziona.\nDa adesso puoi scrivere alle clienti anche per email, non solo su WhatsApp.',
    });
  }
  return inviaSms({ a: destinatario, testo: 'Prova da Revobeauty: se leggi questo, gli SMS funzionano.' });
}

export interface EsitoCampagna {
  mandati: number;
  falliti: number;
  saltati: number;
  errori: string[];
}

/**
 * Manda lo stesso messaggio a una lista di clienti.
 *
 * Chi non ha dato il consenso al marketing non riceve niente, e non si
 * discute: il messaggio commerciale senza consenso e' una multa, non una
 * campagna. I promemoria di servizio (un appuntamento, una disdetta) passano
 * da `inviaEmail`/`inviaSms` e non da qui.
 */
export async function campagna(p: {
  canale: 'email' | 'sms';
  clientIds: string[];
  oggetto?: string;
  testo: string;
  bottone?: { testo: string; link: string };
}): Promise<EsitoCampagna> {
  const cfg = await configCanali();
  const centro = await leggiCentro();
  const piede = [centro.nome, centro.indirizzo, centro.telefono].filter(Boolean).join(' · ');

  const clienti = await prisma.client.findMany({
    where: { id: { in: p.clientIds } },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, marketingConsent: true },
  });

  const esito: EsitoCampagna = { mandati: 0, falliti: 0, saltati: 0, errori: [] };

  for (const c of clienti) {
    if (!c.marketingConsent) { esito.saltati += 1; continue; }
    const testo = p.testo.replace(/\{nome\}/g, c.firstName || '');
    let r: EsitoInvio;
    if (p.canale === 'email') {
      if (!c.email) { esito.saltati += 1; continue; }
      r = await mandaEmail(cfg, {
        a: c.email,
        oggetto: p.oggetto || 'Un messaggio da RevoBeauty',
        testo,
        html: emailHtml({ titolo: p.oggetto || 'RevoBeauty', testo, bottone: p.bottone, centro: piede }),
      });
    } else {
      if (!c.phone) { esito.saltati += 1; continue; }
      r = await mandaSms(cfg, { a: c.phone, testo });
    }
    if (r.ok) esito.mandati += 1;
    else {
      esito.falliti += 1;
      if (esito.errori.length < 5) esito.errori.push(`${c.firstName} ${c.lastName}: ${r.error}`);
    }
  }

  await prisma.adminEntry.create({
    data: {
      rowId: `campagna:${p.canale}:${Date.now()}`,
      kind: 'campagna',
      entityId: p.canale,
      data: {
        canale: p.canale, oggetto: p.oggetto || '', testo: p.testo,
        mandati: esito.mandati, falliti: esito.falliti, saltati: esito.saltati,
        quando: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    },
  }).catch(() => {});

  return esito;
}

export interface CampagnaFatta {
  id: string;
  canale: string;
  oggetto: string;
  testo: string;
  mandati: number;
  falliti: number;
  saltati: number;
  quando: string;
}

/** Quelle gia' mandate: quante ne sono partite e quando. */
export async function campagneFatte(limite = 30): Promise<CampagnaFatta[]> {
  const righe = await prisma.adminEntry.findMany({
    where: { kind: 'campagna' },
    orderBy: { createdAt: 'desc' },
    take: limite,
  });
  return righe.map(r => {
    const d = (r.data || {}) as Record<string, unknown>;
    return {
      id: r.rowId,
      canale: String(d.canale || r.entityId || ''),
      oggetto: String(d.oggetto || ''),
      testo: String(d.testo || ''),
      mandati: Number(d.mandati) || 0,
      falliti: Number(d.falliti) || 0,
      saltati: Number(d.saltati) || 0,
      quando: String(d.quando || r.createdAt),
    };
  });
}

/**
 * I gruppi a cui si scrive di solito.
 *
 * Non e' un segmentatore: sono le quattro liste che una si ritrova a fare
 * davvero. Ognuna dice anche quante persone si possono davvero raggiungere su
 * quel canale, che e' sempre un numero piu' piccolo di quello che si spera.
 */
export interface Destinatario {
  id: string;
  nome: string;
  email: string | null;
  telefono: string | null;
  consenso: boolean;
  /** Da quanti giorni non viene. Null = non e' mai venuta. */
  giorniDaUltimaVisita: number | null;
}

export async function destinatariPer(gruppo: 'tutte' | 'dormienti' | 'nuove' | 'compleanno'): Promise<Destinatario[]> {
  const oggi = new Date();
  const clienti = await prisma.client.findMany({
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true,
      marketingConsent: true, lastVisit: true, birthDate: true, createdAt: true,
    },
    orderBy: [{ firstName: 'asc' }],
  });

  const giorni = (iso?: string | null) => {
    if (!iso) return null;
    const t = Date.parse(iso.length <= 10 ? `${iso}T12:00:00` : iso);
    if (Number.isNaN(t)) return null;
    return Math.floor((oggi.getTime() - t) / 86_400_000);
  };

  return clienti
    .map(c => ({
      id: c.id,
      nome: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      telefono: c.phone,
      consenso: c.marketingConsent,
      giorniDaUltimaVisita: giorni(c.lastVisit),
      _nata: c.birthDate,
      _creata: giorni(c.createdAt),
    }))
    .filter(c => {
      switch (gruppo) {
        // Chi non si vede da due mesi: e' la lista che riporta piu' gente.
        case 'dormienti': return c.giorniDaUltimaVisita !== null && c.giorniDaUltimaVisita >= 60;
        case 'nuove': return c._creata !== null && c._creata <= 60;
        case 'compleanno': {
          const m = String(c._nata || '').slice(5, 7);
          return m === String(oggi.getMonth() + 1).padStart(2, '0');
        }
        default: return true;
      }
    })
    .map(({ _nata, _creata, ...c }) => { void _nata; void _creata; return c; });
}

/** Chi si puo' raggiungere e come: serve a scegliere il canale con cognizione. */
export interface RaggiungibiliCanale {
  totale: number;
  conEmail: number;
  conTelefono: number;
  conConsenso: number;
  raggiungibiliEmail: number;
  raggiungibiliSms: number;
}

export async function raggiungibili(): Promise<RaggiungibiliCanale> {
  const clienti = await prisma.client.findMany({
    select: { email: true, phone: true, marketingConsent: true },
  });
  const conEmail = clienti.filter(c => !!c.email).length;
  const conTelefono = clienti.filter(c => !!c.phone).length;
  const conConsenso = clienti.filter(c => c.marketingConsent).length;
  return {
    totale: clienti.length,
    conEmail,
    conTelefono,
    conConsenso,
    raggiungibiliEmail: clienti.filter(c => c.marketingConsent && !!c.email).length,
    raggiungibiliSms: clienti.filter(c => c.marketingConsent && !!c.phone).length,
  };
}
