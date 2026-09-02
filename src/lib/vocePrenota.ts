/**
 * Il pezzo di lavoro che sta in mezzo fra "verifica" e "prenota".
 *
 * Le due route fanno la stessa identica cosa fino all'ultimo passo: leggono
 * quello che l'assistente ha capito, controllano che l'orario regga davvero, e
 * costruiscono la frase da leggere alla cliente. Poi una si ferma e restituisce
 * il gettone, l'altra scrive in agenda. Tenere il controllo in un posto solo è
 * l'unico modo perché le due non divergano — e se divergono, l'assistente
 * conferma una cosa e ne prenota un'altra.
 */

import { guessGenderFromName } from '@/lib/helpers';
import { prisma } from './prisma';
import { slotDisponibili, type ServizioRichiesto, type SlotProposto } from './bookingEngine';
import { quandoParlato } from './parlato';
import { findClientByPhone, todayInItaly } from './voice';
import { notifyNuovoAppuntamento } from './telegram';
import { eClienteNuova } from './clienteNuova';
import { omonimoInRubrica } from './omonimi';
import { sendAppointmentConfirmation } from './wa-appointments';

export interface DatiPrenotazione {
  phone: string;
  /** Serve solo se la cliente non è già in rubrica. */
  clientName?: string;
  services: ServizioRichiesto[];
  date: string;
  startTime: string;
  gender: 'male' | 'female';
}

export type Preparazione =
  | { ok: false; stato: number; codice: string; messaggio: string }
  | {
      ok: true;
      dati: DatiPrenotazione;
      slot: SlotProposto;
      clienteId: string | null;
      nomeCliente: string;
      /** La frase da leggere alla cliente, parola per parola. */
      riepilogo: string;
    };

/** Legge il corpo della richiesta accettando sia `services[]` sia il vecchio trattamento singolo. */
export function leggiServizi(b: {
  services?: unknown; treatmentId?: unknown; operatorId?: unknown;
}): ServizioRichiesto[] {
  if (Array.isArray(b.services) && b.services.length > 0) {
    return b.services
      .filter((s: unknown) => s && typeof s === 'object')
      .map((s: { treatmentId?: unknown; operatorId?: unknown }) => ({
        treatmentId: String(s.treatmentId || ''),
        operatorId: s.operatorId ? String(s.operatorId) : null,
      }))
      .filter((s: ServizioRichiesto) => s.treatmentId);
  }
  return b.treatmentId
    ? [{ treatmentId: String(b.treatmentId), operatorId: b.operatorId ? String(b.operatorId) : null }]
    : [];
}

function euro(n: number): string {
  return n % 1 === 0 ? `${n} euro` : `${n.toFixed(2).replace('.', ',')} euro`;
}

/**
 * Controlla che la prenotazione stia in piedi e prepara il riepilogo.
 *
 * `oraDa: startTime` non è un dettaglio: senza, la griglia degli orari riparte
 * dall'apertura del centro e cade su minuti diversi da quelli proposti alla
 * cliente — si offrono le 18:45 e si conosce solo le 18:50.
 */
