/**
 * Il diario dell'agenda: chi ha toccato cosa.
 *
 * Nasce da una domanda a cui il gestionale non sapeva rispondere: «stamattina
 * c'erano piu' appuntamenti di adesso, cosa e' successo?». Un annullato resta
 * in archivio e si ritrova; un eliminato spariva del tutto — e il tasto per
 * farlo prometteva perfino di non lasciare traccia.
 *
 * Da qui in avanti ogni riga scritta, cambiata o cancellata lascia un segno,
 * con dentro la copia dell'appuntamento com'era. Se qualcuno cancella, la
 * seduta si ricostruisce lo stesso: nome, ora, trattamento, prezzo.
 *
 * Chi l'ha fatto si prende dalla sessione, che il browser non puo' riscrivere.
 * Quando manca — sessioni aperte prima che i cookie esistessero — si ripiega
 * sul nome che arriva dalla pagina, e si scrive che e' cosi': meglio un dato
 * dichiarato e segnato come tale che un dato assente.
 */

import { prisma } from '@/lib/prisma';
import { sessioneCorrente } from '@/lib/sessione';

export type AzioneAgenda = 'creato' | 'modificato' | 'annullato' | 'eliminato' | 'riattivato';

/** I campi che vale la pena raccontare quando cambiano. */
const ETICHETTE: Record<string, string> = {
  date: 'data',
  startTime: 'orario',
  endTime: 'fine',
  operatorName: 'operatrice',
  treatmentName: 'trattamento',
  price: 'prezzo',
  status: 'stato',
  duration: 'durata',
  cabinNumber: 'cabina',
  notes: 'note',
};

interface RigaAppuntamento {
  id: string;
  clientName?: string | null;
  date?: string | null;
  startTime?: string | null;
  treatmentName?: string | null;
  price?: number | null;
  status?: string | null;
  cancelReason?: string | null;
  [k: string]: unknown;
}

/** Le differenze fra prima e dopo, scritte come le direbbe una persona. */
function differenze(prima?: RigaAppuntamento | null, dopo?: RigaAppuntamento | null): string[] {
  if (!prima || !dopo) return [];
  const out: string[] = [];
  for (const [campo, etichetta] of Object.entries(ETICHETTE)) {
    const a = prima[campo];
    const b = dopo[campo];
    if (a === b) continue;
    if (a == null && b == null) continue;
    const scritto = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
    out.push(`${etichetta} ${scritto(a)} → ${scritto(b)}`);
  }
  return out;
}

/**
 * Segna una riga nel diario.
 *
 * Non lancia mai: se il diario non si riesce a scrivere, l'appuntamento si
 * salva lo stesso. Un registro che blocca il lavoro viene spento nel giro di
 * una settimana, e allora non registra piu' niente.
 */
export async function segnaInDiario(dati: {
  azione: AzioneAgenda;
  appointmentId: string;
  prima?: RigaAppuntamento | null;
  dopo?: RigaAppuntamento | null;
  motivo?: string | null;
  /** Il nome che arriva dalla pagina, quando la sessione non c'e'. */
  chiDichiarato?: string | null;
}): Promise<void> {
  try {
    /*
      Non si scrive tutto: il diario deve restare leggibile.

      Un check-in, un check-out e un cambio cabina sono modifiche, ma sono il
      lavoro normale di ogni seduta: trenta appuntamenti al giorno ne
      produrrebbero centinaia, e la riga che conta — l'annullamento delle
      nove e mezza — finirebbe sepolta li' dentro. Si scrive quando cambia
      qualcosa che riguarda i soldi o il posto in agenda: giorno, ora, prezzo,
      operatrice, trattamento. E sempre, senza eccezioni, quando si annulla,
      si elimina o si riattiva.
    */
    const cambi = differenze(dati.prima, dati.dopo);
    if (dati.azione === 'modificato') {
      const conta = cambi.some(c =>
        c.startsWith('data ') || c.startsWith('orario ') || c.startsWith('prezzo ')
        || c.startsWith('operatrice ') || c.startsWith('trattamento '));
      if (!conta) return;
    }

    const s = await sessioneCorrente();
    const chi = s?.tipo === 'operatrice' && s.nome
      ? s.nome
      : (dati.chiDichiarato?.trim() ? `${dati.chiDichiarato.trim()} (dichiarato)` : 'sconosciuto');

    const rif = dati.dopo || dati.prima;
    await prisma.diarioAgenda.create({
      data: {
        azione: dati.azione,
        appointmentId: dati.appointmentId,
        prima: dati.prima ? JSON.parse(JSON.stringify(dati.prima)) : undefined,
        dopo: dati.dopo ? JSON.parse(JSON.stringify(dati.dopo)) : undefined,
        cambiamenti: cambi,
        clientName: String(rif?.clientName || 'senza nome'),
        data: String(rif?.date || ''),
        ora: String(rif?.startTime || ''),
        trattamento: String(rif?.treatmentName || ''),
        prezzo: Number(rif?.price || 0),
        motivo: dati.motivo || (dati.dopo?.cancelReason as string | undefined) || null,
        chi,
        chiId: s?.accountId || null,
        quando: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('[diario] non sono riuscito a scrivere la riga:', String(e).slice(0, 120));
  }
}

/**
 * Riconosce gli spostamenti: annullato e rifatto sono una cosa sola.
 *
 * Se entro un quarto d'ora dall'annullamento nasce un altro appuntamento per
 * la stessa persona, quella seduta non e' persa: e' stata spostata. Vederla
 * fra i «cancellati» farebbe suonare un allarme per niente — e un allarme che
 * suona per niente e' un allarme che si smette di guardare.
 */
const FINESTRA_SPOSTAMENTO_MS = 15 * 60_000;

export async function collegaSpostamenti(giorno: string): Promise<void> {
  const righe = await prisma.diarioAgenda.findMany({
    where: { data: giorno, azione: { in: ['annullato', 'eliminato', 'creato'] } },
    orderBy: { quando: 'asc' },
  });
  for (const via of righe.filter(r => r.azione !== 'creato' && !r.spostatoIn)) {
    const nuovo = righe.find(r =>
      r.azione === 'creato'
      && r.clientName === via.clientName
      && Math.abs(Date.parse(r.quando) - Date.parse(via.quando)) <= FINESTRA_SPOSTAMENTO_MS
      && r.appointmentId !== via.appointmentId);
    if (nuovo) {
      await prisma.diarioAgenda.update({
        where: { id: via.id },
        data: { spostatoIn: nuovo.appointmentId },
      }).catch(() => {});
    }
  }
}
