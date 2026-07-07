'use server';

import { prisma } from '@/lib/prisma';
import { Client } from '@/types';

export async function getClients() {
  const clients = await prisma.client.findMany({ orderBy: { lastName: 'asc' } });
  return clients as unknown as Client[];
}

export async function createClient(
  data: Omit<Client, 'id' | 'createdAt' | 'totalSpent' | 'visitCount' | 'avgTicket' | 'loyaltyPoints' | 'cashback'>
) {
  const client = await prisma.client.create({
    data: {
      ...data,
      customTreatments: data.customTreatments ? JSON.parse(JSON.stringify(data.customTreatments)) : [],
      createdAt: new Date().toISOString().split('T')[0],
      totalSpent: 0,
      visitCount: 0,
      avgTicket: 0,
      loyaltyPoints: 0,
      cashback: 0,
    },
  });
  return client as unknown as Client;
}

export async function updateClient(id: string, updates: Partial<Client>) {
  const { customTreatments, ...rest } = updates;
  const client = await prisma.client.update({
    where: { id },
    data: {
      ...rest,
      ...(customTreatments !== undefined
        ? { customTreatments: JSON.parse(JSON.stringify(customTreatments)) }
        : {}),
    },
  });
  return client as unknown as Client;
}

export async function deleteClient(id: string) {
  await prisma.client.delete({ where: { id } });
  return true;
}
