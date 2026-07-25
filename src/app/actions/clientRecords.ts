'use server';

import { prisma } from '@/lib/prisma';

export interface ClientPhoto {
  id: string;
  clientId: string;
  kind: string; // 'before' | 'after' | 'document'
  data: string; // data URL base64
  label?: string | null;
  treatment?: string | null;
  createdAt: string;
}

export interface ClientConsent {
  id: string;
  clientId: string;
  title: string;
  signatureData?: string | null;
  signedAt: string;
  notes?: string | null;
}

// Scheda anamnesi/tecnica: struttura libera salvata come JSON sul cliente.
export type MedicalRecord = Record<string, unknown>;

export interface ClientRecord {
  medicalRecord: MedicalRecord | null;
  photos: ClientPhoto[];
  consents: ClientConsent[];
}

export async function getClientRecord(clientId: string): Promise<ClientRecord> {
  const [client, photos, consents] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { medicalRecord: true } }),
    prisma.clientPhoto.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } }),
    prisma.clientConsent.findMany({ where: { clientId }, orderBy: { signedAt: 'desc' } }),
  ]);
  return {
    medicalRecord: (client?.medicalRecord as MedicalRecord) ?? null,
    photos: photos as ClientPhoto[],
    consents: consents as ClientConsent[],
  };
}

export async function updateMedicalRecord(clientId: string, record: MedicalRecord): Promise<boolean> {
  await prisma.client.update({
    where: { id: clientId },
    data: { medicalRecord: JSON.parse(JSON.stringify(record)) },
  });
  return true;
}

export async function addClientPhoto(data: {
  clientId: string; kind: string; data: string; label?: string; treatment?: string;
}): Promise<ClientPhoto> {
  const row = await prisma.clientPhoto.create({
    data: {
      clientId: data.clientId,
      kind: data.kind || 'before',
      data: data.data,
      label: data.label || null,
      treatment: data.treatment || null,
      createdAt: new Date().toISOString(),
    },
  });
  return row as ClientPhoto;
}

export async function deleteClientPhoto(id: string): Promise<boolean> {
  await prisma.clientPhoto.delete({ where: { id } });
  return true;
}

export async function addClientConsent(data: {
  clientId: string; title: string; signatureData?: string; notes?: string;
}): Promise<ClientConsent> {
  const row = await prisma.clientConsent.create({
    data: {
      clientId: data.clientId,
      title: data.title,
      signatureData: data.signatureData || null,
      notes: data.notes || null,
      signedAt: new Date().toISOString(),
    },
  });
  return row as ClientConsent;
}

export async function deleteClientConsent(id: string): Promise<boolean> {
  await prisma.clientConsent.delete({ where: { id } });
  return true;
}
