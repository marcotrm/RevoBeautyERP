'use server';

import { prisma } from '@/lib/prisma';
import { Client } from '@/types';

export async function getClients() {
  const clients = await prisma.client.findMany({ orderBy: { lastName: 'asc' } });
  return clients as unknown as Client[];
}

/** Ultime 9 cifre: confronta i numeri ignorando prefisso, spazi e trattini. */
function codaTelefono(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '').slice(-9);
}

/**
 * Il cliente già in anagrafica con questo numero, se c'è.
 * `escludiId` serve in modifica: il cliente non è doppione di sé stesso.
 */
export async function clienteConStessoNumero(phone: string, escludiId?: string) {
  const coda = codaTelefono(phone);
  if (coda.length < 6) return null; // numero troppo corto: non si può dire
  const clienti = await prisma.client.findMany({
    select: { id: true, firstName: true, lastName: true, phone: true, createdAt: true },
  });
  const trovato = clienti.find(c => c.id !== escludiId && codaTelefono(c.phone) === coda);
  return trovato || null;
}

export async function createClient(
  data: Omit<Client, 'id' | 'createdAt' | 'totalSpent' | 'visitCount' | 'avgTicket' | 'loyaltyPoints' | 'cashback'>
) {
  // Niente doppioni: lo stesso numero non può stare su due schede. È il
  // controllo che vale per TUTTI i punti d'ingresso (clienti, agenda, ovunque),
  // non solo per la finestra che mostra l'avviso.
  const gia = await clienteConStessoNumero(data.phone);
  if (gia) {
    throw new Error(
      `CLIENTE_DOPPIONE: ${`${gia.firstName} ${gia.lastName}`.trim()} è già in anagrafica con questo numero (${gia.phone}).`
    );
  }

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
  // Anche in modifica: non si può spostare un numero su una scheda quando
  // quel numero è già di un'altra cliente.
  if (updates.phone) {
    const gia = await clienteConStessoNumero(updates.phone, id);
    if (gia) {
      throw new Error(
        `CLIENTE_DOPPIONE: ${`${gia.firstName} ${gia.lastName}`.trim()} è già in anagrafica con questo numero (${gia.phone}).`
      );
    }
  }

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
