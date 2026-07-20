'use server';

import { prisma } from '@/lib/prisma';
import { Appointment } from '@/types';
import { mockOperators, mockTreatments, mockClients } from '@/lib/mock-data';
import { notifyCancellazione } from '@/lib/telegram';

export async function getAppointments() {
  const appointments = await prisma.appointment.findMany({
    orderBy: [
      { date: 'asc' },
      { startTime: 'asc' }
    ]
  });
  return appointments as unknown as Appointment[];
}

export async function createAppointment(data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) {
  const targetClientId = data.clientId || 'waitlist-client';

  // Ensure the client exists
  const existingClient = await prisma.client.findUnique({ where: { id: targetClientId } });
  if (!existingClient) {
    await prisma.client.create({
      data: {
        id: targetClientId,
        firstName: data.clientName.split(' ')[0] || 'Unknown',
        lastName: data.clientName.split(' ').slice(1).join(' ') || '',
        phone: '0000000000',
        createdAt: new Date().toISOString()
      }
    });
  }

  // Ensure the operator exists
  const existingOp = await prisma.operator.findUnique({ where: { id: data.operatorId } });
  if (!existingOp) {
    await prisma.operator.create({
      data: {
        id: data.operatorId,
        firstName: data.operatorName.split(' ')[0] || 'Operatrice',
        lastName: data.operatorName.split(' ').slice(1).join(' ') || '',
        color: '#A855F7',
        isActive: true,
        hireDate: new Date().toISOString().split('T')[0],
      }
    });
  }

  // Ensure the treatment exists
  const existingTr = await prisma.treatment.findUnique({ where: { id: data.treatmentId } });
  if (!existingTr) {
    await prisma.treatment.create({
      data: {
        id: data.treatmentId,
        name: data.treatmentName || 'Nuovo Trattamento',
        category: data.treatmentCategory || 'generico',
        duration: data.duration || 60,
        price: data.price || 0,
        color: data.color || '#F472B6',
        isActive: true,
        requiresRoom: false,
      }
    });
  }

  const { services, ...rest } = data;
  const appointment = await prisma.appointment.create({
    data: {
      ...rest,
      services: services ? JSON.parse(JSON.stringify(services)) : undefined,
      clientId: targetClientId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'dino',
    }
  });
  return appointment as unknown as Appointment;
}

export async function updateAppointmentAction(id: string, updates: Partial<Appointment>) {
  const { services, ...rest } = updates;
  // Solo se stiamo passando ad "annullato": leggo lo stato precedente per notificare una volta sola
  const prev = updates.status === 'cancelled'
    ? await prisma.appointment.findUnique({ where: { id }, select: { status: true } })
    : null;
  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...rest,
      ...(services !== undefined ? { services: services ? JSON.parse(JSON.stringify(services)) : null } : {}),
      updatedAt: new Date().toISOString()
    }
  });
  // Notifica Telegram all'annullamento (non alla modifica del solo motivo)
  if (updates.status === 'cancelled' && prev?.status !== 'cancelled') {
    notifyCancellazione({
      client: appointment.clientName,
      treatment: appointment.treatmentName,
      operator: appointment.operatorName,
      date: appointment.date,
      time: appointment.startTime,
      reason: appointment.cancelReason,
    }).catch(() => {});
  }
  return appointment as unknown as Appointment;
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
