'use server';

/**
 * Le persone da richiamare.
 *
 * Quella che chiede il prezzo del laser e poi ci pensa. Quella che scrive
 * «vi faccio sapere». Quella a cui hai promesso di riprovare lunedi'. Finivano
 * su un post-it attaccato al monitor, e dopo tre giorni nessuno si ricordava
 * ne' chi fosse ne' cosa volesse — e quella telefonata non partiva piu'.
 *
 * Qui c'e' la cosa che il foglietto non fa: torna a bussare da solo all'ora
 * giusta, e quando la chiami finisce con un esito scritto. «Prenotato» e «non
 * interessata» non sono la stessa cosa, e a fine mese la differenza fra le due
 * dice se quelle telefonate valga la pena farle.
 */

import { prisma } from '@/lib/prisma';

export type EsitoRichiamo =
  | 'prenotato' | 'non_interessata' | 'non_risponde' | 'ci_pensa'
  | 'numero_sbagliato' | 'gia_cliente' | 'altro';

export const ESITI: { id: EsitoRichiamo; testo: string; chiude: boolean }[] = [
  { id: 'prenotato', testo: 'Ha prenotato', chiude: true },
  { id: 'non_interessata', testo: 'Non interessata', chiude: true },
  { id: 'gia_cliente', testo: 'Era già cliente', chiude: true },
  { id: 'numero_sbagliato', testo: 'Numero sbagliato', chiude: true },
  // Questi due NON chiudono niente: la telefonata va rifatta, e il promemoria
  // deve tornare. Segnarli come «fatto» sarebbe il modo piu' rapido per
  // perdere proprio le persone che stavano quasi per dire di sì.
  { id: 'non_risponde', testo: 'Non risponde', chiude: false },
  { id: 'ci_pensa', testo: 'Ci pensa, richiamare', chiude: false },
];

export interface RigaRichiamo {
  id: string;
  nome: string;
  cognome: string;
  telefono: string;
  interesse: string;
  note: string | null;
  stato: string;
  esito: string | null;
  esitoNota: string | null;
  prossimoTentativo: string;
  ripetiOgniMin: number;
  tentativi: number;
  ultimoTentativo: string | null;
  priorita: string;
  fascia: string;
  clientId: string | null;
  creatoDa: string;
  chiusoDa: string | null;
  chiusoIl: string | null;
  createdAt: string;
  /** Vero se l'ora di richiamarla e' gia' passata. */
  scaduto: boolean;
}

const vestita = (r: {
  prossimoTentativo: string; [k: string]: unknown;
}): RigaRichiamo => ({
  ...(r as unknown as RigaRichiamo),
  scaduto: r.prossimoTentativo <= new Date().toISOString(),
});

export async function nuovoRichiamo(dati: {
  nome: string;
  cognome: string;
  telefono: string;
  interesse: string;
  note?: string;
  /*
    Quando ribussare, come istante preciso.

    Lo calcola il browser e non il server: «lunedi' mattina» vuol dire le nove
    e mezza di Napoli, e il server sta su un fuso che non e' il nostro. Un
    promemoria che salta fuori due ore prima, di domenica, non lo guarda
    nessuno — e quando serve davvero non ci si fida piu'.
  */
  quando: string;
  fascia?: string;
  priorita?: string;
  ripetiOgniMin?: number;
  clientId?: string;
  creatoDa: string;
}): Promise<{ ok: boolean; errore?: string; id?: string }> {
  const nome = dati.nome.trim();
  const cognome = dati.cognome.trim();
  const telefono = dati.telefono.replace(/\s+/g, '');
  if (!nome && !cognome) return { ok: false, errore: 'Scrivi almeno il nome.' };
  if (telefono.replace(/\D/g, '').length < 6) return { ok: false, errore: 'Il numero non sembra un numero.' };
  if (!dati.interesse.trim()) return { ok: false, errore: 'Scrivi cosa le interessa: fra tre giorni non te lo ricordi.' };

  const fascia = dati.fascia || 'qualsiasi';
  const ora = new Date().toISOString();
  const r = await prisma.richiamo.create({
    data: {
      nome, cognome, telefono,
      interesse: dati.interesse.trim(),
      note: dati.note?.trim() || null,
      stato: 'da_richiamare',
      prossimoTentativo: dati.quando,
      ripetiOgniMin: Math.max(15, Math.min(24 * 60, dati.ripetiOgniMin ?? 120)),
      priorita: dati.priorita === 'alta' ? 'alta' : 'normale',
      fascia,
      clientId: dati.clientId || null,
      creatoDa: dati.creatoDa,
      createdAt: ora,
      updatedAt: ora,
    },
  });
  return { ok: true, id: r.id };
}

/** Tutti quelli ancora aperti, i piu' urgenti in cima. */
export async function richiamiAperti(): Promise<RigaRichiamo[]> {
  const righe = await prisma.richiamo.findMany({
    where: { stato: 'da_richiamare' },
    orderBy: [{ priorita: 'asc' }, { prossimoTentativo: 'asc' }],
    take: 200,
  });
  return righe.map(vestita);
}

