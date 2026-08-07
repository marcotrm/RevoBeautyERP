// Dashboard Clienti — tipi e calcoli derivati.
//
// I dati arrivano da `actions/clientAnalytics.ts`, che li ricostruisce dal
// database. Qui restano solo l'interfaccia e le funzioni pure che riordinano
// e raggruppano quell'elenco: nessun dato inventato.

export interface ClientAnalytics {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  joinDate: string;
  lastVisitDate: string;
  totalRevenue: number;
  revenue12Months: number;
  revenueThisMonth: number;
  revenueThisYear: number;
  totalAppointments: number;
  appointments12Months: number;
  appointmentsThisMonth: number;
  avgTicket: number;
  daysSinceLastVisit: number;
  avgDaysBetweenVisits: number;
  preferredTreatment: string;
  lastTreatment: string;
  preferredOperator: string;
  source: string; // provenienza: etichetta assegnata in anagrafica
  birthDate: string;
  loyaltyLevel: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'VIP';
  rfmSegment: 'VIP' | 'Fedeli' | 'Regolari' | 'Occasionali' | 'Da recuperare' | 'Persi';
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  churnProbability: number;
  hasPackage: boolean;
  isNew: boolean;
  noShowCount: number;
  cancelledCount: number;
  totalBooked: number;
  reliabilityScore: number; // 0-100, higher = more reliable
}

export function getKPIs(clients: ClientAnalytics[]) {
  const active90 = clients.filter(c => c.daysSinceLastVisit <= 90);
  const inactive = clients.filter(c => c.daysSinceLastVisit > 90);
  const newMonth = clients.filter(c => c.isNew);
  const totalRev = clients.reduce((s, c) => s + c.totalRevenue, 0);
  const monthRev = clients.reduce((s, c) => s + c.revenueThisMonth, 0);
  const yearRev = clients.reduce((s, c) => s + c.revenueThisYear, 0);
  const avgTicket = clients.length > 0 ? Math.round(clients.reduce((s, c) => s + c.avgTicket, 0) / clients.length) : 0;
  const totalAppts = clients.reduce((s, c) => s + c.totalAppointments, 0);
  const avgFreq = clients.length > 0 ? +(totalAppts / clients.length).toFixed(1) : 0;
  const avgDays = clients.filter(c => c.avgDaysBetweenVisits > 0).length > 0
    ? Math.round(clients.filter(c => c.avgDaysBetweenVisits > 0).reduce((s, c) => s + c.avgDaysBetweenVisits, 0) / clients.filter(c => c.avgDaysBetweenVisits > 0).length)
    : 0;
  const returning = clients.filter(c => c.totalAppointments > 1).length;
  const returnRate = clients.length > 0 ? Math.round((returning / clients.length) * 100) : 0;
  const loyal = clients.filter(c => c.totalAppointments >= 5 && c.daysSinceLastVisit <= 60).length;
  const retentionRate = clients.length > 0 ? Math.round((loyal / clients.length) * 100) : 0;

  return {
    totalClients: clients.length,
    activeClients90Days: active90.length,
    inactiveClients: inactive.length,
    newClientsMonth: newMonth.length,
    avgClientValue: clients.length > 0 ? Math.round(totalRev / clients.length) : 0,
    monthlyRevenue: monthRev,
    yearlyRevenue: yearRev,
    avgTicket,
    avgVisitFrequency: avgFreq,
    avgDaysBetweenVisits: avgDays,
    returnRate,
    retentionRate,
  };
}

export function getTopClients(clients: ClientAnalytics[], limit = 10) {
  return [...clients].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, limit);
}

export function getAtRiskClients(clients: ClientAnalytics[], threshold: 30 | 60 | 90) {
  return clients.filter(c => c.daysSinceLastVisit > threshold && c.totalAppointments >= 2)
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
}

const rfmColors: Record<string, string> = {
  'VIP': '#8B5CF6', 'Fedeli': '#22C55E', 'Regolari': '#3B82F6',
  'Occasionali': '#F59E0B', 'Da recuperare': '#F97316', 'Persi': '#EF4444',
};

export function getRFMDistribution(clients: ClientAnalytics[]) {
  const segments = ['VIP', 'Fedeli', 'Regolari', 'Occasionali', 'Da recuperare', 'Persi'];
  return segments.map(seg => ({
    segment: seg,
    count: clients.filter(c => c.rfmSegment === seg).length,
    revenue: clients.filter(c => c.rfmSegment === seg).reduce((s, c) => s + c.totalRevenue, 0),
    color: rfmColors[seg] || '#888',
  }));
}

export function getRevenueDistribution(clients: ClientAnalytics[]) {
  const ranges = [
    { range: '0-100€', min: 0, max: 100 },
    { range: '100-300€', min: 100, max: 300 },
    { range: '300-500€', min: 300, max: 500 },
    { range: '500-1.000€', min: 500, max: 1000 },
    { range: 'Oltre 1.000€', min: 1000, max: Infinity },
  ];
  return ranges.map(r => ({
    range: r.range,
    count: clients.filter(c => c.totalRevenue >= r.min && c.totalRevenue < r.max).length,
    revenue: clients.filter(c => c.totalRevenue >= r.min && c.totalRevenue < r.max).reduce((s, c) => s + c.totalRevenue, 0),
  }));
}

