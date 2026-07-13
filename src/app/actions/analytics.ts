'use server';

import { prisma } from '@/lib/prisma';

const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const PAYMENT_COLORS: Record<string, string> = {
  Carta: '#8B5CF6', POS: '#8B5CF6', Contanti: '#3B82F6', Bonifico: '#EC4899',
  Satispay: '#F59E0B', 'Gift Card': '#10B981', Finanziamento: '#F59E0B',
};

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); }

export async function getAnalytics() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const ym = today.slice(0, 7); // YYYY-MM
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const sevenAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const [transactions, appointments, clients, operators, clientPackages] = await Promise.all([
    prisma.posTransaction.findMany(),
    prisma.appointment.findMany(),
    prisma.client.findMany(),
    prisma.operator.findMany({ where: { isActive: true } }),
    prisma.clientPackage.findMany(),
  ]);

  // ---------- FATTURATO (dalla cassa) ----------
  const sum = (arr: { total: number }[]) => arr.reduce((s, t) => s + t.total, 0);
  const daily = sum(transactions.filter(t => t.date === today));
  const weekly = sum(transactions.filter(t => t.date >= sevenAgoStr));
  const monthly = sum(transactions.filter(t => t.date.startsWith(ym)));
  const prevMonthlyRev = sum(transactions.filter(t => t.date.startsWith(prevYm)));
  const total = sum(transactions);
  const avgTicket = transactions.length > 0 ? Math.round(total / transactions.length) : 0;
  const growthPercentage = prevMonthlyRev > 0 ? Math.round(((monthly - prevMonthlyRev) / prevMonthlyRev) * 1000) / 10 : 0;

  // Fatturato per metodo di pagamento
  const payMap: Record<string, number> = {};
  transactions.forEach(t => { payMap[t.paymentMethod] = (payMap[t.paymentMethod] || 0) + t.total; });
  const revenueByPayment = Object.entries(payMap)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, color: PAYMENT_COLORS[name] || '#94A3B8' }));

  // Fatturato ultimi 6 mesi
  const revenueByMonth: { month: string; revenue: number; costs: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    revenueByMonth.push({ month: MONTHS_IT[d.getMonth()], revenue: sum(transactions.filter(t => t.date.startsWith(key))), costs: 0 });
  }

  // ---------- APPUNTAMENTI ----------
  const totalApts = appointments.length;
  const completed = appointments.filter(a => a.status === 'completed').length;
  const cancelled = appointments.filter(a => a.status === 'cancelled').length;
  const noShow = appointments.filter(a => a.status === 'no_show').length;
  const cancelRate = totalApts > 0 ? Math.round(((cancelled + noShow) / totalApts) * 1000) / 10 : 0;
  const completionRate = totalApts > 0 ? Math.round((completed / totalApts) * 100) : 0;

  // ---------- STAFF (da appuntamenti completati) ----------
  const staff = operators.map(op => {
    const opApts = appointments.filter(a => a.operatorId === op.id);
    const opCompleted = opApts.filter(a => a.status === 'completed');
    const revenue = Math.round(opCompleted.reduce((s, a) => s + a.price, 0));
    const productivity = opApts.length > 0 ? Math.round((opCompleted.length / opApts.length) * 100) : 0;
    return { id: op.id, name: `${op.firstName} ${op.lastName}`, revenue, appointments: opApts.length, completed: opCompleted.length, productivity };
  }).sort((a, b) => b.revenue - a.revenue);

  // Ore lavorate (completate) vs ore da contratto
  const staffHours = operators.map(op => {
    const workedMin = appointments
      .filter(a => a.operatorId === op.id && a.status === 'completed')
      .reduce((s, a) => s + (a.duration || 0), 0);
    const workedHours = Math.round(workedMin / 60 * 10) / 10;
    const contract = (op as unknown as { contractHours?: number }).contractHours || 0;
    const usePercent = contract > 0 ? Math.min(100, Math.round((workedHours / contract) * 100)) : 0;
    return { name: `${op.firstName} ${op.lastName}`, contract, workedHours, usePercent };
  });

  // ---------- TRATTAMENTI (da services o treatmentName) ----------
  type Row = { name: string; count: number; revenue: number; countThis: number; countPrev: number };
  const trMap: Record<string, Row> = {};
  appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').forEach(a => {
    const services = Array.isArray(a.services) ? (a.services as unknown as { treatmentName: string; price: number }[]) : null;
    const items = services && services.length > 0
      ? services.map(s => ({ name: s.treatmentName, price: s.price }))
      : [{ name: a.treatmentName, price: a.price }];
    items.forEach(it => {
      if (!trMap[it.name]) trMap[it.name] = { name: it.name, count: 0, revenue: 0, countThis: 0, countPrev: 0 };
      trMap[it.name].count += 1;
      trMap[it.name].revenue += it.price;
      if (a.date.startsWith(ym)) trMap[it.name].countThis += 1;
      if (a.date.startsWith(prevYm)) trMap[it.name].countPrev += 1;
    });
  });
  const trend = (r: Row) => {
    if (r.countPrev === 0) return r.countThis > 0 ? '+100%' : '—';
    const pct = Math.round(((r.countThis - r.countPrev) / r.countPrev) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  };
  const allTr = Object.values(trMap);
  const mapTr = (r: Row, i: number) => ({
    id: `${i}`, name: r.name, count: r.count, revenue: Math.round(r.revenue),
    avgPrice: r.count > 0 ? Math.round(r.revenue / r.count) : 0, trend: trend(r),
  });
  const topSold = [...allTr].sort((a, b) => b.count - a.count).slice(0, 5).map(mapTr);
  const leastSold = [...allTr].sort((a, b) => a.count - b.count).slice(0, 5).map(mapTr);

  // ---------- PACCHETTI ----------
  const pkgSold = clientPackages.length;
  const usedSessions = clientPackages.reduce((s, cp) => s + cp.usedSessions, 0);
  const in30 = new Date(now); in30.setDate(now.getDate() + 30);
  const in30Str = in30.toISOString().split('T')[0];
  const expiring = clientPackages.filter(cp => (cp.totalSessions - cp.usedSessions) > 0 && cp.expiryDate <= in30Str).length;
  const residualValue = Math.round(clientPackages.reduce((s, cp) => {
    const perSession = cp.totalSessions > 0 ? cp.pricePaid / cp.totalSessions : 0;
    return s + perSession * Math.max(0, cp.totalSessions - cp.usedSessions);
  }, 0));

  // ---------- CLIENTI ----------
  const daysAgo = (n: number) => { const d = new Date(now); d.setDate(now.getDate() - n); return d.toISOString().split('T')[0]; };
  const d30 = daysAgo(30), d60 = daysAgo(60), d90 = daysAgo(90);
  // Ultima visita reale per cliente (da appuntamenti completati)
  const lastVisitByClient: Record<string, string> = {};
  appointments.filter(a => a.status === 'completed').forEach(a => {
    if (!lastVisitByClient[a.clientId] || a.date > lastVisitByClient[a.clientId]) lastVisitByClient[a.clientId] = a.date;
  });
  const clientLast = (c: { id: string; lastVisit: string | null }) => lastVisitByClient[c.id] || (c.lastVisit ? c.lastVisit.slice(0, 10) : null);
  const newClients = clients.filter(c => (c.createdAt || '').slice(0, 7) === ym).length;
  const activeClients = clients.filter(c => { const lv = clientLast(c); return lv && lv >= d60; }).length;
  const inactiveClients = clients.filter(c => { const lv = clientLast(c); return lv && lv < d30 && lv >= d90; }).length;
  const lostClients = clients.filter(c => { const lv = clientLast(c); return lv && lv < d90; }).length;
  const vipClients = clients.filter(c => (c.vipLevel || 0) >= 2).length;

  // Top spenders reali
  const favByClient: Record<string, string> = {};
  const countByClientTr: Record<string, Record<string, number>> = {};
  const apptCountByClient: Record<string, number> = {};
  appointments.filter(a => a.status === 'completed').forEach(a => {
    apptCountByClient[a.clientId] = (apptCountByClient[a.clientId] || 0) + 1;
    countByClientTr[a.clientId] = countByClientTr[a.clientId] || {};
    countByClientTr[a.clientId][a.treatmentName] = (countByClientTr[a.clientId][a.treatmentName] || 0) + 1;
  });
  Object.entries(countByClientTr).forEach(([cid, m]) => {
    favByClient[cid] = Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  });
  const topSpenders = [...clients]
    .filter(c => (c.totalSpent || 0) > 0 || apptCountByClient[c.id])
    .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
    .slice(0, 10)
    .map(c => ({
      id: c.id, name: `${c.firstName} ${c.lastName}`.trim(),
      totalSpent: Math.round(c.totalSpent || 0),
      appointments: apptCountByClient[c.id] || c.visitCount || 0,
      favorite: favByClient[c.id] || '—',
    }));

  const clientSegments = [
    { name: 'Attivi (≤60g)', count: activeClients, color: '#22C55E' },
    { name: 'Inattivi (30-90g)', count: inactiveClients, color: '#F59E0B' },
    { name: 'Persi (>90g)', count: lostClients, color: '#EF4444' },
    { name: 'VIP', count: vipClients, color: '#EC4899' },
    { name: 'Nuovi (mese)', count: newClients, color: '#8B5CF6' },
  ];

  // ---------- AI INSIGHTS (derivati dai dati reali) ----------
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const actions: { type: string; title: string; message: string }[] = [];

  if (staff[0] && staff[0].revenue > 0) strengths.push(`${staff[0].name} è l'operatrice che genera più incasso (${staff[0].revenue.toLocaleString('it-IT')} €).`);
  if (topSold[0]) strengths.push(`Il trattamento più richiesto è "${topSold[0].name}" (${topSold[0].count} sedute, ${topSold[0].revenue.toLocaleString('it-IT')} €).`);
  if (cancelRate <= 5 && totalApts > 0) strengths.push(`Basso tasso di disdette/no-show (${cancelRate}%): la clientela è affidabile.`);
  if (monthly > prevMonthlyRev && prevMonthlyRev > 0) strengths.push(`Fatturato del mese in crescita del ${growthPercentage}% rispetto al mese scorso.`);
  if (strengths.length === 0) strengths.push('Inizia a registrare incassi e appuntamenti: qui compariranno i punti di forza reali del centro.');

  if (cancelRate > 8) weaknesses.push(`Tasso di disdette/no-show alto (${cancelRate}%): valuta acconti alla prenotazione.`);
  const decliners = allTr.filter(r => r.countPrev > 0 && r.countThis < r.countPrev).sort((a, b) => (a.countThis - a.countPrev) - (b.countThis - b.countPrev));
  if (decliners[0]) weaknesses.push(`"${decliners[0].name}" è in calo rispetto al mese scorso (${trend(decliners[0])}).`);
  if (lostClients > 0) weaknesses.push(`${lostClients} clienti non tornano da oltre 90 giorni: da recuperare.`);
  if (expiring > 0) weaknesses.push(`${expiring} pacchetti in scadenza entro 30 giorni con sedute ancora da erogare.`);
  if (weaknesses.length === 0) weaknesses.push('Nessuna criticità rilevante al momento. Continua così!');

  const growers = allTr.filter(r => r.countThis > r.countPrev).sort((a, b) => (b.countThis - b.countPrev) - (a.countThis - a.countPrev));
  if (lostClients > 0) actions.push({ type: 'warning', title: 'Recupero clienti', message: `Hai ${lostClients} clienti che non tornano da oltre 90 giorni. Invia loro un messaggio o una promo di richiamo dal Marketing.` });
  if (growers[0]) actions.push({ type: 'success', title: 'Upselling', message: `"${growers[0].name}" è in crescita: proponilo come aggiunta durante altri trattamenti.` });
  if (staff.length > 1 && staff[0].revenue > 0) actions.push({ type: 'info', title: 'Ottimizzazione staff', message: `${staff[0].name} è la più produttiva: affidale i clienti nuovi o VIP per massimizzare l'incasso.` });
  if (expiring > 0) actions.push({ type: 'warning', title: 'Pacchetti in scadenza', message: `Contatta i ${expiring} clienti con pacchetti in scadenza per fissare le sedute rimaste prima che scadano.` });
  if (actions.length === 0) actions.push({ type: 'info', title: 'Dati in raccolta', message: 'Man mano che registri appuntamenti e incassi, qui compariranno azioni consigliate su misura.' });

  return {
    revenue: { daily, weekly, monthly, total, avgTicket, prevMonth: prevMonthlyRev, growthPercentage },
    revenueByMonth, revenueByPayment,
    treatments: { topSold, leastSold },
    packages: { sold: pkgSold, usedSessions, expiring, residualValue },
    agenda: { totalAppointments: totalApts, completed, cancelled, noShow, cancelRate, completionRate },
    staff, staffHours,
    clients: { newClients, activeClients, inactiveClients, lostClients, vipClients, topSpenders, segments: clientSegments },
    ai: { strengths, weaknesses, actions },
    generatedAt: now.toISOString(),
  };
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
