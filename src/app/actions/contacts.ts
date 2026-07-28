'use server';

import { prisma } from '@/lib/prisma';

export interface BusinessContactData {
  id: string;
  name: string;
  role: string;
  category: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  vatNumber: string;
  notes: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ContactInput = Partial<Omit<BusinessContactData, 'id' | 'createdAt' | 'updatedAt'>> & { name: string };

const clean = (v: unknown) => String(v ?? '').trim();

export async function getContacts(): Promise<BusinessContactData[]> {
  const rows = await prisma.businessContact.findMany({
    orderBy: [{ favorite: 'desc' }, { name: 'asc' }],
  });
  return rows as unknown as BusinessContactData[];
}

export async function createContact(input: ContactInput): Promise<BusinessContactData> {
  const now = new Date().toISOString();
  const row = await prisma.businessContact.create({
    data: {
      name: clean(input.name),
      role: clean(input.role),
      category: clean(input.category) || 'professionisti',
      company: clean(input.company),
      phone: clean(input.phone),
      email: clean(input.email),
      website: clean(input.website),
      address: clean(input.address),
      vatNumber: clean(input.vatNumber),
      notes: clean(input.notes),
      favorite: !!input.favorite,
      createdAt: now,
      updatedAt: now,
    },
  });
  return row as unknown as BusinessContactData;
}

export async function updateContact(id: string, input: Partial<ContactInput>): Promise<BusinessContactData> {
  const row = await prisma.businessContact.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: clean(input.name) } : {}),
      ...(input.role !== undefined ? { role: clean(input.role) } : {}),
      ...(input.category !== undefined ? { category: clean(input.category) || 'professionisti' } : {}),
      ...(input.company !== undefined ? { company: clean(input.company) } : {}),
      ...(input.phone !== undefined ? { phone: clean(input.phone) } : {}),
      ...(input.email !== undefined ? { email: clean(input.email) } : {}),
      ...(input.website !== undefined ? { website: clean(input.website) } : {}),
      ...(input.address !== undefined ? { address: clean(input.address) } : {}),
      ...(input.vatNumber !== undefined ? { vatNumber: clean(input.vatNumber) } : {}),
      ...(input.notes !== undefined ? { notes: clean(input.notes) } : {}),
      ...(input.favorite !== undefined ? { favorite: !!input.favorite } : {}),
      updatedAt: new Date().toISOString(),
    },
  });
  return row as unknown as BusinessContactData;
}

export async function deleteContact(id: string): Promise<boolean> {
  await prisma.businessContact.delete({ where: { id } });
  return true;
}
