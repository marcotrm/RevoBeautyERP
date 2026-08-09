'use server';

/**
 * Comandi del pannello "App Clienti" del gestionale.
 *
 * Tutto ciò che nell'app è una regola — percentuali, soglie, premi, quali
 * funzioni sono accese — si cambia da qui. Il principio è quello chiesto fin
 * dall'inizio: cambiare una promozione non deve richiedere di toccare il
 * codice, altrimenti la promozione non si cambia mai.
 */

import { prisma } from '@/lib/prisma';
import { leggiConfig, salvaConfig, type ConfigApp } from '@/lib/appSettings';
import { livelliClub, LIVELLI_DI_PARTENZA } from '@/lib/club';
import { pubblicaSlot, ripulisciScaduti } from '@/lib/flashSlot';
import { accreditaCredito, muoviPunti } from '@/lib/wallet';
import { assegnaBeautyBox } from '@/lib/challenge';
import { leggiStatisticheApp, type StatisticheApp } from '@/lib/appAnalytics';

// ---------- Configurazione ----------

export async function getConfigApp(): Promise<ConfigApp> {
  return leggiConfig();
}

export async function setConfigApp(parziale: Partial<ConfigApp>): Promise<ConfigApp> {
  return salvaConfig(parziale);
}

// ---------- Livelli del Beauty Club ----------

export interface LivelloRiga {
  id: string; name: string; minSpent: number; minVisits: number; color: string;
  cashbackPct: number; pointsFactor: number; flashHeadMin: number;
  perks: string[]; sortOrder: number; isActive: boolean;
  /** Quante clienti si trovano oggi a questo livello. */
  clienti?: number;
}

export async function getLivelli(): Promise<LivelloRiga[]> {
  const righe = await livelliClub();
  return righe.map(l => ({
    id: l.id, name: l.name, minSpent: l.minSpent, minVisits: l.minVisits, color: l.color,
    cashbackPct: l.cashbackPct, pointsFactor: l.pointsFactor, flashHeadMin: l.flashHeadMin,
    perks: l.perks, sortOrder: l.sortOrder, isActive: l.isActive,
  }));
}

export async function salvaLivello(riga: Partial<LivelloRiga> & { id?: string }) {
  const dati = {
    name: riga.name ?? 'Nuovo livello',
    minSpent: Number(riga.minSpent ?? 0),
    minVisits: Number(riga.minVisits ?? 0),
    color: riga.color ?? '#B76E79',
    cashbackPct: Number(riga.cashbackPct ?? 0),
    pointsFactor: Number(riga.pointsFactor ?? 1),
    flashHeadMin: Number(riga.flashHeadMin ?? 0),
    perks: riga.perks ?? [],
    sortOrder: Number(riga.sortOrder ?? 0),
    isActive: riga.isActive ?? true,
  };
  if (riga.id) return prisma.clubLevel.update({ where: { id: riga.id }, data: dati });
  return prisma.clubLevel.create({ data: dati });
}

export async function eliminaLivello(id: string) {
  await prisma.clubLevel.delete({ where: { id } });
  return true;
}

/** Ricrea i livelli di partenza, per chi parte da zero. */
export async function ripristinaLivelli() {
  await prisma.clubLevel.deleteMany({});
  for (const l of LIVELLI_DI_PARTENZA) await prisma.clubLevel.create({ data: l });
  return getLivelli();
}

// ---------- Flash Slot ----------

export interface SlotRiga {
  id: string; date: string; startTime: string; endTime: string;
  treatmentName: string; operatorName: string;
  fullPrice: number; price: number; status: string; expiresAt: string;
  takenByClientId: string | null; takenAt: string | null;
}

export async function getFlashSlot(): Promise<SlotRiga[]> {
  await ripulisciScaduti();
  const righe = await prisma.flashSlot.findMany({
    orderBy: [{ createdAt: 'desc' }],
    take: 60,
  });
  return righe.map(s => ({
    id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime,
    treatmentName: s.treatmentName, operatorName: s.operatorName,
    fullPrice: s.fullPrice, price: s.price, status: s.status, expiresAt: s.expiresAt,
    takenByClientId: s.takenByClientId, takenAt: s.takenAt,
  }));
}

