'use server';

/**
 * Il consenso laser firmato dal tablet.
 *
 * La firma su carta resta valida e nessuno butta i fogli vecchi: quello che
 * cambia e' che da oggi il modulo si compila e si firma su uno schermo, e
 * finisce dove si cerca — nella scheda della cliente, insieme alle foto e agli
 * altri consensi.
 *
 * Il link porta un gettone firmato, non l'id dell'appuntamento in chiaro: un
 * indirizzo che si indovina cambiando un numero e' un indirizzo che qualcuno
 * prima o poi cambia. Il gettone dura tre giorni, cioe' abbastanza per
 * mandarlo il giorno prima e non abbastanza per restare in giro un mese.
 */

import { prisma } from '@/lib/prisma';
import { firmaConferma, leggiConferma } from '@/lib/conferma';
import { seduraDaRadere } from '@/lib/epilazione';
import { sendManualReply } from '@/app/actions/whatsapp';
import { sendWhatsAppTemplate, normalizePhone, isSendablePhone } from '@/lib/whatsapp';
import { listD360Templates } from '@/lib/whatsapp360';
import { WA_TEMPLATES } from '@/lib/wa-templates';
import { headers } from 'next/headers';
import { descriviDispositivo } from '@/lib/dispositivo';
import { leggiDocumento, nomeTipo, type LetturaDocumento } from '@/lib/documento';
import { sessoDaNome } from '@/lib/sessoDaNome';
import { DOMANDE_STORICO } from '@/lib/consensoLaserTesto';
import { salvaDocumento } from '@/app/actions/documenti';

const TITOLO = 'Consenso Laser/Epilazione';
const GIORNI_GETTONE = 3;

/**
 * Il gettone porta sempre la cliente, l'appuntamento solo se c'e'.
 *
 * Il consenso e' della persona, non della seduta: si firma anche al banco
 * mentre si prende l'appuntamento, o la volta che si e' dimenticato di farlo
 * e la cliente e' gia' andata via. Con l'appuntamento il modulo si riempie da
 * solo — data, ora, zone; senza, si scrivono le zone a mano.
 */
interface Gettone { appointmentId?: string; clientId: string }

export interface ModuloLaser {
  ok: boolean;
  errore?: string;
  clientId?: string;
  nome?: string;
  nato?: string | null;
  quando?: string;
  zone?: string;
  operatrice?: string;
  /** Un consenso gia' firmato per questa cliente, se c'e'. */
  giaFirmato?: { quando: string; id: string } | null;
  /**
   * Il documento gia' agli atti, se la cliente lo aveva gia' portato.
   *
   * Chiederlo di nuovo a chi l'ha gia' dato e' il modo migliore per far
   * sembrare che qui dentro non ci si ricordi niente di lei: si mostra
   * quello che c'e' e si chiede solo se e' cambiato.
   */
  documento?: { tipo: string; numero: string; quando: string } | null;
  /**
   * 'M' o 'F', per quel che ne sappiamo prima che compili.
   *
   * Serve a non chiedere a un uomo se e' in stato di gravidanza. Si guarda la
   * scheda, e dove il campo e' vuoto — succede su una scheda su otto — si
   * ripiega sul nome di battesimo. Se non si capisce, resta null e la domanda
   * si fa: chiederla a chi non serve e' una figuraccia, non farla a chi serve
   * e' un problema serio.
   */
  sesso?: 'M' | 'F' | null;
}

/** Il link da aprire sul tablet o da mandare in chat. */
export async function linkConsensoLaser(appointmentId: string): Promise<{ ok: boolean; url?: string; errore?: string }> {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, clientId: true },
  });
  if (!a) return { ok: false, errore: 'Appuntamento non trovato' };
  const gettone = firmaConferma({ appointmentId: a.id, clientId: a.clientId } satisfies Gettone, GIORNI_GETTONE * 86_400_000);
  if (!gettone) return { ok: false, errore: 'Manca VOICE_API_SECRET: il link non si può firmare' };
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://erp.revobeauty.it';
  return { ok: true, url: `${base}/firma/${encodeURIComponent(gettone)}` };
}

