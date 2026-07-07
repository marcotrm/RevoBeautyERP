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
