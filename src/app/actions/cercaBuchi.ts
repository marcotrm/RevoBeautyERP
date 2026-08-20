'use server';

/**
 * Cerca buchi: "quando posso metterla?".
 *
 * È la domanda che si fa venti volte al giorno col telefono in mano, e finora
 * si rispondeva scorrendo l'agenda giorno per giorno con l'occhio, sperando di
 * non saltare la mezz'ora libera fra le due e mezza e le tre.
 *
 * Il motore è lo stesso che usa il bot su WhatsApp (src/lib/bookingEngine.ts):
 * conosce i turni, le pause, i blocchi, chi sa fare cosa e quanto ci mette
 * ognuna. Qui viene solo aperto alle ragazze del banco, con le stesse risposte
 * che darebbe a una cliente — se no il gestionale direbbe a voce una cosa e su
 * WhatsApp un'altra.
 */

import { cercaSlot } from '@/lib/bookingEngine';
import { todayRome } from '@/lib/date';

export interface BucoTrovato {
  date: string;
  time: string;
  endTime: string;
  durata: number;
  prezzo: number;
  /** Chi fa cosa, in ordine: è quello che finisce sull'appuntamento. */
  chiFaCosa: { treatmentId: string; treatmentName: string; operatorId: string; operatorName: string; startTime: string }[];
}

export interface EsitoCercaBuchi {
  buchi: BucoTrovato[];
  durataTotale: number;
  prezzoTotale: number;
  /** Quanti giorni sono stati guardati davvero. */
  giorniGuardati: number;
}

export interface RichiestaBuco {
  treatmentId: string;
  /** Chi lo deve fare. Vuoto = chiunque sia libera. */
  operatorId?: string | null;
}

export async function cercaBuchi(params: {
  /*
    I trattamenti da incastrare, nell'ordine in cui si faranno, ognuno con la
    sua operatrice.

    Il punto è proprio questo: il refill lo fa Michela e subito dopo il
    massaggio lo fa Rosaria. Il motore cerca due orari attaccati — il secondo
    comincia quando finisce il primo — e propone solo i giorni in cui il
    passaggio di mano sta in piedi davvero.
  */
  richieste: RichiestaBuco[];
  /** Da quale giorno cercare. Vuoto = da oggi. */
  dal?: string;
  giorni?: number;
  gender?: 'male' | 'female';
  /** Fascia oraria voluta, se la cliente ne ha una. */
  oraDa?: string | null;
  oraA?: string | null;
  /** Quanti orari mostrare in tutto. */
  quanti?: number;
}): Promise<EsitoCercaBuchi> {
  const richieste = (params.richieste || []).filter(r => r?.treatmentId);
  if (richieste.length === 0) return { buchi: [], durataTotale: 0, prezzoTotale: 0, giorniGuardati: 0 };

  const dal = params.dal || todayRome();
  const giorni = Math.min(Math.max(1, params.giorni || 21), 60);

  const esito = await cercaSlot({
    dateFrom: dal,
    giorni,
    services: richieste.map(r => ({ treatmentId: r.treatmentId, operatorId: r.operatorId || null })),
    gender: params.gender || 'female',
    oraDa: params.oraDa || null,
    oraA: params.oraA || null,
    // Si chiedono larghi e poi si diradano qui sotto: il motore propone anche
    // le 12:45 e le 13:00, che come scelta sono la stessa cosa.
    maxPerGiorno: 12,
  });

  const quanti = Math.min(Math.max(1, params.quanti || 9), 30);
  const buchi: BucoTrovato[] = [];

  /*
    Al massimo tre orari per giorno, e distanti fra loro.

    Il motore trova un posto ogni quarto d'ora: proporre 12:45, 13:00 e 13:15
    sembra tre possibilità e invece è la stessa, e intanto la cliente non sa
    che c'era posto anche alle sei di sera. Con due ore di distanza minima
    escono la mattina, il pomeriggio e la sera.
  */
  const DISTANZA_MIN = 120;
  const minuti = (ora: string) => {
    const [h, m] = ora.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  for (const g of esito.giorni) {
    const scelti: number[] = [];
    const slotDiradati = g.slots.filter(s => {
      if (scelti.length >= 3) return false;
      const t = minuti(s.time);
      if (scelti.some(x => Math.abs(x - t) < DISTANZA_MIN)) return false;
      scelti.push(t);
      return true;
    });
    for (const s of slotDiradati) {
      buchi.push({
        date: g.date,
        time: s.time,
        endTime: s.endTime,
        durata: s.durataTotale,
        prezzo: s.prezzoTotale,
        chiFaCosa: s.assegnazioni.map(a => ({
          treatmentId: a.treatmentId,
          treatmentName: a.treatmentName,
          operatorId: a.operatorId,
          operatorName: a.operatorName,
          startTime: a.startTime,
        })),
      });
      if (buchi.length >= quanti) break;
    }
    if (buchi.length >= quanti) break;
  }

  return {
    buchi,
    durataTotale: esito.durataTotale,
    prezzoTotale: esito.prezzoTotale,
    giorniGuardati: giorni,
  };
}