/** Quello che la pagina della firma deve mostrare. */
export async function apriModuloLaser(gettone: string): Promise<ModuloLaser> {
  const dati = leggiConferma<Gettone>(gettone);
  if (!dati?.clientId) {
    return { ok: false, errore: 'Il link non è più valido. Chiedine uno nuovo al centro.' };
  }

  const a = dati.appointmentId
    ? await prisma.appointment.findUnique({ where: { id: dati.appointmentId }, include: { client: true } })
    : null;
  const cliente = a?.client || await prisma.client.findUnique({ where: { id: dati.clientId } });
  if (!cliente) return { ok: false, errore: 'Scheda cliente non trovata' };

  const zone = (() => {
    if (!a) return '';
    const sv = Array.isArray(a.services) ? (a.services as Array<{ treatmentName?: unknown }>) : [];
    const nomi = sv.map(s => String(s?.treatmentName || '')).filter(n => /^\s*epilazion/i.test(n));
    if (nomi.length > 0) return nomi.join(', ');
    return String(a.treatmentName || '');
  })();

  const [ultimo, doc] = await Promise.all([
    prisma.clientConsent.findFirst({
      where: { clientId: dati.clientId, title: TITOLO },
      orderBy: { signedAt: 'desc' },
      select: { id: true, signedAt: true },
    }),
    prisma.clientDocument.findFirst({
      where: { clientId: dati.clientId },
      orderBy: { createdAt: 'desc' },
      select: { tipo: true, numero: true, createdAt: true },
    }),
  ]);

  return {
    ok: true,
    clientId: dati.clientId,
    nome: `${cliente.firstName} ${cliente.lastName}`.trim(),
    nato: cliente.birthDate ?? null,
    quando: a ? `${a.date.split('-').reverse().join('/')} alle ${a.startTime}` : undefined,
    zone,
    operatrice: a?.operatorName,
    documento: doc ? { tipo: doc.tipo, numero: doc.numero, quando: doc.createdAt } : null,
    sesso: (() => {
      const inScheda = String(cliente.gender || '').trim().toUpperCase();
      if (inScheda === 'M' || inScheda === 'F') return inScheda as 'M' | 'F';
      return sessoDaNome(cliente.firstName || '');
    })(),
    giaFirmato: ultimo ? { id: ultimo.id, quando: ultimo.signedAt } : null,
  };
}

/** Lo stesso modulo, ma aperto dalla scheda della cliente e non da un appuntamento. */
export async function linkConsensoCliente(clientId: string): Promise<{ ok: boolean; url?: string; errore?: string }> {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!c) return { ok: false, errore: 'Cliente non trovata' };
  const gettone = firmaConferma({ clientId } satisfies Gettone, GIORNI_GETTONE * 86_400_000);
  if (!gettone) return { ok: false, errore: 'Manca VOICE_API_SECRET: il link non si può firmare' };
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://erp.revobeauty.it';
  return { ok: true, url: `${base}/firma/${encodeURIComponent(gettone)}` };
}

export interface RisposteLaser {
  storico: Record<string, string>;
  zone: string;
  consensoFoto: boolean;
  firma: string;
  /** Il documento fotografato adesso, quando non ce n'e' gia' uno agli atti. */
  documento?: {
    foto: string;
    anteprima?: string;
    tipo?: string;
    numero?: string;
    nome?: string;
    cognome?: string;
    dataNascita?: string;
    scadenza?: string;
    /** Dove abita: non serve al consenso, serve alla sua scheda. */
    indirizzo?: string;
    citta?: string;
    /** 'M' o 'F' letto dal documento. */
    sesso?: 'M' | 'F';
  };
}

/**
 * Quello che ha scritto lei finisce nella sua scheda.
 *
 * E' il punto di tutto il giro: la cliente ha appena dichiarato nome, data di
 * nascita, sesso e residenza, col documento fotografato a fianco. Richiederle
 * le stesse cose al banco tre giorni dopo — con la cabina che aspetta — vuol
 * dire non essersi accorti di averle gia'.
 *
 * Si riempiono SOLO le caselle vuote. Quello che c'e' gia' in anagrafica non
 * si tocca mai: puo' essere stato corretto a mano da chi la conosce, e un
 * indirizzo giusto sostituito da uno letto storto in una foto non se ne
 * accorge nessuno finche' non torna indietro una raccomandata.
 */