export function getParetoData(clients: ClientAnalytics[]) {
  const sorted = [...clients].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const totalRev = sorted.reduce((s, c) => s + c.totalRevenue, 0);
  let cumRev = 0;
  return sorted.map((c, i) => {
    cumRev += c.totalRevenue;
    return {
      clientPercent: Math.round(((i + 1) / sorted.length) * 100),
      revenuePercent: Math.round((cumRev / totalRev) * 100),
      name: `${c.firstName} ${c.lastName.charAt(0)}.`,
    };
  });
}

export function getUpsellOpportunities(clients: ClientAnalytics[]) {
  return [
    {
      type: 'Spendono molto, vengono poco',
      icon: '💰',
      suggestion: 'Proponi un abbonamento mensile con sconto del 15% per aumentare la frequenza',
      clients: clients.filter(c => c.avgTicket > 100 && c.avgDaysBetweenVisits > 30 && c.totalAppointments >= 3),
    },
    {
      type: 'Vengono spesso, spendono poco',
      icon: '🔄',
      suggestion: 'Suggerisci trattamenti premium o combinazioni per aumentare il ticket medio',
      clients: clients.filter(c => c.avgTicket < 80 && c.avgDaysBetweenVisits < 25 && c.totalAppointments >= 8),
    },
    {
      type: 'Candidati pacchetti',
      icon: '📦',
      suggestion: 'Proponi un pacchetto da 5-10 sedute del trattamento preferito con sconto',
      clients: clients.filter(c => !c.hasPackage && c.totalAppointments >= 5 && c.daysSinceLastVisit <= 30),
    },
    {
      type: 'Candidati abbonamenti',
      icon: '⭐',
      suggestion: 'Abbonamento mensile illimitato per fidelizzare le clienti più assidue',
      clients: clients.filter(c => c.totalAppointments >= 12 && c.avgDaysBetweenVisits <= 20),
    },
  ];
}

export function getAlerts(clients: ClientAnalytics[]) {
  const alerts: { type: 'warning' | 'danger' | 'info' | 'birthday'; message: string; clientName: string; detail: string }[] = [];
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  clients.forEach(c => {
    const name = `${c.firstName} ${c.lastName}`;
    if (c.loyaltyLevel === 'VIP' && c.daysSinceLastVisit > 30) {
      alerts.push({ type: 'danger', message: 'VIP assente da oltre 30 giorni', clientName: name, detail: `Ultima visita ${c.daysSinceLastVisit} giorni fa — Fatturato: €${c.totalRevenue.toLocaleString()}` });
    }
    if (c.daysSinceLastVisit > 90 && c.totalAppointments >= 3) {
      alerts.push({ type: 'danger', message: 'Cliente inattivo da 90+ giorni', clientName: name, detail: `${c.totalAppointments} appuntamenti totali — Rischio abbandono: ${c.churnProbability}%` });
    }
    if (c.totalRevenue > 3000 && c.daysSinceLastVisit > 20 && c.daysSinceLastVisit <= 40) {
      alerts.push({ type: 'warning', message: 'Cliente top sta riducendo la frequenza', clientName: name, detail: `Media ${c.avgDaysBetweenVisits}gg tra visite, ora ${c.daysSinceLastVisit}gg di assenza` });
    }
    // Chi non ha la data di nascita in scheda non genera nessun avviso
    const bMonth = parseInt((c.birthDate || '').split('-')[1] || '');
    if (bMonth === currentMonth) {
      alerts.push({ type: 'birthday', message: 'Compleanno questo mese! 🎂', clientName: name, detail: `Nata il ${c.birthDate} — Invia auguri e offerta speciale` });
    }
  });

  return alerts.sort((a, b) => {
    const order = { danger: 0, warning: 1, birthday: 2, info: 3 };
    return order[a.type] - order[b.type];
  });
}

export function getVisitDistribution(clients: ClientAnalytics[]) {
  const ranges = [
    { range: '1-3 visite', min: 1, max: 3 },
    { range: '4-8 visite', min: 4, max: 8 },
    { range: '9-15 visite', min: 9, max: 15 },
    { range: '16-25 visite', min: 16, max: 25 },
    { range: '26+ visite', min: 26, max: Infinity },
  ];
  return ranges.map(r => ({
    range: r.range,
    count: clients.filter(c => c.totalAppointments >= r.min && c.totalAppointments <= r.max).length,
  }));
}

export function getSourceDistribution(clients: ClientAnalytics[]) {
  const srcMap: Record<string, number> = {};
  clients.forEach(c => { srcMap[c.source] = (srcMap[c.source] || 0) + 1; });
  return Object.entries(srcMap)
    .map(([source, count]) => ({ source, count, percentage: Math.round((count / clients.length) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export const LOYALTY_COLORS: Record<string, string> = {
  'Bronze': '#CD7F32', 'Silver': '#C0C0C0', 'Gold': '#FFD700', 'Platinum': '#E5E4E2', 'VIP': '#8B5CF6',
};
