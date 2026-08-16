/**
 * Chi merita di ricevere la richiesta di recensione, e quando.
 *
 * Le recensioni Google non arrivano da sole: arrivano se le chiedi, e se le
 * chiedi al momento giusto. Le regole qui dentro sono quelle imparate dai
 * centri che lo fanno bene:
 *
 *  - si chiede a chi è venuto DA POCO. Dopo tre settimane la cliente non
 *    ricorda più com'è andata e la richiesta sembra piovuta dal nulla;
 *  - si chiede una volta sola. Insistere è il modo più veloce per farsi
 *    bloccare su WhatsApp, e Meta conta le segnalazioni;
 *  - si chiede a chi è stato servito davvero, cioè agli appuntamenti chiusi:
 *    un no-show o una disdetta non hanno niente da recensire;
 *  - non si chiede alle schede di casa (titolari e prove).
 *
 * Una regola che NON c'è, di proposito: filtrare le clienti "contente". Si
 * chiama review gating, Google lo vieta apertamente e può costare la
 * sospensione della scheda. Si chiede a tutte, e le stelle sono quelle che
 * sono — che poi è anche l'unico modo per accorgersi di un problema.
 */

/** Da quanti giorni indietro si pesca: oltre, la visita è già dimenticata. */
export const GIORNI_FINESTRA = 14;

/** Quanto tempo deve passare prima di poter richiedere a chi ha già ricevuto. */
export const GIORNI_RICHIESTA = 180;

/** Quanto costa un messaggio template su WhatsApp, per la stima di spesa. */
export const COSTO_MESSAGGIO = 0.07;

/** La riga che ricorda "a questa cliente l'abbiamo già chiesto". */
export function rigaRichiesta(clientId: string): string {
  return `wa:recensione:${clientId}`;
}

export interface CandidataRecensione {
  clientId: string;
  nome: string;
  /** Solo il nome di battesimo: è quello che finisce nel messaggio. */
  primoNome: string;
  phone: string;
  /** Il trattamento dell'ultima visita chiusa: finisce in {{2}}. */
  trattamento: string;
  /** Data ISO (YYYY-MM-DD) dell'ultima visita chiusa. */
  quando: string;
  /** Da quanti giorni è venuta: serve a mostrare prima le più fresche. */
  giorniFa: number;
}

export interface RichiestaFatta {
  clientId: string;
  quando: string;
  ok: boolean;
}

/** Giorni pieni fra due date ISO (YYYY-MM-DD). */
export function giorniTra(da: string, a: string): number {
  const ms = Date.parse(`${a}T12:00:00Z`) - Date.parse(`${da}T12:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Vero se a questa cliente si può chiedere adesso.
 *
 * `ultimaRichiesta` è la data ISO dell'ultima volta che le è stato chiesto,
 * oppure niente se non è mai successo.
 */
export function sipuoChiedere(oggi: string, ultimaRichiesta?: string): boolean {
  if (!ultimaRichiesta) return true;
  return giorniTra(ultimaRichiesta.slice(0, 10), oggi) >= GIORNI_RICHIESTA;
}

/** Stima della spesa di un giro di richieste. */
export function costoStimato(quante: number): number {
  return Math.round(quante * COSTO_MESSAGGIO * 100) / 100;
}