async function completaScheda(clientId: string, d: NonNullable<RisposteLaser['documento']>): Promise<void> {
  const c = await prisma.client.findUnique({
    where: { id: clientId },
    select: { birthDate: true, gender: true, address: true, city: true },
  });
  if (!c) return;

  const da: Record<string, string> = {};
  if (!c.birthDate && d.dataNascita) da.birthDate = d.dataNascita;
  // 'M' / 'F' come in anagrafica: e' quello che c'e' scritto su 399 schede su
  // 400, ed e' anche quello che il documento dice. Un 'male' in mezzo a 'M'
  // fa sparire una cliente da ogni filtro senza che nessuno capisca perche'.
  if (!c.gender && d.sesso) da.gender = d.sesso;
  if (!c.address?.trim() && d.indirizzo?.trim()) da.address = d.indirizzo.trim();
  if (!c.city?.trim() && d.citta?.trim()) da.city = d.citta.trim();

  if (Object.keys(da).length === 0) return;
  await prisma.client.update({ where: { id: clientId }, data: da }).catch(() => {});
}

/**
 * Legge la foto del documento appena scattata.
 *
 * Passa da qui e non dall'azione generica perche' questa pagina e' pubblica:
 * senza un gettone valido non si legge niente, altrimenti chiunque avesse
 * l'indirizzo potrebbe far leggere le sue foto al gestionale.
 */
export async function leggiDocumentoDalModulo(gettone: string, foto: string): Promise<LetturaDocumento> {
  const dati = leggiConferma<Gettone>(gettone);
  if (!dati?.clientId) return { leggibile: false, problema: 'Il link non è più valido: chiedine uno nuovo al centro.' };
  return leggiDocumento(foto);
}

/**
 * Salva il consenso. La firma e' obbligatoria: senza, quello che resta e' un
 * questionario compilato, non un consenso.
 */
export async function salvaConsensoLaser(
  gettone: string, r: RisposteLaser,
): Promise<{ ok: boolean; errore?: string }> {
  try {
    return await salvaDavvero(gettone, r);
  } catch (e) {
    /*
      Se salta qualcosa, lo si DICE.

      «Salvataggio non riuscito» e basta e' il messaggio che ha tenuto
      nascosto per settimane un errore banale: davanti a quella scritta non
      si puo' fare niente — ne' chi firma, ne' chi al banco prova a capire.
      Il motivo tecnico si scrive corto, e resta nei log del server per esteso.
    */
    const motivo = String((e as { message?: string })?.message || e).slice(0, 140);
    console.error('[consenso] salvataggio fallito:', motivo);
    return { ok: false, errore: `Non sono riuscito a salvare (${motivo}). Riprova, o fallo vedere al centro.` };
  }
}

