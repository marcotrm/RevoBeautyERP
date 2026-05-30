import { prisma } from '../src/lib/prisma';
import { mockOperators, mockTreatments, mockClients, mockAppointments } from '../src/lib/mock-data';

async function main() {
  console.log('Seeding initial data for agenda...');

  for (const client of mockClients) {
    await prisma.client.upsert({
      where: { id: client.id },
      update: {},
      create: {
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

  for (const operator of mockOperators) {
    await prisma.operator.upsert({
      where: { id: operator.id },
      update: {},
      create: {
        id: operator.id,
        firstName: operator.firstName,
        lastName: operator.lastName,
        color: operator.color,
        isActive: operator.isActive,
        hireDate: operator.hireDate,
      }
    });
  }

  for (const treatment of mockTreatments) {
    await prisma.treatment.upsert({
      where: { id: treatment.id },
      update: {},
      create: {
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

  // Add waitlist client just in case
  await prisma.client.upsert({
    where: { id: 'waitlist-client' },
    update: {},
    create: {
      id: 'waitlist-client',
      firstName: 'Waitlist',
      lastName: 'Client',
      phone: '0000000000',
      createdAt: new Date().toISOString()
    }
  });

  // Also seed mock appointments so the agenda isn't completely empty?
  // Let's do it so the user sees some data.
  for (const apt of mockAppointments) {
    await prisma.appointment.upsert({
      where: { id: apt.id },
      update: {},
      create: {
        id: apt.id,
        clientId: apt.clientId || 'c1',
        clientName: apt.clientName,
        operatorId: apt.operatorId,
        operatorName: apt.operatorName,
        treatmentId: apt.treatmentId,
        treatmentName: apt.treatmentName,
        treatmentCategory: apt.treatmentCategory,
        locationId: apt.locationId,
        date: apt.date,
        startTime: apt.startTime,
        endTime: apt.endTime,
        duration: apt.duration,
        status: apt.status,
        price: apt.price,
        notes: apt.notes,
        isLocked: apt.isLocked,
        color: apt.color,
        createdAt: apt.createdAt || new Date().toISOString(),
        updatedAt: apt.updatedAt || new Date().toISOString(),
        createdBy: apt.createdBy || 'u1',
      }
    });
  }

  console.log('Seeding completed!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
