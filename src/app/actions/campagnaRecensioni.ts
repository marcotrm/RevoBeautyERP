'use server';

/**
 * La campagna che chiede le recensioni su Google.
 *
 * Il pezzo che mancava: il template `richiesta_recensione` era approvato e il
 * link col rimando funzionante, ma non c'era niente che decidesse A CHI
 * mandarlo. Qui si pesca chi è venuto davvero negli ultimi giorni, si manda il
 * messaggio col bottone, e si tiene il conto di chi l'ha già ricevuto perché
 * non gli arrivi due volte.
 *
 * Il giro completo: messaggio → bottone → /r/recensione (che conta l'apertura)
 * → modulo di Google. Le tre cifre — chieste, aperture, recensioni — dicono
 * dove si perde la gente.
 */

import { prisma } from '@/lib/prisma';
import { sendD360Template, listD360Templates } from '@/lib/whatsapp360';
import { normalizePhone, isSendablePhone, waProvider } from '@/lib/whatsapp';
import { logOutbound } from '@/lib/wa-conversations';
import { sanitizeParam, WA_TEMPLATES } from '@/lib/wa-templates';
import { isInterno } from '@/lib/clientiInterni';
import { idClientiSegnalati } from '@/lib/segnalate';
import { todayRome } from '@/lib/date';
import { leggiStato } from '@/lib/recensioni';
import { scegliRecensione } from '@/lib/sceltaRecensione';
import { getWaAutomationsConfig } from '@/lib/wa-automations';
import {
  GIORNI_FINESTRA, GIORNI_RICHIESTA, costoStimato, giorniTra, rigaRichiesta, sipuoChiedere,
  type CandidataRecensione,
} from '@/lib/campagnaRecensioni';

const KIND = 'wa_recensione';

