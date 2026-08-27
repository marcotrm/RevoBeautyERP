/**
 * Il registro delle telefonate dell'assistente.
 *
 * Senza, nessuno sa cosa la voce ha detto alle clienti: si vedono solo gli
 * appuntamenti che nascono, non le venti conversazioni in cui ha risposto male
 * o si è impuntata. È la differenza fra accorgersi di un problema stasera e
 * accorgersene fra sei mesi da una recensione.
 *
 * Una riga per CHIAMATA, non per battuta — al contrario dell'archivio WhatsApp,
 * dove ogni messaggio è una riga. Una telefonata è un blocco unico e si rilegge
 * tutta insieme; e le chiamate sono molte meno dei messaggi, quindi il limite
 * che `wa-conversations` documenta qui non morde.
 *
 * Stessa casa dell'archivio WhatsApp: righe di `AdminEntry`, indicizzate per
 * `kind`. Nessuna migrazione, e chi conosce già quel meccanismo conosce anche
 * questo.
 */

import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/voice';

const KIND = 'voce_chiamata';

/** Com'è finita. Serve a rispondere alla domanda "a che cosa ci serve davvero". */
export type EsitoChiamata =
  | 'info'        // ha risposto a domande e basta
  | 'prenotato'
  | 'spostato'
  | 'disdetto'
  | 'trasferito'  // passata a una persona
  | 'nessuno';    // riattaccato senza concludere

export interface BattutaChiamata {
  chi: 'cliente' | 'assistente';
  testo: string;
}

export interface Chiamata {
  /** Id della chiamata dal lato telefonia: lo stesso che si vede sul tabulato. */
  callId: string;
  /** Numero da cui ha chiamato. */
  phone: string;
  /** Riconosciuta in rubrica, se lo era. */
  clientId?: string | null;
  clientName?: string | null;
  /** ISO, inizio della telefonata. */
  iniziata: string;
  /** Quanto è durata, in secondi. */
  durata: number;
  esito: EsitoChiamata;
  /** L'appuntamento nato o toccato dalla telefonata. */
  appointmentId?: string | null;
  trascrizione: BattutaChiamata[];
  /** Perché si è fermata, quando si è fermata. */
  note?: string;
}

const rowId = (callId: string) => `voce:${callId}`;

/**
 * Salva la telefonata. `upsert` perché il servizio vocale può riprovare a
 * consegnare la stessa chiamata: con un rowId deterministico il doppione
 * sovrascrive invece di sdoppiare la riga nel registro.
 */
export async function salvaChiamata(c: Chiamata): Promise<void> {
  const dati: Chiamata = { ...c, phone: normalizePhone(c.phone) || c.phone };
  await prisma.adminEntry.upsert({
    where: { rowId: rowId(c.callId) },
    update: { data: dati as unknown as object },
    create: {
      rowId: rowId(c.callId),
      kind: KIND,
      entityId: dati.phone,
      data: dati as unknown as object,
      createdAt: c.iniziata,
    },
  });
}

/** Le ultime telefonate, dalla più recente. */
export async function ultimeChiamate(quante = 100): Promise<Chiamata[]> {
  const righe = await prisma.adminEntry.findMany({
    where: { kind: KIND },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(1, quante), 500),
  });
  return righe.map(r => r.data as unknown as Chiamata);
}

/** Le telefonate di una cliente, per la sua scheda. */
export async function chiamateDi(phone: string, quante = 20): Promise<Chiamata[]> {
  const righe = await prisma.adminEntry.findMany({
    where: { kind: KIND, entityId: normalizePhone(phone) },
    orderBy: { createdAt: 'desc' },
    take: quante,
  });
  return righe.map(r => r.data as unknown as Chiamata);
}
