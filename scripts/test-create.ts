import { prisma } from '../src/lib/prisma';
import { createAppointment } from '../src/app/actions/agenda';

async function main() {
  const apt = await createAppointment({
    clientId: 'c1',
    clientName: 'Test Client',
    operatorId: 'o1',
    operatorName: 'Test Operator',
    treatmentId: 't1',
    treatmentName: 'Test Treatment',
    treatmentCategory: 'facial',
    date: '2026-05-30',
    startTime: '12:00',
    endTime: '13:00',
    duration: 60,
    price: 50,
    status: 'confirmed',
    color: '#000000',
    locationId: 'loc1',
    notes: 'Test note',
    isLocked: false,
    roomId: null
  });
  console.log("Created apt:", apt);
}

main().catch(console.error);
