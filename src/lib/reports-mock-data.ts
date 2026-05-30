export const REVENUE_DATA = {
  daily: 1250,
  weekly: 8400,
  monthly: 36500,
  annual: 420000,
  previousMonth: 32000,
  growthPercentage: 14.06,
  avgTicket: 85,
};

export const REVENUE_BY_MONTH = [
  { month: 'Gen', revenue: 28000, costs: 18000 },
  { month: 'Feb', revenue: 31000, costs: 19000 },
  { month: 'Mar', revenue: 34500, costs: 19500 },
  { month: 'Apr', revenue: 32000, costs: 18500 },
  { month: 'Mag', revenue: 36500, costs: 20000 },
  { month: 'Giu', revenue: 41000, costs: 22000 },
];

export const REVENUE_BY_PAYMENT = [
  { name: 'POS', value: 24500, color: '#8B5CF6' },
  { name: 'Contanti', value: 8000, color: '#3B82F6' },
  { name: 'Bonifico', value: 2500, color: '#EC4899' },
  { name: 'Finanziamento', value: 1000, color: '#F59E0B' },
  { name: 'Gift Card', value: 500, color: '#10B981' },
];

export const TREATMENTS_DATA = {
  topSold: [
    { id: '1', name: 'Epilazione Laser Total Body', count: 145, revenue: 11600, avgPrice: 80, trend: '+15%' },
    { id: '2', name: 'Pulizia Viso Profonda', count: 120, revenue: 6000, avgPrice: 50, trend: '+5%' },
    { id: '3', name: 'Pressoterapia', count: 95, revenue: 3800, avgPrice: 40, trend: '-2%' },
    { id: '4', name: 'Massaggio Drenante 50min', count: 85, revenue: 5100, avgPrice: 60, trend: '+12%' },
    { id: '5', name: 'Laminazione Ciglia', count: 60, revenue: 3600, avgPrice: 60, trend: '+22%' },
  ],
  leastSold: [
    { id: '6', name: 'Scrub Corpo', count: 5, revenue: 250, avgPrice: 50, trend: '-45%' },
    { id: '7', name: 'Trattamento Acido Glicolico', count: 8, revenue: 720, avgPrice: 90, trend: '-10%' },
    { id: '8', name: 'Manicure Base', count: 12, revenue: 240, avgPrice: 20, trend: '-30%' },
  ],
  growing: [
    { name: 'Laminazione Ciglia', growth: '+22%' },
    { name: 'Epilazione Laser Total Body', growth: '+15%' },
  ],
  declining: [
    { name: 'Scrub Corpo', decline: '-45%' },
    { name: 'Manicure Base', decline: '-30%' },
  ]
};

export const CLIENTS_DATA = {
  newClients: 45,
  activeClients: 312,
  inactiveClients: 85, // 30+ days
  lostClients: 42, // 90+ days
  vipClients: 28,
  
  topSpenders: [
    { id: 'c1', name: 'Anna Fontana', totalSpent: 4500, appointments: 32, lastVisit: '2026-05-28', favorite: 'Laser Total Body', frequency: '14 giorni' },
    { id: 'c2', name: 'Maria Rossi', totalSpent: 3800, appointments: 28, lastVisit: '2026-05-25', favorite: 'Trattamento Viso Anti-age', frequency: '21 giorni' },
    { id: 'c3', name: 'Giulia Bianchi', totalSpent: 3200, appointments: 45, lastVisit: '2026-05-20', favorite: 'Pressoterapia', frequency: '7 giorni' },
    { id: 'c4', name: 'Francesca Neri', totalSpent: 2950, appointments: 20, lastVisit: '2026-05-15', favorite: 'Massaggio Drenante', frequency: '30 giorni' },
    { id: 'c5', name: 'Elena Colombo', totalSpent: 2600, appointments: 18, lastVisit: '2026-05-10', favorite: 'Laser Total Body', frequency: '45 giorni' },
  ],

  acquisitionChannels: [
    { name: 'Passaparola', count: 120, revenue: 15000, roi: '+400%', color: '#8B5CF6' },
    { name: 'Instagram', count: 85, revenue: 9500, roi: '+250%', color: '#EC4899' },
    { name: 'Google', count: 65, revenue: 8000, roi: '+180%', color: '#3B82F6' },
    { name: 'Facebook', count: 30, revenue: 3000, roi: '+120%', color: '#F59E0B' },
    { name: 'TikTok', count: 12, revenue: 1000, roi: '+80%', color: '#10B981' },
  ]
};