/** Quelli chiusi, per sapere com'e' andata. */
export async function richiamiChiusi(quanti = 40): Promise<RigaRichiamo[]> {
  const righe = await prisma.richiamo.findMany({
    where: { stato: 'risolto' },
    orderBy: { chiusoIl: 'desc' },
    take: quanti,
  });
  return righe.map(vestita);
}

/**
 * Quelli da fare adesso: e' la lista su cui suona il promemoria.
 *
 * Solo quelli la cui ora e' passata. Il resto sta nell'elenco e non disturba:
 * un promemoria che bussa per cose non ancora dovute e' un promemoria che si
 * impara a chiudere senza leggere.
 */
export async function richiamiDaFareAdesso(): Promise<RigaRichiamo[]> {
  const righe = await prisma.richiamo.findMany({
    where: { stato: 'da_richiamare', prossimoTentativo: { lte: new Date().toISOString() } },
    orderBy: [{ priorita: 'asc' }, { prossimoTentativo: 'asc' }],
    take: 20,
  });
  return righe.map(vestita);
}

/**
 * Com'e' andata la telefonata.
 *
 * «Non risponde» e «ci pensa» non chiudono niente: contano un tentativo e
 * rimandano. Gli altri chiudono, e l'esito resta scritto.
 */
export async function chiudiRichiamo(dati: {
  id: string;
  esito: EsitoRichiamo;
  nota?: string;
  chiusoDa: string;
  /** Per «non risponde» e «ci pensa»: quando riprovare. */
  rimandaA?: string;
}): Promise<{ ok: boolean; errore?: string }> {
  const r = await prisma.richiamo.findUnique({ where: { id: dati.id } });
  if (!r) return { ok: false, errore: 'Non trovato.' };

  const regola = ESITI.find(e => e.id === dati.esito);
  const ora = new Date().toISOString();

  if (regola && !regola.chiude) {
    const dopo = dati.rimandaA
      || new Date(Date.now() + r.ripetiOgniMin * 60_000).toISOString();
    await prisma.richiamo.update({
      where: { id: dati.id },
      data: {
        tentativi: r.tentativi + 1,
        ultimoTentativo: ora,
        prossimoTentativo: dopo,
        esito: dati.esito,
        esitoNota: dati.nota?.trim() || r.esitoNota,
        updatedAt: ora,
      },
    });
    return { ok: true };
  }

  await prisma.richiamo.update({
    where: { id: dati.id },
    data: {
      stato: 'risolto',
      esito: dati.esito,
      esitoNota: dati.nota?.trim() || null,
      tentativi: r.tentativi + 1,
      ultimoTentativo: ora,
      chiusoDa: dati.chiusoDa,
      chiusoIl: ora,
      updatedAt: ora,
    },
  });
  return { ok: true };
}

/** «Non adesso»: si sposta avanti senza contare un tentativo. */
export async function rimandaRichiamo(id: string, quando: string): Promise<{ ok: boolean }> {
  await prisma.richiamo.update({
    where: { id },
    data: { prossimoTentativo: quando, updatedAt: new Date().toISOString() },
  }).catch(() => null);
  return { ok: true };
}

/** Si riapre: capita di chiudere quello sbagliato. */
export async function riapriRichiamo(id: string): Promise<{ ok: boolean }> {
  const ora = new Date().toISOString();
  await prisma.richiamo.update({
    where: { id },
    data: { stato: 'da_richiamare', chiusoIl: null, chiusoDa: null, prossimoTentativo: ora, updatedAt: ora },
  }).catch(() => null);
  return { ok: true };
}

export async function eliminaRichiamo(id: string): Promise<{ ok: boolean }> {
  await prisma.richiamo.delete({ where: { id } }).catch(() => null);
  return { ok: true };
}

export interface ContiRichiami {
  aperti: number;
  adesso: number;
  prenotati30gg: number;
  chiusi30gg: number;
}

/** Due numeri per capire se queste telefonate servono. */
export async function contiRichiami(): Promise<ContiRichiami> {
  const ora = new Date().toISOString();
  const trentaGiorniFa = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [aperti, adesso, prenotati30gg, chiusi30gg] = await Promise.all([
    prisma.richiamo.count({ where: { stato: 'da_richiamare' } }),
    prisma.richiamo.count({ where: { stato: 'da_richiamare', prossimoTentativo: { lte: ora } } }),
    prisma.richiamo.count({ where: { stato: 'risolto', esito: 'prenotato', chiusoIl: { gte: trentaGiorniFa } } }),
    prisma.richiamo.count({ where: { stato: 'risolto', chiusoIl: { gte: trentaGiorniFa } } }),
  ]);
  return { aperti, adesso, prenotati30gg, chiusi30gg };
}