async function salvaDavvero(
  gettone: string, r: RisposteLaser,
): Promise<{ ok: boolean; errore?: string }> {
  const dati = leggiConferma<Gettone>(gettone);
  if (!dati?.clientId) return { ok: false, errore: 'Il link non è più valido.' };
  if (!r.firma || r.firma.length < 100) return { ok: false, errore: 'Manca la firma.' };

  /*
    L'appuntamento c'e' solo se il link nasce da un appuntamento.

    Il modulo si apre anche dalla scheda della cliente e dal tablet, e in quei
    casi il gettone porta solo il clientId. Qui pero' si chiedeva comunque
    l'appuntamento, e Prisma davanti a un id `undefined` non risponde «non
    trovato»: LANCIA. Il salvataggio moriva li', e alla cliente arrivava
    «Salvataggio non riuscito» dopo aver compilato tutto e firmato.

    Da quanto? Da sempre: ogni consenso aperto dalla scheda invece che
    dall'appuntamento e' morto cosi', in silenzio, e nessuno sapeva perche'.
  */
  const a = dati.appointmentId
    ? await prisma.appointment.findUnique({
      where: { id: dati.appointmentId },
      select: { id: true, date: true, startTime: true, operatorName: true, treatmentName: true, services: true },
    })
    : null;

  const dispositivo = descriviDispositivo((await headers()).get('user-agent'));

  const consenso = await prisma.clientConsent.create({
    data: {
      clientId: dati.clientId,
      title: TITOLO,
      signatureData: r.firma,
      signedAt: new Date().toISOString(),
      /*
        Da dove ha firmato, davvero.

        Prima c'era scritto "dal tablet" su ogni consenso, anche quando il
        link glielo si era mandato su WhatsApp e lei aveva firmato dal
        divano col suo telefono. Una riga che dice una cosa non vera su un
        documento firmato e' peggio di una riga che non dice niente.
      */
      notes: `Firmato da ${dispositivo || 'dispositivo sconosciuto'} · zone: ${r.zone || '—'}`,
      data: JSON.parse(JSON.stringify({
        appointmentId: dati.appointmentId,
        seduta: a ? `${a.date} ${a.startTime}` : null,
        operatrice: a?.operatorName ?? null,
        eraLaser: a ? seduraDaRadere(a) : null,
        zone: r.zone,
        storico: r.storico,
        consensoFoto: r.consensoFoto,
        versioneTesto: '2026-09-01',
        documento: r.documento
          ? { tipo: r.documento.tipo || 'altro', numero: r.documento.numero || '' }
          : null,
      })),
    },
  });

  /*
    Il documento resta allegato alla compilazione.

    Non e' una copia in piu' della foto: e' la prova di dove esce il numero
    scritto sul consenso. Chi lo riapre fra un anno vede il tesserino e non
    deve fidarsi di una trascrizione fatta di corsa.
  */
  /*
    Basta il numero, la foto e' un di piu'.

    Prima ci volevano tutte e due, e chi non riusciva a far aprire la foto al
    telefono restava senza documento in archivio anche dopo averlo scritto a
    mano: il consenso c'era, il documento no, e a fine giro non tornava niente.
  */
  /*
    La scheda si completa anche senza numero di documento.

    Se la foto non si e' letta ma lei ha scritto data di nascita e indirizzo a
    mano, quei dati valgono uguale: sono suoi e li ha dichiarati firmando.
  */
  if (r.documento) await completaScheda(dati.clientId, r.documento).catch(() => {});

  if (r.documento?.numero) {
    await salvaDocumento({
      clientId: dati.clientId,
      tipo: r.documento.tipo,
      numero: r.documento.numero,
      nome: r.documento.nome,
      cognome: r.documento.cognome,
      dataNascita: r.documento.dataNascita,
      scadenza: r.documento.scadenza,
      foto: r.documento.foto,
      anteprima: r.documento.anteprima,
      consensoId: consenso.id,
      origine: 'cliente',
    }).catch(() => {});
  }

  return { ok: true };
}

/** Il consenso piu' recente di una cliente: serve al banco per sapere se c'e'. */
export interface ConsensoTrovato {
  quando: string;
  zone?: string;
  /**
   * Quello che ha dichiarato, gia' pronto da leggere al banco.
   *
   * Il consenso firmato non e' solo una spunta amministrativa: dentro c'e' se
   * prende farmaci, se ha avuto herpes, se e' stata al sole la settimana
   * scorsa. Sono le cose che possono far rimandare la seduta, e finivano nel
   * database senza che nessuno le rileggesse prima di accendere la macchina.
   */
  risposte: { testo: string; valore: string; attenzione: boolean; chiesta: boolean }[];
  /** Ha acconsentito alle foto prima/dopo. */
  consensoFoto?: boolean;
  /*
    Chi e' e dove abita, come l'ha scritto lei.

    Al banco serve per riconoscerla e per non richiederle dati che ha gia'
    dato: sono le stesse righe che finiscono nella sua scheda, mostrate qui
    perche' aprire la scheda vuol dire uscire dal check-in e perdere il filo.
  */
  anagrafica?: {
    nome?: string;
    cognome?: string;
    dataNascita?: string;
    documento?: string;
    indirizzo?: string;
    citta?: string;
  };
}

