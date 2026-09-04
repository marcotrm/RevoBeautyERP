'use server';

import { prisma } from '@/lib/prisma';
import { problemaDataNascita } from '@/lib/dataNascita';
import { Client } from '@/types';

/**
 * L'anagrafica, dall'ultima registrata alla prima.
 *
 * Prima era in ordine alfabetico, che è comodo solo se sai già chi cerchi —
 * e per quello c'è la ricerca. Aprendo la pagina interessa vedere chi è
 * arrivato di recente. A parità di giorno vale l'id, che nasce in ordine di
 * creazione: così anche fra due registrate lo stesso pomeriggio l'ultima
 * arrivata sta sopra.
 */
export async function getClients() {
  const clients = await prisma.client.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
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
  /*
    La data di nascita si controlla QUI, non solo a schermo.

    Le sei date assurde in anagrafica non sono entrate tutte dalla stessa
    finestra: c'e' il modulo del consenso, il check-in, l'app, e domani ci
    sara' un'altra porta. Un controllo scritto su ogni porta e' un controllo
    che prima o poi qualcuno dimentica di scrivere.
  */
  const problema = problemaDataNascita(data.birthDate || '');
  if (problema) throw new Error(`DATA_NASCITA: ${problema}`);

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
  /*
    In modifica si blocca solo quello che si sta SCRIVENDO adesso.

    Le sei date assurde sono gia' in archivio: se rifiutassimo qualsiasi
    salvataggio che se le porta dietro, correggere il numero di telefono di
    Alessia Russo diventerebbe impossibile finche' qualcuno non indovina il
    suo anno di nascita — e chi sta al banco vedrebbe solo un salvataggio che
    non va, senza capire perche'. Quelle vecchie restano segnate come «dati da
    completare» e si sistemano al primo check-in, con la persona davanti.
  */
  if (updates.birthDate) {
    const problema = problemaDataNascita(updates.birthDate);
    if (problema) {
      const prima = await prisma.client.findUnique({ where: { id }, select: { birthDate: true } });
      if (prima?.birthDate !== updates.birthDate) throw new Error(`DATA_NASCITA: ${problema}`);
    }
  }

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
