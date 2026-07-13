'use server';

import { prisma } from '@/lib/prisma';
import { AgendaBlock } from '@/types';

export async function getBlocks() {
  const blocks = await prisma.agendaBlock.findMany({
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  return blocks as AgendaBlock[];
}

export async function createBlock(data: Omit<AgendaBlock, 'id' | 'createdAt'>) {
  const block = await prisma.agendaBlock.create({
    data: {
      operatorId: data.operatorId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      reason: data.reason || null,
      createdAt: new Date().toISOString(),
    },
  });
  return block as AgendaBlock;
}

export async function deleteBlock(id: string) {
  await prisma.agendaBlock.delete({ where: { id } });
  return true;
}
