import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const BASE = 'https://revobeautyerp-production.up.railway.app';
const P = '3990003024';
try {
  await prisma.client.create({ data: { id: `e2e-${P}`, firstName: 'Iris', lastName: 'ClaudeE2E', phone: P, gender: 'female', createdAt: new Date().toISOString() } });
  const tok = (await (await fetch(`${BASE}/api/mobile/auth/request-otp`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ phone: P }) })).json()).token;
  for (const d of ['Quanto costa una manicure?', 'Che trattamenti avete per il viso?', 'Quando posso venire per una pulizia viso la settimana prossima?']) {
    const t0 = Date.now();
    const r = await (await fetch(`${BASE}/api/mobile/ai/chat`, { method: 'POST', headers: {'Content-Type':'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ testo: d }) })).json();
    console.log(`⏱️ ${((Date.now()-t0)/1000).toFixed(1)}s · ${r.messaggio?.testo?.slice(0,55) ?? 'ERRORE ' + JSON.stringify(r).slice(0,80)}`);
  }
  const m = await prisma.aiMessage.findMany({ where: { clientId: `e2e-${P}`, ruolo: 'revo' }, select: { modello: true } });
  console.log('modello:', [...new Set(m.map(x => x.modello))].join(', '));
} finally {
  await prisma.aiMessage.deleteMany({ where: { clientId: `e2e-${P}` } });
  await prisma.appNotification.deleteMany({ where: { clientId: `e2e-${P}` } });
  await prisma.mobileAccount.deleteMany({ where: { clientId: `e2e-${P}` } });
  await prisma.client.deleteMany({ where: { id: `e2e-${P}` } });
  console.log('🧹 pulito');
  await prisma.$disconnect();
}
