/**
 * Quando una cliente può disdire dall'app.
 *
 * La regola sta qui e non dentro gli endpoint perché deve dare la stessa
 * risposta in due momenti diversi: quando l'app chiede l'elenco (per decidere
 * se mostrare il tasto Disdici) e quando la cliente preme quel tasto. Se le due
 * risposte divergessero, l'app mostrerebbe un tasto che poi dà errore.
 */

/** Quanto preavviso serve per disdire da soli. Sotto, si passa dal telefono. */
export const ORE_MINIME_DISDETTA = 24;

export type EsitoDisdetta =
  | { ok: true }
  | { ok: false; code: 'NOT_CANCELLABLE' | 'TOO_LATE' | 'LOCKED'; error: string };

export function disdettabile(a: {
  date: string;
  startTime: string;
  status: string;
  isLocked?: boolean;
}): EsitoDisdetta {
  if (a.status === 'cancelled') {
    return { ok: false, code: 'NOT_CANCELLABLE', error: 'Questo appuntamento è già stato disdetto.' };
  }
  if (a.status === 'completed' || a.status === 'in_cabin') {
    return { ok: false, code: 'NOT_CANCELLABLE', error: 'Questo appuntamento è già stato svolto.' };
  }
  if (a.isLocked) {
    return {
      ok: false,
      code: 'LOCKED',
      error: 'Questo appuntamento è bloccato dal centro. Chiamaci per modificarlo.',
    };
  }

  // Data e ora locali: l'appuntamento è alle 15:00 di Maddaloni, non UTC
  const inizio = new Date(`${a.date}T${(a.startTime || '00:00')}:00`);
  if (isNaN(inizio.getTime())) {
    return { ok: false, code: 'NOT_CANCELLABLE', error: 'Data dell\'appuntamento non valida. Chiamaci.' };
  }

  const oreMancanti = (inizio.getTime() - Date.now()) / 3_600_000;
  if (oreMancanti < 0) {
    return { ok: false, code: 'NOT_CANCELLABLE', error: 'Questo appuntamento è già passato.' };
  }
  if (oreMancanti < ORE_MINIME_DISDETTA) {
    return {
      ok: false,
      code: 'TOO_LATE',
      error: `Mancano meno di ${ORE_MINIME_DISDETTA} ore: per disdire adesso chiamaci, così proviamo a dare il posto a qualcun altro.`,
    };
  }

  return { ok: true };
}
