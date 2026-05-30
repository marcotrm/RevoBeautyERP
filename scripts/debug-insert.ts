import { prisma } from '../src/lib/prisma';

async function test() {
  const op = await prisma.operator.findFirst();
  const tr = await prisma.treatment.findFirst();
  const cl = await prisma.client.findFirst();

  console.log("Operator:", op?.id);
  console.log("Treatment:", tr?.id);
  console.log("Client:", cl?.id);

  if (!op || !tr || !cl) return console.log("Missing relations!");

  try {
    const apt = await prisma.appointment.create({
      data: {
        clientId: cl.id,
        clientName: cl.firstName,
        operatorId: op.id,
        operatorName: op.firstName,
        treatmentId: tr.id,
        treatmentName: tr.name,
        treatmentCategory: tr.category,
        date: '2026-05-30',
        startTime: '10:00',
        endTime: '11:00',
        duration: 60,
        price: 50,
        status: 'confirmed',
        color: '#000000',
        locationId: 'loc1',
        isLocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      }
    });
    console.log("Success! Inserted:", apt.id);
  } catch (e) {
    console.error("Error inserting:", e);
  }
}
test().finally(() => prisma.$disconnect());
