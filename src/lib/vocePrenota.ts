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

import { prisma } from './prisma';
import { slotDisponibili, type ServizioRichiesto, type SlotProposto } from './bookingEngine';
import { quandoParlato } from './parlato';
import { findClientByPhone, todayInItaly } from './voice';

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
  const gender: 'male' | 'female' = (b.gender === 'male' || b.gender === 'female')
    ? b.gender
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
