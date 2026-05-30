'use server';

import { prisma } from '@/lib/prisma';
import { Appointment } from '@/types';
import { mockOperators, mockTreatments, mockClients } from '@/lib/mock-data';

export async function getAppointments() {
  const appointments = await prisma.appointment.findMany({
    orderBy: [
      { date: 'asc' },
      { startTime: 'asc' }
    ]
  });
  return appointments as Appointment[];
}

export async function createAppointment(data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) {
  // Ensure the dummy client exists if the ID doesn't exist
  if (data.clientId === 'waitlist-client' || !data.clientId) {
    const existing = await prisma.client.findFirst({ where: { id: 'waitlist-client' } });
    if (!existing) {
      await prisma.client.create({
        data: {
          id: 'waitlist-client',
          firstName: 'Waitlist',
          lastName: 'Client',
          phone: '0000000000',
          createdAt: new Date().toISOString()
        }
      });
    }
  }

  const appointment = await prisma.appointment.create({
    data: {
      ...data,
      clientId: data.clientId || 'waitlist-client',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'dino',
    }
  });
  return appointment as Appointment;
}

export async function updateAppointmentAction(id: string, updates: Partial<Appointment>) {
  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...updates,
      updatedAt: new Date().toISOString()
    }
  });
  return appointment as Appointment;
}

export async function deleteAppointmentAction(id: string) {
  await prisma.appointment.delete({
    where: { id }
  });
  return true;
}

export async function seedAgendaData() {
  console.log('Seeding initial data for agenda...');
  
  // Seed Clients
  for (const client of mockClients) {
    const exists = await prisma.client.findUnique({ where: { id: client.id } });
    if (!exists) {
      await prisma.client.create({
        data: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email || null,
          phone: client.phone,
          birthDate: client.birthDate || null,
          gender: client.gender || null,
          address: client.address || null,
          city: client.city || null,
          notes: client.notes || null,
          privateNotes: client.privateNotes || null,
          allergies: client.allergies || null,
          vipLevel: client.vipLevel || 0,
          loyaltyPoints: client.loyaltyPoints || 0,
          createdAt: client.createdAt,
          lastVisit: client.lastVisit || null,
          totalSpent: client.totalSpent || 0,
          visitCount: client.visitCount || 0
        }
      });
    }
  }

  // Seed Operators
  for (const operator of mockOperators) {
    const exists = await prisma.operator.findUnique({ where: { id: operator.id } });
    if (!exists) {
      await prisma.operator.create({
        data: {
          id: operator.id,
          firstName: operator.firstName,
          lastName: operator.lastName,
          color: operator.color,
          isActive: operator.isActive,
          hireDate: operator.hireDate,
        }
      });
    }
  }

  // Seed Treatments
  for (const treatment of mockTreatments) {
    const exists = await prisma.treatment.findUnique({ where: { id: treatment.id } });
    if (!exists) {
      await prisma.treatment.create({
        data: {
          id: treatment.id,
          name: treatment.name,
          category: treatment.category,
          duration: treatment.duration,
          price: treatment.price,
          description: treatment.description || null,
          requiresRoom: treatment.requiresRoom,
          color: treatment.color,
          isActive: treatment.isActive
        }
      });
    }
  }

  return true;
}