/**
 * Trova i buchi in agenda dei prossimi giorni: le fasce libere fra due
 * appuntamenti, negli orari in cui l'operatrice sta comunque in negozio.
 * Sono quelle che altrimenti non si riempirebbero mai.
 */
export async function buchiInAgenda(): Promise<{
  date: string; startTime: string; endTime: string; operatorId: string; operatorName: string; minuti: number;
}[]> {
  const config = await leggiConfig();
  const adesso = new Date();
  const fino = new Date(adesso.getTime() + config.flashSlot.orizzonteOre * 3600_000);
  const oggi = adesso.toISOString().slice(0, 10);
  const ultimo = fino.toISOString().slice(0, 10);

  const [appuntamenti, operatrici] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: { gte: oggi, lte: ultimo }, status: { notIn: ['cancelled'] } },
      select: { date: true, startTime: true, endTime: true, operatorId: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.operator.findMany({ where: { isActive: true, isResource: false }, select: { id: true, firstName: true, lastName: true } }),
  ]);

  const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const buchi: { date: string; startTime: string; endTime: string; operatorId: string; operatorName: string; minuti: number }[] = [];

  const giorni = [...new Set(appuntamenti.map(a => a.date))];
  for (const g of giorni) {
    for (const op of operatrici) {
      const suoi = appuntamenti
        .filter(a => a.date === g && a.operatorId === op.id)
        .sort((a, b) => min(a.startTime) - min(b.startTime));
      // Senza almeno due appuntamenti non c'è un "fra", c'è solo una giornata
      // vuota: quella non è un buco da riempire ma un problema diverso.
      if (suoi.length < 2) continue;

      for (let i = 1; i < suoi.length; i++) {
        const fine = min(suoi[i - 1].endTime);
        const inizio = min(suoi[i].startTime);
        const durata = inizio - fine;
        if (durata < 30) continue; // sotto la mezz'ora non ci sta nulla

        const quandoInizia = new Date(`${g}T${hhmm(fine)}:00`);
        const minutiDaOra = (quandoInizia.getTime() - adesso.getTime()) / 60000;
        if (minutiDaOra < config.flashSlot.anticipoMinimoMinuti) continue;

        buchi.push({
          date: g, startTime: hhmm(fine), endTime: hhmm(inizio),
          operatorId: op.id, operatorName: `${op.firstName} ${op.lastName}`.trim(), minuti: durata,
        });
      }
    }
  }

  return buchi.sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? -1 : 1)).slice(0, 30);
}

export async function creaFlashSlot(params: {
  date: string; startTime: string; endTime: string;
  treatmentId: string; operatorId: string; operatorName: string;
  price?: number; minLevelOrder?: number;
}) {
  const trattamento = await prisma.treatment.findUnique({ where: { id: params.treatmentId } });
  if (!trattamento) throw new Error('Trattamento non trovato');

  return pubblicaSlot({
    date: params.date,
    startTime: params.startTime,
    endTime: params.endTime,
    treatmentId: trattamento.id,
    treatmentName: trattamento.name,
    operatorId: params.operatorId,
    operatorName: params.operatorName,
    fullPrice: trattamento.priceFemale ?? trattamento.price,
    price: params.price,
    minLevelOrder: params.minLevelOrder,
    createdBy: 'gestionale',
  });
}

export async function chiudiFlashSlot(id: string) {
  await prisma.flashSlot.update({ where: { id }, data: { status: 'cancelled' } });
  return true;
}

// ---------- Sfide ----------

export async function getSfide() {
  const righe = await prisma.challenge.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { progress: true } } },
  });
  return righe.map(c => ({
    id: c.id, title: c.title, description: c.description,
    goalType: c.goalType, goalCount: c.goalCount,
    rewardType: c.rewardType, rewardValue: c.rewardValue, rewardLabel: c.rewardLabel,
    startsAt: c.startsAt, endsAt: c.endsAt, isActive: c.isActive,
    partecipanti: c._count.progress,
  }));
}

