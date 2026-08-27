/**
 * I dati del centro: nome, indirizzo, telefono, orari di apertura.
 *
 * Erano scritti a mano in quattro file diversi e gli orari di apertura non
 * esistevano proprio — c'era solo una fascia unica dentro le impostazioni
 * della prenotazione, uguale per tutti i giorni. Finché è roba stampata sui
 * fogli si sopravvive; ma un assistente che risponde al telefono deve saper
 * dire "il lunedì siamo chiusi", e quel dato non c'era da nessuna parte.
 *
 * Adesso stanno su database, si cambiano dal gestionale, e i valori qui sotto
 * sono la rete di sicurezza: se non è mai stato salvato niente, il centro
 * funziona lo stesso.
 *
 * `CENTRO` resta esportata così com'era, sincrona: la usano le stampe e le
 * pagine pubbliche, e non ha senso renderle tutte asincrone in un colpo solo.
 * Chi ha bisogno del dato vero usa `leggiCentro()`.
 */

import { prisma } from './prisma';

export interface OrarioGiorno {
  apre: string;
  chiude: string;
}

export interface Centro {
  nome: string;
  indirizzo?: string;
  telefono?: string;
  sito?: string;
  /** Da "1" (lunedì) a "7" (domenica). `null` = chiuso tutto il giorno. */
  orari?: Record<string, OrarioGiorno | null>;
  /** Chiusure straordinarie, formato YYYY-MM-DD: ferie, festivi, ponti. */
  chiusure?: string[];
  /** Quello che l'assistente deve sapere e che nei dati non c'è. */
  noteVoce?: string;
}

export const CENTRO: Centro = {
  nome: 'Revobeauty',
  indirizzo: 'Via Caudina 30 · Maddaloni (CE)',
  telefono: '',
  sito: 'revobeauty.it',
  orari: {
    '1': { apre: '09:00', chiude: '19:00' },
    '2': { apre: '09:00', chiude: '19:00' },
    '3': { apre: '09:00', chiude: '19:00' },
    '4': { apre: '09:00', chiude: '19:00' },
    '5': { apre: '09:00', chiude: '19:00' },
    '6': { apre: '09:00', chiude: '19:00' },
    '7': null,
  },
  chiusure: [],
  noteVoce: '',
};

const CHIAVE = 'centro';

/** I dati veri del centro, con i valori di partenza per quello che manca. */
export async function leggiCentro(): Promise<Centro> {
  const riga = await prisma.appSetting.findUnique({ where: { key: CHIAVE } });
  const salvato = (riga?.data || {}) as Partial<Centro>;
  return {
    ...CENTRO,
    ...salvato,
    // Gli orari si sostituiscono in blocco, non si fondono: se il centro
    // toglie un giorno, quel giorno deve sparire, non riaffiorare dal default.
    orari: salvato.orari ?? CENTRO.orari,
    chiusure: salvato.chiusure ?? [],
  };
}

export async function salvaCentro(parziale: Partial<Centro>): Promise<Centro> {
  const adesso = await leggiCentro();
  const nuovo: Centro = { ...adesso, ...parziale };
  await prisma.appSetting.upsert({
    where: { key: CHIAVE },
    create: { key: CHIAVE, data: nuovo as unknown as object, updatedAt: new Date().toISOString() },
    update: { data: nuovo as unknown as object, updatedAt: new Date().toISOString() },
  });
  return nuovo;
}

const NOMI_GIORNI = ['', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

/** "dalle 9" invece di "dalle 09:00": al telefono i minuti a zero non si dicono. */
function oraSecca(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
}

/** "a, b e c" — l'ultimo si lega con la e, gli altri con la virgola. */
function elenca(voci: string[]): string {
  if (voci.length <= 1) return voci[0] || '';
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`;
}

/**
 * Gli orari di apertura in una frase da leggere ad alta voce.
 *
 * I giorni uguali e attaccati si accorpano — "dal martedì al sabato dalle 9
 * alle 19" — perché elencarli uno per uno al telefono è una filastrocca che
 * nessuno segue fino in fondo.
 */
export function orariParlati(orari: Centro['orari']): string {
  if (!orari) return '';

  const blocchi: { giorni: number[]; orario: OrarioGiorno | null }[] = [];
  for (let g = 1; g <= 7; g++) {
    const o = orari[String(g)] ?? null;
    const ultimo = blocchi[blocchi.length - 1];
    const uguale = ultimo && (
      (ultimo.orario === null && o === null)
      || (ultimo.orario && o && ultimo.orario.apre === o.apre && ultimo.orario.chiude === o.chiude)
    );
    if (uguale) ultimo.giorni.push(g);
    else blocchi.push({ giorni: [g], orario: o });
  }

  // "dal lunedi' al sabato", ma "dalla domenica": domenica e' l'unico giorno
  // femminile della settimana e "al domenica" si sente.
  const da = (g: number) => (g === 7 ? 'dalla' : 'dal');
  const a = (g: number) => (g === 7 ? 'alla' : 'al');
  const nomeBlocco = (giorni: number[]) => {
    const primo = giorni[0];
    const ultimo = giorni[giorni.length - 1];
    return giorni.length >= 3
      ? `${da(primo)} ${NOMI_GIORNI[primo]} ${a(ultimo)} ${NOMI_GIORNI[ultimo]}`
      : elenca(giorni.map(g => NOMI_GIORNI[g]));
  };

  const aperti = blocchi.filter(b => b.orario)
    .map(b => `${nomeBlocco(b.giorni)} dalle ${oraSecca(b.orario!.apre)} alle ${oraSecca(b.orario!.chiude)}`);
  const chiusi = blocchi.filter(b => !b.orario).map(b => nomeBlocco(b.giorni));

  if (aperti.length === 0) return 'chiuso';
  const frase = aperti.join('; ');
  return chiusi.length > 0 ? `${frase}. Chiuso ${elenca(chiusi)}` : frase;
}

/** Vero se quel giorno il centro è chiuso: giorno di riposo o chiusura straordinaria. */
export function eChiuso(centro: Centro, iso: string): boolean {
  if (centro.chiusure?.includes(iso)) return true;
  const dow = new Date(iso + 'T12:00:00').getDay();
  return (centro.orari?.[String(dow === 0 ? 7 : dow)] ?? null) === null;
}