export const STAFF_DATA = [
  { id: 's1', name: 'Sara R.', revenue: 12500, appointments: 145, clients: 98, hoursWorked: 160, productiveHours: 142, avgTicket: 86, topTreatment: 'Laser Total Body', productivity: 88 },
  { id: 's2', name: 'Valentina B.', revenue: 9800, appointments: 120, clients: 85, hoursWorked: 160, productiveHours: 130, avgTicket: 81, topTreatment: 'Pulizia Viso', productivity: 81 },
  { id: 's3', name: 'Chiara M.', revenue: 8200, appointments: 110, clients: 75, hoursWorked: 160, productiveHours: 115, avgTicket: 74, topTreatment: 'Massaggi', productivity: 71 },
  { id: 's4', name: 'Francesca R.', revenue: 6000, appointments: 85, clients: 60, hoursWorked: 120, productiveHours: 85, avgTicket: 70, topTreatment: 'Pressoterapia', productivity: 70 },
];

export const AGENDA_CABIN_DATA = {
  totalAppointments: 460,
  completed: 410,
  cancelled: 35,
  moved: 15,
  waitlist: 8,
  cancelRate: '7.6%',
  fillRate: '82%',

  cabins: [
    { name: 'Cabina Laser', usedHours: 140, freeHours: 20, usePercent: 87.5, revenue: 18000 },
    { name: 'Cabina Viso 1', usedHours: 120, freeHours: 40, usePercent: 75, revenue: 8500 },
    { name: 'Cabina Massaggi', usedHours: 100, freeHours: 60, usePercent: 62.5, revenue: 6000 },
    { name: 'Cabina Corpo', usedHours: 80, freeHours: 80, usePercent: 50, revenue: 4000 },
  ]
};

export const PACKAGES_DATA = {
  sold: 45,
  usedSessions: 320,
  expiring: 12,
  completed: 8,
  residualValue: 12500, // Valore economico da erogare
};

export const KPI_DATA = {
  revPerClient: 116.98,
  revPerHour: 78.50,
  retentionRate: '82%',
  churnRate: '18%',
  waitlistConversion: '65%',
  ltv: 1450,
};

export const AI_INSIGHTS = {
  strengths: [
    "Il tasso di fidelizzazione (82%) è superiore alla media di settore (75%).",
    "Il canale Passaparola ha generato il ROI più alto questo mese (+400%).",
    "La Cabina Laser è ottimizzata all'87.5% della sua capacità, generando la maggior parte dei profitti."
  ],
  weaknesses: [
    "Tasso di cancellazione (7.6%) in leggero aumento rispetto al mese scorso.",
    "La Cabina Corpo è utilizzata solo al 50% della sua capacità.",
    "I trattamenti corpo di base (Scrub, Manicure) sono in forte calo (-45%)."
  ],
  actions: [
    { type: 'warning', title: 'Clienti a rischio', message: 'Le clienti laser ritornano in media ogni 42 giorni. Contatta le 37 clienti che non tornano da oltre 50 giorni.' },
    { type: 'success', title: 'Upselling', message: 'Il trattamento "Laminazione Ciglia" è cresciuto del 22%. Proponilo come add-on durante la "Pulizia Viso Profonda".' },
    { type: 'info', title: 'Ottimizzazione Staff', message: "L'operatrice Sara genera il 28% di fatturato in più rispetto alla media. Assegna a lei i nuovi clienti VIP." },
    { type: 'warning', title: 'Saturazione', message: 'Il centro ha il 22% di slot liberi il martedì e giovedì mattina. Lancia una promo per i "Giorni Lenti".' },
  ]
};