function dataIndietro(giorni: number): string {
  const d = new Date(`${todayRome()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - giorni);
  return d.toISOString().slice(0, 10);
}

/** Il nome del trattamento da mettere nel messaggio, senza la lista intera. */
function trattamentoDi(a: { treatmentName?: string | null; services?: unknown }): string {
  const dai = Array.isArray(a.services)
    ? (a.services as { treatmentName?: string }[]).map(s => s?.treatmentName).filter(Boolean) as string[]
    : [];
  const nome = (a.treatmentName || dai[0] || '').trim();
  if (!nome) return 'il trattamento';
  // "Semipermanente + Pedicure + Ceretta" in un messaggio è illeggibile: si
  // nomina il primo, che è quello per cui la cliente era venuta.
  return nome.split('+')[0].trim() || nome;
}

/** A chi possiamo chiedere la recensione adesso, dalla più fresca. */
export async function candidateRecensioni(giorni: number = GIORNI_FINESTRA): Promise<{
  candidate: CandidataRecensione[];
  /** Chi è passato ma è stato scartato, con il motivo: serve a non dover indovinare. */
  scartati: { nome: string; motivo: string }[];
  finestra: number;
}> {
  const da = dataIndietro(giorni);
  const oggi = todayRome();

  const visite = await prisma.appointment.findMany({
    where: { status: 'completed', date: { gte: da, lte: oggi } },
    select: { clientId: true, clientName: true, date: true, startTime: true, treatmentName: true, services: true },
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
  });

  // Una cliente può essere venuta tre volte in due settimane: conta l'ultima.
  const ultima = new Map<string, (typeof visite)[number]>();
  // Il passaggio veloce senza scheda ha clientId vuoto: non c'è nessuno a cui scrivere.
  for (const v of visite) if (v.clientId && !ultima.has(v.clientId)) ultima.set(v.clientId, v);
  if (ultima.size === 0) return { candidate: [], scartati: [], finestra: giorni };

  const ids = [...ultima.keys()];
  const [clienti, righe, segnalate, tpl, cfg] = await Promise.all([
    prisma.client.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, phone: true, tags: true, marketingConsent: true },
    }),
    prisma.adminEntry.findMany({ where: { rowId: { in: ids.map(rigaRichiesta) } } }),
    idClientiSegnalati(),
    statoTemplateRecensione(),
    getWaAutomationsConfig(),
  ]);

  const quandoChiesto = new Map<string, string>();
  for (const r of righe) {
    const d = r.data as { clientId?: string; quando?: string } | null;
    if (d?.clientId && d.quando) quandoChiesto.set(d.clientId, d.quando);
  }

  const candidate: CandidataRecensione[] = [];
  const scartati: { nome: string; motivo: string }[] = [];

  for (const c of clienti) {
    const v = ultima.get(c.id)!;
    const nome = `${c.firstName} ${c.lastName}`.trim();

    if (isInterno(c)) continue; // schede di casa: non si contano nemmeno fra gli scarti
    // Alle segnalate non si chiede: sarebbe andare a cercarsi la stella storta.
    if (segnalate.has(c.id)) { scartati.push({ nome, motivo: 'segnalata: non le chiediamo la recensione' }); continue; }
    // Meta ha classificato promozionale il messaggio: vale il consenso marketing,
    // salvo quando il centro ha acceso "manda a tutte" nelle Automazioni.
    if (tpl.promozionale && !cfg.recensioneSenzaConsenso && !c.marketingConsent) {
      scartati.push({ nome, motivo: 'senza consenso marketing (il messaggio è promozionale)' });
      continue;
    }
    if (!isSendablePhone(c.phone)) { scartati.push({ nome, motivo: 'numero non valido' }); continue; }
    const gia = quandoChiesto.get(c.id);
    if (!sipuoChiedere(oggi, gia)) {
      const giorni = giorniTra(gia!.slice(0, 10), oggi);
      scartati.push({ nome, motivo: `già chiesta ${giorni} giorni fa` });
      continue;
    }

    candidate.push({
      clientId: c.id,
      nome,
      primoNome: (c.firstName || nome).trim(),
      phone: normalizePhone(c.phone),
      trattamento: trattamentoDi(v),
      quando: v.date,
      giorniFa: giorniTra(v.date, oggi),
    });
  }

  candidate.sort((a, b) => a.giorniFa - b.giorniFa || a.nome.localeCompare(b.nome));
  return { candidate, scartati, finestra: giorni };
}

export interface StatoTemplateRecensione {
  /** Il template che partirebbe adesso, se ce n'è uno approvato. */
  nome?: string;
  stato?: string;
  /** Vero se quello che parte ha davvero il bottone col link. */
  conLink: boolean;
  /** Il nome della versione col bottone, approvata o no. */
  nomeConLink: string;
  /** Stato della versione col bottone: 'assente' se non è mai stata creata. */
  statoConLink: string;
  /** Perché non si può mandare, quando non si può. */
  problema?: string;
  /**
   * Vero se Meta ha classificato promozionale il messaggio che parte.
   *
   * Non è un dettaglio burocratico: un promozionale va solo a chi ha dato il
   * consenso marketing, e costa la tariffa marketing invece di quella di
   * servizio.
   */
  promozionale?: boolean;
}

/**
 * Quale messaggio parte davvero, e se ha il link dentro.
 *
 * Serve perché il primo template (`richiesta_recensione`) è stato approvato
 * senza bottone: chiede la recensione e non dice dove lasciarla. Da qui il
 * gestionale sa se sta per mandare un messaggio monco, e può dirlo prima di
 * spendere i soldi dell'invio.
 */
export async function statoTemplateRecensione(): Promise<StatoTemplateRecensione> {
  const conBottone = WA_TEMPLATES.reviewV2;
  const vecchio = WA_TEMPLATES.review;
  const base: StatoTemplateRecensione = {
    conLink: false, nomeConLink: conBottone.name, statoConLink: 'assente',
  };

  const remote = await listD360Templates();
  // Non poter leggere l'elenco è un'altra cosa dal non avere il template: se
  // qui dicessimo "non c'è nessun messaggio" si andrebbe a crearne uno doppio.
  if (!remote.ok) return { ...base, problema: `Non riesco a leggere i messaggi approvati su WhatsApp: ${remote.error}` };

  const v2 = remote.templates.find(t => t.name === conBottone.name && t.language.toLowerCase().startsWith('it'));
  if (v2) base.statoConLink = v2.status;

  // Stessa identica scelta che fa l'automazione (src/lib/sceltaRecensione.ts):
  // se qui si dicesse una cosa e partisse l'altra, non ci si fiderebbe più.
  const scelta = scegliRecensione(remote.templates, [vecchio.name, conBottone.name]);
  const stato = scelta.nome
    ? remote.templates.find(t => t.name === scelta.nome)?.status
    : undefined;

  return {
    ...base,
    nome: scelta.nome,
    stato,
    conLink: scelta.conLink,
    promozionale: scelta.promozionale,
    problema: scelta.problema,
  };
}

export interface EsitoRecensioni {
  inviate: number;
  fallite: number;
  errori: string[];
  costo: number;
}

/**
 * Manda la richiesta alle clienti scelte.
 *
 * Il template è UTILITY (parla della visita che la cliente ha appena fatto),
 * quindi non serve il consenso marketing. Serve invece che sia approvato: se
 * Meta lo rifiuta o non è ancora passato, l'invio fallisce e l'errore arriva
 * qui, non nel vuoto.
 */
export async function mandaRichiesteRecensione(clientIds: string[]): Promise<EsitoRecensioni> {
  const esito: EsitoRecensioni = { inviate: 0, fallite: 0, errori: [], costo: 0 };
  if (!waProvider()) { esito.errori.push('WhatsApp non configurato'); return esito; }
  if (clientIds.length === 0) return esito;

  // Quale messaggio parte: quello col bottone se approvato, altrimenti il
  // vecchio. Se non c'è niente di approvato non si manda: spendere per un
  // messaggio che Meta rifiuta è solo un errore silenzioso in più.
  const tpl = await statoTemplateRecensione();
  if (!tpl.nome) {
    esito.errori.push(tpl.problema || 'Nessun template approvato');
    return esito;
  }

  const { candidate } = await candidateRecensioni(365);
  const perId = new Map(candidate.map(c => [c.clientId, c]));
  const adesso = new Date().toISOString();

  for (const id of clientIds) {
    const c = perId.get(id);
    if (!c) { esito.fallite++; continue; }

    const res = await sendD360Template(c.phone, tpl.nome, {
      language: 'it',
      bodyParams: [sanitizeParam(c.primoNome), sanitizeParam(c.trattamento)],
    });

    await logOutbound({
      phone: c.phone,
      text: `Richiesta recensione a ${c.nome} (${c.trattamento})`,
      source: 'automation',
      messageId: res.messageId,
      ok: res.ok,
      error: res.error,
      template: { name: tpl.nome },
    });

    // Si segna solo quando parte davvero: un errore non deve bruciare la
    // cliente per sei mesi.
    if (res.ok) {
      await prisma.adminEntry.upsert({
        where: { rowId: rigaRichiesta(c.clientId) },
        update: { data: { clientId: c.clientId, nome: c.nome, quando: adesso, trattamento: c.trattamento } },
        create: {
          rowId: rigaRichiesta(c.clientId), kind: KIND, entityId: c.clientId,
          data: { clientId: c.clientId, nome: c.nome, quando: adesso, trattamento: c.trattamento },
          createdAt: adesso,
        },
      });
      esito.inviate++;
    } else {
      esito.fallite++;
      if (res.error && !esito.errori.includes(res.error)) esito.errori.push(res.error);
    }
  }

  esito.costo = costoStimato(esito.inviate);
  return esito;
}

export interface StatoCampagnaRecensioni {
  /** Quante richieste sono partite in tutto. */
  chieste: number;
  /** Quante negli ultimi 30 giorni. */
  chiesteMese: number;
  /** Quante volte è stato aperto il modulo di Google dal nostro link. */
  aperture: number;
  /** Recensioni su Google adesso, e media, dalla scheda collegata. */
  recensioni: number;
  media: number;
  /** Quante ne avevamo prima di iniziare a chiederle, se lo sappiamo. */
  partenza?: number;
  /** Ogni quanto si può richiedere alla stessa persona. */
  giorniRichiesta: number;
}

/** I numeri del giro completo: chieste → aperture → recensioni. */
export async function statoCampagnaRecensioni(): Promise<StatoCampagnaRecensioni> {
  const [richieste, click, google] = await Promise.all([
    prisma.adminEntry.findMany({ where: { kind: KIND }, select: { data: true } }),
    prisma.adminEntry.findMany({ where: { kind: 'link_click', entityId: 'recensione' }, select: { data: true } }),
    leggiStato(),
  ]);

  const limite = dataIndietro(30);
  const chiesteMese = richieste.filter(r => {
    const q = (r.data as { quando?: string } | null)?.quando || '';
    return q.slice(0, 10) >= limite;
  }).length;

  const aperture = click.reduce((s, r) => s + Number((r.data as { clicks?: number } | null)?.clicks || 0), 0);

  return {
    chieste: richieste.length,
    chiesteMese,
    aperture,
    recensioni: google.totale,
    media: google.media,
    partenza: google.totaleAllUltimaVista || undefined,
    giorniRichiesta: GIORNI_RICHIESTA,
  };
}
