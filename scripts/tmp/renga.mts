import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const c = await p.client.findFirst({ where: { firstName: { contains: 'Francesca', mode: 'insensitive' }, lastName: { contains: 'Renga', mode: 'insensitive' } } });
console.log('cliente:', c?.id, c?.firstName, c?.lastName, '| tel:', c?.phone);
const app = await p.appointment.findMany({ where: { clientName: { contains: 'Renga', mode: 'insensitive' } }, orderBy: { date: 'desc' }, take: 6 });
for (const a of app) console.log(' APP', a.id, a.date, a.startTime, a.treatmentName, '| stato:', a.status, '| aggiornato:', a.updatedAt, '| motivo:', a.cancelReason);
const tel = (c?.phone || '').replace(/\D/g, '');
const coda = tel.slice(-9);
const msg = await p.adminEntry.findMany({ where: { kind: 'wa_msg' }, orderBy: { createdAt: 'desc' }, take: 300 });
const suoi = msg.filter(m => m.entityId.endsWith(coda));
console.log('messaggi con lei:', suoi.length);
for (const m of suoi.reverse().slice(-14)) {
  const d = m.data as any;
  console.log(' ', m.createdAt, (d.direction || d.dir || '?').padEnd(4), JSON.stringify(d.text || d.body || '').slice(0, 200));
}
await p.$disconnect();
