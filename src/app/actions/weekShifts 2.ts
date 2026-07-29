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
