'use server';

import { prisma } from '@/lib/prisma';
import { Operator } from '@/types';

export async function getOperators() {
  const operators = await prisma.operator.findMany({ orderBy: { firstName: 'asc' } });
  return operators as unknown as Operator[];
}

export async function createOperator(data: Operator) {
  const operator = await prisma.operator.create({
    data: {
      ...data,
      schedule: JSON.parse(JSON.stringify(data.schedule ?? {})),
    },
  });
  return operator as unknown as Operator;
}

export async function updateOperator(id: string, updates: Partial<Operator>) {
  const { schedule, ...rest } = updates;
  const operator = await prisma.operator.update({
    where: { id },
    data: {
      ...rest,
      ...(schedule !== undefined ? { schedule: JSON.parse(JSON.stringify(schedule)) } : {}),
    },
  });
  return operator as unknown as Operator;
}

export async function deleteOperator(id: string) {
  await prisma.operator.delete({ where: { id } });
  return true;
}

/**
 * Chi se ne va, ma quello che ha fatto resta.
 *
 * Cancellare una collaboratrice non si può e non si deve: i suoi appuntamenti,
 * gli incassi e le statistiche di mesi di lavoro sono attaccati a lei. Si mette
 * "non più in servizio": sparisce dall'agenda, dai turni e dalle tendine di chi
 * fa cosa, e resta in tutto lo storico.
 *
 * Prima di toglierla si controlla che non abbia appuntamenti futuri: se ne ha e
 * la si nascondesse, quelle clienti si presenterebbero e in agenda non ci
 * sarebbe più nessuna colonna a dirlo.
 */
export interface AppuntamentoInSospeso {
  id: string;
  data: string;
  ora: string;
  cliente: string;
}

export async function appuntamentiFuturiOperatrice(id: string): Promise<AppuntamentoInSospeso[]> {
  const oggi = new Date().toISOString().slice(0, 10);
  const righe = await prisma.appointment.findMany({
    where: {
      operatorId: id,
      date: { gte: oggi },
      status: { in: ['confirmed', 'pending', 'in_progress', 'in_cabin'] },
    },
    select: { id: true, date: true, startTime: true, clientName: true },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    take: 50,
  });
  return righe.map(r => ({ id: r.id, data: r.date, ora: r.startTime, cliente: r.clientName }));
}

export async function mettiInServizio(id: string, inServizio: boolean): Promise<{
  ok: boolean;
  inSospeso?: AppuntamentoInSospeso[];
}> {
  if (!inServizio) {
    const inSospeso = await appuntamentiFuturiOperatrice(id);
    if (inSospeso.length > 0) return { ok: false, inSospeso };
  }
  await prisma.operator.update({ where: { id }, data: { isActive: inServizio } });
  return { ok: true };
}
