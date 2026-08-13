'use server';

/**
 * Copri buchi, lato gestionale: lanciare una chiamata su un posto libero,
 * guardare come sta andando, fermarla.
 */

import { prisma } from '@/lib/prisma';
import {
  creaCampagna, elencoCampagne, leggiCampagna, chiudiCampagna, candidate, mandaGiro,
  costoStimato, BLOCCO, ATTESA_MINUTI, MAX_GIRI,
  type CampagnaBuco, type Candidata,
} from '@/lib/copriBuchi';

export interface CampagnaInPagina extends CampagnaBuco {
  costo: number;
}

export async function campagneCopriBuchi(): Promise<CampagnaInPagina[]> {
  const list = await elencoCampagne(40);
  return list.map(c => ({ ...c, costo: costoStimato(c) }));
}

/** Chi verrebbe contattata adesso, in ordine: serve a decidere prima di spendere. */
export async function anteprimaCandidate(params: {
  date: string; from: string; to: string;
  operatorId: string; treatmentName: string;
}): Promise<{ candidate: Candidata[]; blocco: number; attesa: number; maxGiri: number }> {
  const finta: CampagnaBuco = {
    id: 'anteprima', creataIl: new Date().toISOString(), stato: 'attiva',
    date: params.date, from: params.from, to: params.to, durata: 0,
    operatorId: params.operatorId, operatorName: '',
    treatmentId: '', treatmentName: params.treatmentName, prezzo: 0,
    origine: 'manuale', giro: 0, prossimoGiroIl: new Date().toISOString(), contattate: [],
  };
  return {
    candidate: (await candidate(finta)).slice(0, BLOCCO * MAX_GIRI),
    blocco: BLOCCO, attesa: ATTESA_MINUTI, maxGiri: MAX_GIRI,
  };
}

/** Lancia la campagna e manda subito il primo blocco. */
export async function lanciaCopriBuchi(params: {
  date: string; from: string; to: string;
  operatorId: string; operatorName: string;
  treatmentId: string; treatmentName: string; prezzo: number;
  origine?: 'disdetta' | 'manuale';
  disdettaDi?: string;
}): Promise<{ ok: boolean; id?: string; inviati?: number; errore?: string }> {
  // Una sola campagna per volta sullo stesso posto: due chiamate sullo stesso
  // buco vorrebbero dire due clienti convinte di averlo preso.
  const gia = (await elencoCampagne(40)).find(c =>
    c.stato === 'attiva' && c.date === params.date && c.operatorId === params.operatorId && c.from === params.from
  );
  if (gia) return { ok: false, errore: 'C\'è già una chiamata aperta su questo posto.' };

  const c = await creaCampagna({ origine: 'manuale', ...params });
  const r = await mandaGiro(c);
  if (r.inviati === 0) {
    await chiudiCampagna(c.id, 'annullata', r.motivo || 'nessun messaggio partito');
    return { ok: false, errore: r.motivo || 'Nessun messaggio è partito.' };
  }
  return { ok: true, id: c.id, inviati: r.inviati };
}

/** Manda subito il blocco successivo senza aspettare la mezz'ora. */
export async function mandaProssimoBlocco(id: string): Promise<{ ok: boolean; inviati?: number; errore?: string }> {
  const c = await leggiCampagna(id);
  if (!c || c.stato !== 'attiva') return { ok: false, errore: 'La chiamata non è più aperta.' };
  const r = await mandaGiro(c);
  if (r.inviati === 0) return { ok: false, errore: r.motivo || 'Nessun messaggio è partito.' };
  return { ok: true, inviati: r.inviati };
}

export async function fermaCopriBuchi(id: string): Promise<{ ok: boolean }> {
  await chiudiCampagna(id, 'annullata', 'fermata a mano');
  return { ok: true };
}

export async function dettaglioCampagna(id: string): Promise<CampagnaInPagina | null> {
  const c = await leggiCampagna(id);
  return c ? { ...c, costo: costoStimato(c) } : null;
}

/** Quante clienti sarebbero contattabili in tutto: dice se il sistema ha benzina. */
export async function quantoCarburante(): Promise<{ attiveConConsenso: number; attive: number; totali: number }> {
  const oggi = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.parse(oggi) - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const clienti = await prisma.client.findMany({ select: { id: true, marketingConsent: true } });
  const visite = await prisma.appointment.findMany({
    where: { status: 'completed' }, select: { clientId: true, date: true },
  });
  const ultima = new Map<string, string>();
  for (const a of visite) {
    const p = ultima.get(a.clientId);
    if (!p || a.date > p) ultima.set(a.clientId, a.date);
  }
  const attive = clienti.filter(c => (ultima.get(c.id) || '') >= limite);
  return {
    attiveConConsenso: attive.filter(c => c.marketingConsent).length,
    attive: attive.length,
    totali: clienti.length,
  };
}