export async function consensoLaserDi(clientId: string): Promise<ConsensoTrovato | null> {
  if (!clientId) return null;
  const c = await prisma.clientConsent.findFirst({
    where: { clientId, title: TITOLO },
    orderBy: { signedAt: 'desc' },
    select: { signedAt: true, data: true },
  });
  if (!c) return null;
  const d = (c.data || {}) as { zone?: string; storico?: Record<string, string> };
  const storico = d.storico || {};

  /*
    Cosa merita un'occhiata prima di cominciare.

    Un «si' » a cura ormonale, farmaci o herpes va guardato; una risposta
    libera — l'ultima esposizione al sole, da quanto non si depila — va letta
    e basta, perche' il giudizio spetta a chi ha la macchina in mano.
  */
  const daGuardare = new Set(['ormonale', 'farmaci', 'herpes']);
  /*
    TUTTE le domande, anche quelle a cui ha risposto no.

    Prima si tenevano solo i «si'»: piu' corto, ma al banco non si capiva se
    una domanda mancava perche' la risposta era no o perche' non gliel'avevamo
    fatta. E il «no» non e' rumore — «no, non prendo farmaci» e' esattamente
    quello che l'operatrice deve poter dire di aver letto prima di accendere
    la macchina.
  */
  const risposte = DOMANDE_STORICO
    .map(q => {
      const v = String(storico[q.id] ?? '').trim();
      const dettaglio = String(storico[`${q.id}_dettaglio`] ?? '').trim();
      /*
        Una domanda senza risposta non e' un buco: quasi sempre non gliel'ha
        vista proprio. La gravidanza, per dirne una, a un uomo non si chiede —
        e scriverlo e' piu' onesto che far sparire la riga, perche' chi legge
        sa cosa e' stato chiesto e cosa no.
      */
      const valore = !v ? 'non chiesta' : q.tipo === 'sino' ? (v === 'si' ? 'sì' : 'no') : v;
      return {
        testo: q.testo,
        valore: dettaglio ? `${valore} — ${dettaglio}` : valore,
        attenzione: daGuardare.has(q.id) && v === 'si',
        chiesta: Boolean(v),
      };
    });

  /*
    Il documento agli atti da' nome, nascita e residenza: sono gli stessi dati
    che la cliente ha compilato firmando, e averli qui evita di aprire la
    scheda in mezzo al check-in.
  */
  const doc = await prisma.clientDocument.findFirst({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    select: { tipo: true, numero: true, nome: true, cognome: true, dataNascita: true },
  });
  const cl = await prisma.client.findUnique({
    where: { id: clientId },
    select: { firstName: true, lastName: true, birthDate: true, address: true, city: true },
  });

  return {
    quando: c.signedAt,
    zone: d.zone,
    risposte,
    consensoFoto: Boolean((d as { consensoFoto?: boolean }).consensoFoto),
    anagrafica: {
      nome: doc?.nome || cl?.firstName,
      cognome: doc?.cognome || cl?.lastName,
      dataNascita: doc?.dataNascita || cl?.birthDate || undefined,
      documento: doc ? `${nomeTipo(doc.tipo)} ${doc.numero}`.trim() : undefined,
      indirizzo: cl?.address || undefined,
      citta: cl?.city || undefined,
    },
  };
}

// ============================================================
// La conferma al banco: "il foglio l'ha firmato".
//
// Resta accanto al modulo digitale e non ci si sovrappone. Il modulo e' la
// firma vera, questa e' la spunta di chi al check-in dice che la carta e'
// in archivio — serve finche' esistono fogli firmati prima di oggi, e per
// quella cliente che il tablet non lo vuole toccare.
// ============================================================

const KIND = 'consenso_laser';
const rowId = (clientId: string) => `${KIND}:${clientId}`;

export interface FirmaLaser {
  /** Quando e' stata confermata la firma (ISO). */
  data: string;
  /** Chi era al banco. */
  operatore?: string;
  appointmentId?: string;
}

/** L'ultima conferma registrata per quella cliente, o null se non ce n'e' mai state. */
export async function ultimoConsensoLaser(clientId: string): Promise<FirmaLaser | null> {
  if (!clientId) return null;
  try {
    const row = await prisma.adminEntry.findUnique({ where: { rowId: rowId(clientId) } });
    const firme = (row?.data as { firme?: FirmaLaser[] } | null)?.firme;
    if (!Array.isArray(firme) || firme.length === 0) return null;
    return firme[firme.length - 1];
  } catch {
    return null;
  }
}

