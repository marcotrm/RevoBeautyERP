'use server';

import { prisma } from '@/lib/prisma';

// Turni per singola settimana. Ogni settimana è indipendente:
// schedule = { [dow 1..6]: { isWorking, startTime, endTime, breakStart?, breakEnd? } }
// I giorni NON presenti nella mappa sono "non impostati" (l'agenda usa il default).
export type WeekDaySchedule = {
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
};
export type WeekScheduleMap = Record<number, WeekDaySchedule>;

/** Turni di tutte le operatrici per la settimana che inizia weekStart (lunedì YYYY-MM-DD). */
export async function getWeekShifts(weekStart: string): Promise<Record<string, WeekScheduleMap>> {
  const rows = await prisma.operatorWeekSchedule.findMany({ where: { weekStart } });
  const map: Record<string, WeekScheduleMap> = {};
  for (const r of rows) map[r.operatorId] = (r.schedule as WeekScheduleMap) ?? {};
  return map;
}

/** Salva/aggiorna il turno di UNA operatrice per UNA settimana. Non tocca le altre settimane. */
export async function saveWeekShift(operatorId: string, weekStart: string, schedule: WeekScheduleMap): Promise<{ ok: boolean }> {
  try {
    await prisma.operatorWeekSchedule.upsert({
      where: { operatorId_weekStart: { operatorId, weekStart } },
      create: { operatorId, weekStart, schedule: schedule as object, updatedAt: new Date().toISOString() },
      update: { schedule: schedule as object, updatedAt: new Date().toISOString() },
    });
    return { ok: true };
  } catch (e) {
    console.error('[weekShifts] salvataggio fallito', e);
    return { ok: false };
  }
}

/** Salva l'intera settimana per più operatrici (usato dall'Agente Turni). */
export async function saveWeekShiftsBulk(weekStart: string, byOperator: Record<string, WeekScheduleMap>): Promise<{ ok: boolean }> {
  try {
    const now = new Date().toISOString();
    await Promise.all(Object.entries(byOperator).map(([operatorId, schedule]) =>
      prisma.operatorWeekSchedule.upsert({
        where: { operatorId_weekStart: { operatorId, weekStart } },
        create: { operatorId, weekStart, schedule: schedule as object, updatedAt: now },
        update: { schedule: schedule as object, updatedAt: now },
      })
    ));
    return { ok: true };
  } catch (e) {
    console.error('[weekShifts] salvataggio bulk fallito', e);
    return { ok: false };
  }
}

/* ============================================================
   MODELLI DI SETTIMANA
   ============================================================ */

/**
 * I turni si ripetono quasi sempre uguali.
 *
 * Ogni lunedì si ricompilava la stessa griglia a mano, casella per casella:
 * sei giorni per tre operatrici sono diciotto caselle da riempire per scrivere
 * quello che c'era già scritto la settimana prima. Qui la settimana si salva
 * col suo nome — "settimana normale", "agosto ridotto", "sotto Natale" — e si
 * riapplica quando serve.
 *
 * Restano modelli, non regole: applicato uno, i turni si continuano a
 * correggere a mano dove quella settimana è diversa.
 */

const KIND_MODELLO = 'turni:modello';

export interface ModelloTurni {
  id: string;
  nome: string;
  /** Quante ore in tutto, per riconoscerlo senza aprirlo. */
  ore: number;
  turni: Record<string, WeekScheduleMap>;
  creatoIl: string;
}

function oreDi(turni: Record<string, WeekScheduleMap>): number {
  let minuti = 0;
  for (const perOperatrice of Object.values(turni)) {
    for (const giorno of Object.values(perOperatrice)) {
      if (!giorno || giorno.isWorking === false || !giorno.startTime || !giorno.endTime) continue;
      const min = (s: string) => {
        const [h, m] = s.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      let d = min(giorno.endTime) - min(giorno.startTime);
      if (giorno.breakStart && giorno.breakEnd) d -= min(giorno.breakEnd) - min(giorno.breakStart);
      minuti += Math.max(0, d);
    }
  }
  return Math.round(minuti / 60);
}

export async function elencoModelliTurni(): Promise<ModelloTurni[]> {
  const righe = await prisma.adminEntry.findMany({ where: { kind: KIND_MODELLO } });
  return righe
    .map(r => r.data as unknown as ModelloTurni)
    .filter(m => m?.id && m?.turni)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function salvaModelloTurni(nome: string, turni: Record<string, WeekScheduleMap>): Promise<{ ok: boolean; error?: string }> {
  const titolo = nome.trim();
  if (!titolo) return { ok: false, error: 'Dai un nome al modello' };
  if (Object.keys(turni).length === 0) return { ok: false, error: 'Questa settimana è vuota: non c\'è niente da salvare' };

  // Il nome è la chiave: risalvare con lo stesso nome aggiorna il modello,
  // che è quello che si vuole dopo aver corretto un orario.
  const id = titolo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const modello: ModelloTurni = {
    id, nome: titolo, ore: oreDi(turni), turni,
    creatoIl: new Date().toISOString(),
  };
  await prisma.adminEntry.upsert({
    where: { rowId: `${KIND_MODELLO}:${id}` },
    update: { data: modello as unknown as object },
    create: {
      rowId: `${KIND_MODELLO}:${id}`, kind: KIND_MODELLO, entityId: id,
      data: modello as unknown as object, createdAt: modello.creatoIl,
    },
  });
  return { ok: true };
}

export async function eliminaModelloTurni(id: string): Promise<{ ok: boolean }> {
  await prisma.adminEntry.delete({ where: { rowId: `${KIND_MODELLO}:${id}` } }).catch(() => {});
  return { ok: true };
}