export async function preparaPrenotazione(b: {
  phone?: unknown; clientName?: unknown; date?: unknown; startTime?: unknown;
  gender?: unknown; services?: unknown; treatmentId?: unknown; operatorId?: unknown;
}): Promise<Preparazione> {
  const no = (codice: string, messaggio: string, stato = 400) =>
    ({ ok: false as const, stato, codice, messaggio });

  const phone = String(b.phone || '').trim();
  const date = String(b.date || '');
  const startTime = String(b.startTime || '');

  if (!phone) return no('VALIDATION', 'Manca il numero di telefono della cliente.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return no('VALIDATION', 'Manca la data, o non è nel formato giusto.');
  if (!/^\d{2}:\d{2}$/.test(startTime)) return no('VALIDATION', 'Manca l\'orario, o non è nel formato giusto.');
  if (date < todayInItaly()) return no('VALIDATION', 'Quella data è già passata.');

  const services = leggiServizi(b);
  if (services.length === 0) return no('VALIDATION', 'Manca il trattamento.');

  const cliente = await findClientByPhone(phone);
  /*
    Il listino uomo/donna, quando a prenotare non c'e' nessuno al banco.

    Prima, senza indicazione, si ripiegava su "donna" — e per ogni uomo
    prenotato da WhatsApp o dall'app partiva il prezzo sbagliato. Adesso decide
    il nome, che e' l'unica cosa che si sa sempre; la scheda serve solo quando
    il nome non e' in rubrica.
  */
  const nomeCompleto = cliente
    ? `${cliente.firstName} ${cliente.lastName}`.trim()
    : String(b.clientName || '').trim();
  const gender: 'male' | 'female' = (b.gender === 'male' || b.gender === 'female')
    ? b.gender
    : nomeCompleto
      ? guessGenderFromName(nomeCompleto)
      : (cliente?.gender === 'M' ? 'male' : 'female');

  const { slots } = await slotDisponibili({ date, services, gender, oraDa: startTime });
  const slot = slots.find(s => s.time === startTime);
  if (!slot) {
    return no('NOT_AVAILABLE', 'Quell\'orario non è più libero. Proponi un altro orario.', 409);
  }

  const nomeDetto = String(b.clientName || '').trim();
  const nomeCliente = cliente
    ? `${cliente.firstName} ${cliente.lastName}`.trim()
    : nomeDetto;
  if (!nomeCliente) {
    return no('SERVE_NOME', 'Questo numero non è in rubrica: chiedi alla cliente nome e cognome.');
  }

  const cosa = slot.assegnazioni
    .map(a => `${a.treatmentName} con ${a.operatorName.split(' ')[0]}`)
    .join(', poi ');

  return {
    ok: true,
    dati: { phone, clientName: nomeDetto || undefined, services, date, startTime, gender },
    slot,
    clienteId: cliente?.id || null,
    nomeCliente,
    riepilogo: `${nomeCliente}: ${cosa}, ${quandoParlato(date, slot.time)}. `
      + `${slot.durataTotale} minuti, ${euro(slot.prezzoTotale)}.`,
  };
}

/** I trattamenti dello slot, con categoria e colore: servono per scrivere l'appuntamento. */
export async function metaTrattamenti(slot: SlotProposto) {
  const trattamenti = await prisma.treatment.findMany({
    where: { id: { in: slot.assegnazioni.map(a => a.treatmentId) } },
    select: { id: true, category: true, color: true },
  });
  return new Map(trattamenti.map(t => [t.id, t]));
}

// ============================================================
// La scrittura in agenda
// ============================================================

export interface EsitoScrittura {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  treatmentName: string;
  operatorName: string;
  clientName: string;
  clientId: string;
  price: number;
}

export type Scrittura =
  | { ok: false; stato: number; codice: string; messaggio: string }
  | { ok: true; appuntamento: EsitoScrittura; messaggio: string };

/**
 * Scrive l'appuntamento che la cliente ha appena confermato.
 *
 * Sta qui e non nella route perche' adesso le bocche sono due — il telefono e
 * WhatsApp — e devono scrivere la stessa identica riga in agenda. Due copie di
 * questo codice divergono: una crea la scheda cliente e l'altra no, una manda
 * la conferma e l'altra se ne dimentica, e il centro si ritrova due tipi di
 * appuntamento che si comportano diversamente senza che nessuno l'abbia
 * deciso.
 *
 * La disponibilita' si ricontrolla sempre: fra il "si, confermo" e adesso sono
 * passati dei secondi, e al banco intanto qualcuno puo' aver preso quel posto.
 */
export async function scriviAppuntamento(
  confermato: DatiPrenotazione,
  origine: { createdBy: string; nota: string; canale: string }
): Promise<Scrittura> {
  const p = await preparaPrenotazione(confermato);
  if (!p.ok) return { ok: false, stato: p.stato, codice: p.codice, messaggio: p.messaggio };

  const { slot } = p;

  /*
    La scheda della cliente si crea adesso, non prima: se la conversazione si
    fosse incagliata sull'orario, in rubrica non doveva restare la scheda vuota
    di qualcuno che non ha prenotato niente.
  */
  const client = p.clienteId
    ? { id: p.clienteId, nome: p.nomeCliente }
    : await prisma.client.create({
        data: {
          firstName: p.nomeCliente.split(/\s+/)[0],
          lastName: p.nomeCliente.split(/\s+/).slice(1).join(' '),
          phone: confermato.phone,
          gender: confermato.gender === 'male' ? 'M' : 'F',
          createdAt: new Date().toISOString(),
        },
        select: { id: true },
      }).then(c => ({ id: c.id, nome: p.nomeCliente }));

  const metaDi = await metaTrattamenti(slot);
  const principale = slot.assegnazioni[0];
  const adesso = new Date().toISOString();

  const appointment = await prisma.appointment.create({
    data: {
      clientId: client.id,
      clientName: client.nome,
      operatorId: principale.operatorId,
      operatorName: principale.operatorName,
      treatmentId: principale.treatmentId,
      treatmentName: slot.assegnazioni.map(a => a.treatmentName).join(' + '),
      treatmentCategory: metaDi.get(principale.treatmentId)?.category || 'body',
      date: confermato.date,
      startTime: slot.time,
      endTime: slot.endTime,
      duration: slot.durataTotale,
      status: 'confirmed',
      price: slot.prezzoTotale,
      services: slot.assegnazioni.map(a => ({
        treatmentId: a.treatmentId,
        treatmentName: a.treatmentName,
        treatmentCategory: metaDi.get(a.treatmentId)?.category || 'body',
        duration: a.duration,
        price: a.price,
        gender: confermato.gender,
        operatorId: a.operatorId,
        operatorName: a.operatorName,
      })),
      color: metaDi.get(principale.treatmentId)?.color || '#A855F7',
      notes: origine.nota,
      createdAt: adesso,
      updatedAt: adesso,
      createdBy: origine.createdBy,
    },
  });

  /*
    Chi prenota da fuori non sceglie una scheda: la sua nasce dal numero. Se
    pero' quel nome in rubrica c'e' gia' con un altro numero, e' un possibile
    doppione e va detto stasera, non fra sei mesi.
  */
  Promise.all([
    eClienteNuova(appointment.clientId, appointment.id),
    omonimoInRubrica(prisma, appointment.clientId),
  ])
    .then(([nuova, omonimi]) => notifyNuovoAppuntamento({
      client: appointment.clientName,
      treatment: appointment.treatmentName,
      operator: appointment.operatorName,
      date: appointment.date,
      time: appointment.startTime,
      price: appointment.price,
      source: origine.canale,
      nuova,
      omonima: omonimi.length > 0 ? omonimi.map(o => o.phone).join(', ') : null,
    }))
    .catch(() => {});

  return {
    ok: true,
    appuntamento: {
      id: appointment.id,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      treatmentName: appointment.treatmentName,
      operatorName: appointment.operatorName,
      clientName: appointment.clientName,
      clientId: appointment.clientId,
      price: appointment.price,
    },
    // Frase gia' pronta: la data la compone il gestionale, non il modello.
    messaggio: `Fatto: ${quandoParlato(appointment.date, appointment.startTime)} `
      + `con ${appointment.operatorName.split(' ')[0]}.`,
  };
}

/**
 * La conferma su WhatsApp dopo una prenotazione presa al telefono.
 *
 * Non parte per le prenotazioni fatte SU WhatsApp: li' la segretaria ha appena
 * scritto in chat che e' fatta, e un template identico subito dopo e' il
 * doppione classico che fa disattivare le notifiche.
 */
export function confermaSuWhatsApp(appointmentId: string): void {
  sendAppointmentConfirmation(appointmentId).catch(() => {});
}