/**
 * Segna che il consenso e' stato firmato/verificato adesso.
 *
 * Non blocca niente se fallisce: il check-in di una cliente che sta entrando
 * non puo' dipendere da una riga di registro.
 */
export async function registraConsensoLaser(
  clientId: string,
  info: { operatore?: string; appointmentId?: string } = {},
): Promise<void> {
  if (!clientId) return;
  const firma: FirmaLaser = {
    data: new Date().toISOString(),
    operatore: info.operatore || undefined,
    appointmentId: info.appointmentId || undefined,
  };
  try {
    const row = await prisma.adminEntry.findUnique({ where: { rowId: rowId(clientId) } });
    const precedenti = (row?.data as { firme?: FirmaLaser[] } | null)?.firme;
    // Le ultime venti bastano: e' un registro, non un archivio.
    const firme = [...(Array.isArray(precedenti) ? precedenti : []), firma].slice(-20);
    await prisma.adminEntry.upsert({
      where: { rowId: rowId(clientId) },
      create: {
        rowId: rowId(clientId), kind: KIND, entityId: clientId,
        data: JSON.parse(JSON.stringify({ firme })),
        createdAt: new Date().toISOString(),
      },
      update: { data: JSON.parse(JSON.stringify({ firme })) },
    });
  } catch (e) {
    console.error('[consenso laser] non registrato:', e);
  }
}

/**
 * Manda il link del modulo alla cliente su WhatsApp.
 *
 * Due strade, e si prova prima quella gratis. Dentro le 24 ore dall'ultimo
 * messaggio della cliente si scrive a testo libero, col link per esteso: si
 * legge meglio di un bottone e non costa niente. Fuori da quella finestra —
 * che e' il caso normale, la sera prima — comanda Meta e serve il template
 * approvato, col gettone attaccato in coda al bottone.
 */
export async function mandaLinkConsenso(appointmentId: string): Promise<{ ok: boolean; errore?: string }> {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { client: true },
  });
  if (!a) return { ok: false, errore: 'Appuntamento non trovato' };
  const telefono = a.client?.phone;
  if (!isSendablePhone(telefono)) return { ok: false, errore: 'La cliente non ha un numero valido in scheda' };

  const gettone = firmaConferma({ appointmentId: a.id, clientId: a.clientId } satisfies Gettone, GIORNI_GETTONE * 86_400_000);
  if (!gettone) return { ok: false, errore: 'Manca VOICE_API_SECRET: il link non si può firmare' };
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://erp.revobeauty.it';
  const url = `${base}/firma/${encodeURIComponent(gettone)}`;

  const nome = a.client?.firstName || '';
  const quando = `${a.date.split('-').reverse().join('/')} alle ${a.startTime}`;
  const testo = [
    `Ciao ${nome}!`.trim(),
    `Per la seduta laser di ${quando} serve il consenso informato: lo leggi e lo firmi da qui, sono due minuti.`,
    url,
    'Se preferisci lo firmi in centro sul tablet, come vuoi tu.',
  ].join('\n');

  const libero = await sendManualReply(telefono as string, testo);
  if (libero.ok) return { ok: true };

  /** Com'e' messo su Meta il template del consenso: ASSENTE finche' non lo si crea. */
  const stato = await (async () => {
    const e = await listD360Templates().catch(() => null);
    if (!e?.ok) return 'ASSENTE';
    return e.templates.find(t => t.name === WA_TEMPLATES.consensoLaser.name)?.status || 'ASSENTE';
  })();
  if (stato !== 'APPROVED') {
    return {
      ok: false,
      errore: stato === 'ASSENTE'
        ? 'Fuori dalle 24 ore serve un template approvato, e non è ancora stato creato. Mandalo in approvazione da Automazioni.'
        : `Il template del consenso non è ancora approvato da Meta (${stato}). Intanto fallo firmare sul tablet.`,
    };
  }

  const res = await sendWhatsAppTemplate(normalizePhone(telefono as string), 'consensoLaser', {
    bodyParams: [nome || 'ciao', quando],
    buttonUrlSuffix: encodeURIComponent(gettone),
    fallbackText: testo,
    source: 'automation',
  });
  return res.ok ? { ok: true } : { ok: false, errore: res.error || 'Invio fallito' };
}