export async function salvaSfida(c: {
  id?: string; title: string; description: string;
  goalType: string; goalCount: number;
  rewardType: string; rewardValue: number; rewardLabel: string;
  startsAt: string; endsAt: string; isActive: boolean;
}) {
  const dati = {
    title: c.title, description: c.description,
    goalType: c.goalType, goalCount: Number(c.goalCount),
    rewardType: c.rewardType, rewardValue: Number(c.rewardValue), rewardLabel: c.rewardLabel,
    startsAt: c.startsAt, endsAt: c.endsAt, isActive: c.isActive,
  };
  if (c.id) return prisma.challenge.update({ where: { id: c.id }, data: dati });
  return prisma.challenge.create({ data: { ...dati, createdAt: new Date().toISOString() } });
}

export async function eliminaSfida(id: string) {
  await prisma.challenge.delete({ where: { id } });
  return true;
}

// ---------- Premi ----------

export async function getPremi() {
  const righe = await prisma.prize.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { wins: true } } },
  });
  const totalePesi = righe.filter(p => p.isActive).reduce((s, p) => s + Math.max(1, p.weight), 0) || 1;
  return righe.map(p => ({
    id: p.id, name: p.name, kind: p.kind, value: p.value,
    weight: p.weight, stock: p.stock, validDays: p.validDays, isActive: p.isActive,
    vinti: p._count.wins,
    /** Probabilità reale, calcolata dai pesi: è il numero che serve leggere. */
    probabilita: p.isActive ? Math.round((Math.max(1, p.weight) / totalePesi) * 100) : 0,
  }));
}

export async function salvaPremio(p: {
  id?: string; name: string; kind: string; value: number;
  weight: number; stock: number | null; validDays: number; isActive: boolean;
}) {
  const dati = {
    name: p.name, kind: p.kind, value: Number(p.value),
    weight: Number(p.weight), stock: p.stock === null ? null : Number(p.stock),
    validDays: Number(p.validDays), isActive: p.isActive,
  };
  if (p.id) return prisma.prize.update({ where: { id: p.id }, data: dati });
  return prisma.prize.create({ data: { ...dati, createdAt: new Date().toISOString() } });
}

export async function eliminaPremio(id: string) {
  await prisma.prize.delete({ where: { id } });
  return true;
}

/** Regala una Beauty Box a una cliente, a mano. */
export async function regalaBeautyBox(clientId: string) {
  const id = await assegnaBeautyBox(clientId, 'manual');
  return { ok: !!id };
}

// ---------- Credito e punti a mano ----------

export async function accreditaAMano(params: {
  clientId: string; tipo: 'credito' | 'punti'; importo: number;
  motivo: string; validoGiorni?: number; operatore?: string;
}) {
  if (params.tipo === 'punti') {
    await muoviPunti({
      clientId: params.clientId, punti: params.importo,
      motivo: params.motivo, sourceType: 'manual', operator: params.operatore,
    });
  } else {
    await accreditaCredito({
      clientId: params.clientId, importo: params.importo, bucket: 'compensation',
      motivo: params.motivo, sourceType: 'manual', validoGiorni: params.validoGiorni,
      operator: params.operatore,
    });
  }
  return true;
}

// ---------- Referral ----------

export async function getReferral() {
  const righe = await prisma.referral.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const invitanti = await prisma.client.findMany({
    where: { id: { in: righe.map(r => r.inviterClientId) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nome = new Map(invitanti.map(c => [c.id, `${c.firstName} ${c.lastName}`.trim()]));
  return righe.map(r => ({
    id: r.id,
    invitante: nome.get(r.inviterClientId) ?? '—',
    invitata: r.invitedName ?? '—',
    telefono: r.invitedPhone,
    stato: r.status,
    quando: r.createdAt,
    convertita: r.convertedAt,
  }));
}

// ---------- Statistiche ----------

export async function getStatisticheApp(giorni = 30): Promise<StatisticheApp> {
  return leggiStatisticheApp(giorni);
}
