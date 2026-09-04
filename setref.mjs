import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const riga = await prisma.appSetting.findUnique({ where: { key: 'app-clienti' } });
const data = (riga?.data && typeof riga.data === 'object') ? riga.data : {};
data.referral = { ...(data.referral || {}), premioInvitante: 5, premioInvitata: 5 };
await prisma.appSetting.upsert({
  where: { key: 'app-clienti' },
  create: { key: 'app-clienti', data, updatedAt: new Date().toISOString() },
  update: { data, updatedAt: new Date().toISOString() },
});
console.log('referral ora:', JSON.stringify(data.referral));
await prisma.$disconnect();
