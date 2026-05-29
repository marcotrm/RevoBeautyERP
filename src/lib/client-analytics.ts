// Client Analytics Data Layer
// Mock data and helper functions for the Client Dashboard

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
  source: 'Passaparola' | 'Instagram' | 'Google' | 'Facebook' | 'Walk-in' | 'Sito Web';
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

const treatments = [
  'Trattamento Anti-Age Premium', 'Epilazione Laser', 'Massaggio Rilassante',
  'Pulizia Viso Profonda', 'Manicure Semipermanente', 'Pedicure Curativa',
  'Peeling Chimico', 'Radiofrequenza Viso', 'Pressoterapia', 'Ceretta Integrale',
  'Trattamento Corpo Rimodellante', 'Laminazione Ciglia', 'Microblading Sopracciglia',
  'Massaggio Decontratturante', 'Trattamento Idratante Viso',
];

const operators = ['Sara Rossi', 'Valentina Bianchi', 'Chiara Moretti', 'Francesca Romano', 'Alessia Conti'];
const sources: ClientAnalytics['source'][] = ['Passaparola', 'Instagram', 'Google', 'Facebook', 'Walk-in', 'Sito Web'];

function calcLoyalty(revenue: number, freq: number): ClientAnalytics['loyaltyLevel'] {
  if (revenue > 4000 || freq > 40) return 'VIP';
  if (revenue > 2500 || freq > 25) return 'Platinum';
  if (revenue > 1500 || freq > 15) return 'Gold';
  if (revenue > 700 || freq > 8) return 'Silver';
  return 'Bronze';
}

function calcRFM(r: number, f: number, m: number): ClientAnalytics['rfmSegment'] {
  const score = r + f + m;
  if (score >= 13) return 'VIP';
  if (score >= 11) return 'Fedeli';
  if (score >= 8) return 'Regolari';
  if (score >= 5) return 'Occasionali';
  if (score >= 3) return 'Da recuperare';
  return 'Persi';
}

function calcChurn(days: number, freq: number): number {
  if (days > 120) return Math.min(95, 70 + Math.random() * 25);
  if (days > 90) return Math.min(85, 55 + Math.random() * 20);
  if (days > 60) return Math.min(65, 35 + Math.random() * 20);
  if (days > 30) return Math.min(40, 15 + Math.random() * 15);
  return Math.max(2, 5 - freq * 0.3 + Math.random() * 8);
}

const clientsData: Omit<ClientAnalytics, 'avgTicket' | 'loyaltyLevel' | 'rfmSegment' | 'churnProbability' | 'reliabilityScore' | 'noShowCount' | 'cancelledCount' | 'totalBooked'>[] = [
  // VIP clients
  { id: 'ca-1', firstName: 'Maria', lastName: 'Colombo', phone: '+39 345 1234567', email: 'maria.colombo@email.it', joinDate: '2023-03-15', lastVisitDate: '2026-05-26', totalRevenue: 7850, revenue12Months: 3200, revenueThisMonth: 450, revenueThisYear: 1800, totalAppointments: 68, appointments12Months: 28, appointmentsThisMonth: 4, daysSinceLastVisit: 3, avgDaysBetweenVisits: 14, preferredTreatment: 'Trattamento Anti-Age Premium', lastTreatment: 'Trattamento Anti-Age Premium', preferredOperator: 'Sara Rossi', source: 'Passaparola', birthDate: '1978-09-12', recencyScore: 5, frequencyScore: 5, monetaryScore: 5, hasPackage: true, isNew: false },
  { id: 'ca-2', firstName: 'Laura', lastName: 'Ferrari', phone: '+39 348 2345678', email: 'laura.ferrari@email.it', joinDate: '2023-06-20', lastVisitDate: '2026-05-24', totalRevenue: 6420, revenue12Months: 2800, revenueThisMonth: 380, revenueThisYear: 1650, totalAppointments: 52, appointments12Months: 22, appointmentsThisMonth: 3, daysSinceLastVisit: 5, avgDaysBetweenVisits: 16, preferredTreatment: 'Epilazione Laser', lastTreatment: 'Epilazione Laser', preferredOperator: 'Valentina Bianchi', source: 'Instagram', birthDate: '1985-03-28', recencyScore: 5, frequencyScore: 5, monetaryScore: 5, hasPackage: true, isNew: false },
  { id: 'ca-3', firstName: 'Giulia', lastName: 'Ricci', phone: '+39 340 3456789', email: 'giulia.ricci@email.it', joinDate: '2022-11-10', lastVisitDate: '2026-05-20', totalRevenue: 5680, revenue12Months: 2400, revenueThisMonth: 280, revenueThisYear: 1400, totalAppointments: 45, appointments12Months: 20, appointmentsThisMonth: 2, daysSinceLastVisit: 9, avgDaysBetweenVisits: 18, preferredTreatment: 'Radiofrequenza Viso', lastTreatment: 'Pulizia Viso Profonda', preferredOperator: 'Sara Rossi', source: 'Google', birthDate: '1990-07-15', recencyScore: 5, frequencyScore: 4, monetaryScore: 5, hasPackage: true, isNew: false },
  { id: 'ca-4', firstName: 'Francesca', lastName: 'Moretti', phone: '+39 333 4567890', email: 'f.moretti@email.it', joinDate: '2023-01-05', lastVisitDate: '2026-05-22', totalRevenue: 4950, revenue12Months: 2100, revenueThisMonth: 320, revenueThisYear: 1350, totalAppointments: 42, appointments12Months: 18, appointmentsThisMonth: 3, daysSinceLastVisit: 7, avgDaysBetweenVisits: 17, preferredTreatment: 'Massaggio Rilassante', lastTreatment: 'Massaggio Decontratturante', preferredOperator: 'Chiara Moretti', source: 'Passaparola', birthDate: '1982-12-03', recencyScore: 5, frequencyScore: 4, monetaryScore: 4, hasPackage: false, isNew: false },
  { id: 'ca-5', firstName: 'Elena', lastName: 'Bianchi', phone: '+39 347 5678901', email: 'elena.b@email.it', joinDate: '2023-04-18', lastVisitDate: '2026-05-18', totalRevenue: 4200, revenue12Months: 1900, revenueThisMonth: 190, revenueThisYear: 1200, totalAppointments: 38, appointments12Months: 16, appointmentsThisMonth: 2, daysSinceLastVisit: 11, avgDaysBetweenVisits: 20, preferredTreatment: 'Trattamento Corpo Rimodellante', lastTreatment: 'Pressoterapia', preferredOperator: 'Francesca Romano', source: 'Facebook', birthDate: '1988-05-22', recencyScore: 4, frequencyScore: 4, monetaryScore: 4, hasPackage: true, isNew: false },
  // Platinum clients
  { id: 'ca-6', firstName: 'Paola', lastName: 'Mancini', phone: '+39 339 6789012', email: 'paola.m@email.it', joinDate: '2023-08-12', lastVisitDate: '2026-05-15', totalRevenue: 3600, revenue12Months: 1650, revenueThisMonth: 150, revenueThisYear: 980, totalAppointments: 32, appointments12Months: 14, appointmentsThisMonth: 1, daysSinceLastVisit: 14, avgDaysBetweenVisits: 22, preferredTreatment: 'Peeling Chimico', lastTreatment: 'Peeling Chimico', preferredOperator: 'Sara Rossi', source: 'Instagram', birthDate: '1992-01-19', recencyScore: 4, frequencyScore: 4, monetaryScore: 4, hasPackage: true, isNew: false },
  { id: 'ca-7', firstName: 'Anna', lastName: 'Fontana', phone: '+39 344 7890123', email: 'anna.fontana@email.it', joinDate: '2024-02-28', lastVisitDate: '2026-05-10', totalRevenue: 3200, revenue12Months: 1500, revenueThisMonth: 0, revenueThisYear: 900, totalAppointments: 28, appointments12Months: 13, appointmentsThisMonth: 0, daysSinceLastVisit: 19, avgDaysBetweenVisits: 21, preferredTreatment: 'Massaggio Rilassante', lastTreatment: 'Massaggio Rilassante', preferredOperator: 'Chiara Moretti', source: 'Passaparola', birthDate: '1975-11-08', recencyScore: 4, frequencyScore: 3, monetaryScore: 4, hasPackage: true, isNew: false },
  { id: 'ca-8', firstName: 'Claudia', lastName: 'Greco', phone: '+39 342 8901234', email: 'c.greco@email.it', joinDate: '2023-11-15', lastVisitDate: '2026-05-08', totalRevenue: 2900, revenue12Months: 1400, revenueThisMonth: 0, revenueThisYear: 850, totalAppointments: 25, appointments12Months: 12, appointmentsThisMonth: 0, daysSinceLastVisit: 21, avgDaysBetweenVisits: 24, preferredTreatment: 'Laminazione Ciglia', lastTreatment: 'Manicure Semipermanente', preferredOperator: 'Alessia Conti', source: 'Google', birthDate: '1995-04-30', recencyScore: 3, frequencyScore: 3, monetaryScore: 3, hasPackage: false, isNew: false },
  // Gold clients
  { id: 'ca-9', firstName: 'Sara', lastName: 'De Luca', phone: '+39 338 9012345', email: 'sara.dl@email.it', joinDate: '2024-06-01', lastVisitDate: '2026-05-05', totalRevenue: 2400, revenue12Months: 1200, revenueThisMonth: 0, revenueThisYear: 720, totalAppointments: 22, appointments12Months: 10, appointmentsThisMonth: 0, daysSinceLastVisit: 24, avgDaysBetweenVisits: 25, preferredTreatment: 'Ceretta Integrale', lastTreatment: 'Ceretta Integrale', preferredOperator: 'Valentina Bianchi', source: 'Walk-in', birthDate: '1998-08-14', recencyScore: 3, frequencyScore: 3, monetaryScore: 3, hasPackage: false, isNew: false },
  { id: 'ca-10', firstName: 'Valentina', lastName: 'Costa', phone: '+39 346 0123456', email: 'vale.costa@email.it', joinDate: '2024-03-20', lastVisitDate: '2026-04-28', totalRevenue: 2100, revenue12Months: 1100, revenueThisMonth: 0, revenueThisYear: 650, totalAppointments: 19, appointments12Months: 9, appointmentsThisMonth: 0, daysSinceLastVisit: 31, avgDaysBetweenVisits: 28, preferredTreatment: 'Pulizia Viso Profonda', lastTreatment: 'Trattamento Idratante Viso', preferredOperator: 'Sara Rossi', source: 'Sito Web', birthDate: '1993-02-05', recencyScore: 3, frequencyScore: 3, monetaryScore: 3, hasPackage: false, isNew: false },
  { id: 'ca-11', firstName: 'Roberta', lastName: 'Marino', phone: '+39 349 1234560', email: 'roberta.m@email.it', joinDate: '2024-01-10', lastVisitDate: '2026-04-20', totalRevenue: 1950, revenue12Months: 950, revenueThisMonth: 0, revenueThisYear: 580, totalAppointments: 18, appointments12Months: 8, appointmentsThisMonth: 0, daysSinceLastVisit: 39, avgDaysBetweenVisits: 30, preferredTreatment: 'Manicure Semipermanente', lastTreatment: 'Manicure Semipermanente', preferredOperator: 'Alessia Conti', source: 'Instagram', birthDate: '1987-06-18', recencyScore: 2, frequencyScore: 3, monetaryScore: 3, hasPackage: false, isNew: false },
  { id: 'ca-12', firstName: 'Monica', lastName: 'Russo', phone: '+39 334 2345670', email: 'monica.r@email.it', joinDate: '2024-05-15', lastVisitDate: '2026-04-15', totalRevenue: 1800, revenue12Months: 900, revenueThisMonth: 0, revenueThisYear: 520, totalAppointments: 16, appointments12Months: 8, appointmentsThisMonth: 0, daysSinceLastVisit: 44, avgDaysBetweenVisits: 32, preferredTreatment: 'Pressoterapia', lastTreatment: 'Trattamento Corpo Rimodellante', preferredOperator: 'Francesca Romano', source: 'Facebook', birthDate: '1991-10-25', recencyScore: 2, frequencyScore: 2, monetaryScore: 3, hasPackage: false, isNew: false },
  // Silver clients
  { id: 'ca-13', firstName: 'Chiara', lastName: 'Lombardi', phone: '+39 341 3456780', email: 'chiara.l@email.it', joinDate: '2024-09-01', lastVisitDate: '2026-04-10', totalRevenue: 1450, revenue12Months: 750, revenueThisMonth: 0, revenueThisYear: 420, totalAppointments: 14, appointments12Months: 7, appointmentsThisMonth: 0, daysSinceLastVisit: 49, avgDaysBetweenVisits: 35, preferredTreatment: 'Epilazione Laser', lastTreatment: 'Epilazione Laser', preferredOperator: 'Valentina Bianchi', source: 'Google', birthDate: '1996-03-12', recencyScore: 2, frequencyScore: 2, monetaryScore: 2, hasPackage: false, isNew: false },
  { id: 'ca-14', firstName: 'Alessandra', lastName: 'Galli', phone: '+39 337 4567890', email: 'ale.galli@email.it', joinDate: '2025-01-20', lastVisitDate: '2026-04-05', totalRevenue: 1200, revenue12Months: 680, revenueThisMonth: 0, revenueThisYear: 380, totalAppointments: 12, appointments12Months: 6, appointmentsThisMonth: 0, daysSinceLastVisit: 54, avgDaysBetweenVisits: 38, preferredTreatment: 'Microblading Sopracciglia', lastTreatment: 'Laminazione Ciglia', preferredOperator: 'Alessia Conti', source: 'Passaparola', birthDate: '1989-07-30', recencyScore: 2, frequencyScore: 2, monetaryScore: 2, hasPackage: false, isNew: false },
  { id: 'ca-15', firstName: 'Stefania', lastName: 'Conti', phone: '+39 343 5678900', email: 's.conti@email.it', joinDate: '2024-11-08', lastVisitDate: '2026-03-28', totalRevenue: 1050, revenue12Months: 600, revenueThisMonth: 0, revenueThisYear: 320, totalAppointments: 10, appointments12Months: 5, appointmentsThisMonth: 0, daysSinceLastVisit: 62, avgDaysBetweenVisits: 42, preferredTreatment: 'Massaggio Rilassante', lastTreatment: 'Massaggio Rilassante', preferredOperator: 'Chiara Moretti', source: 'Walk-in', birthDate: '1980-12-20', recencyScore: 2, frequencyScore: 2, monetaryScore: 2, hasPackage: false, isNew: false },
  { id: 'ca-16', firstName: 'Federica', lastName: 'Barbieri', phone: '+39 350 6789010', email: 'fede.b@email.it', joinDate: '2025-03-12', lastVisitDate: '2026-03-20', totalRevenue: 920, revenue12Months: 520, revenueThisMonth: 0, revenueThisYear: 280, totalAppointments: 9, appointments12Months: 5, appointmentsThisMonth: 0, daysSinceLastVisit: 70, avgDaysBetweenVisits: 40, preferredTreatment: 'Pedicure Curativa', lastTreatment: 'Manicure Semipermanente', preferredOperator: 'Francesca Romano', source: 'Instagram', birthDate: '1994-04-08', recencyScore: 1, frequencyScore: 2, monetaryScore: 2, hasPackage: false, isNew: false },
  { id: 'ca-17', firstName: 'Silvia', lastName: 'Pellegrini', phone: '+39 336 7890120', email: 'silvia.p@email.it', joinDate: '2025-02-01', lastVisitDate: '2026-03-10', totalRevenue: 850, revenue12Months: 480, revenueThisMonth: 0, revenueThisYear: 250, totalAppointments: 8, appointments12Months: 4, appointmentsThisMonth: 0, daysSinceLastVisit: 80, avgDaysBetweenVisits: 45, preferredTreatment: 'Ceretta Integrale', lastTreatment: 'Ceretta Integrale', preferredOperator: 'Valentina Bianchi', source: 'Sito Web', birthDate: '1997-09-02', recencyScore: 1, frequencyScore: 2, monetaryScore: 1, hasPackage: false, isNew: false },
  // Bronze / at-risk clients
  { id: 'ca-18', firstName: 'Elisa', lastName: 'Vitale', phone: '+39 332 8901230', email: 'elisa.v@email.it', joinDate: '2025-06-15', lastVisitDate: '2026-02-25', totalRevenue: 680, revenue12Months: 380, revenueThisMonth: 0, revenueThisYear: 180, totalAppointments: 7, appointments12Months: 3, appointmentsThisMonth: 0, daysSinceLastVisit: 93, avgDaysBetweenVisits: 50, preferredTreatment: 'Pulizia Viso Profonda', lastTreatment: 'Pulizia Viso Profonda', preferredOperator: 'Sara Rossi', source: 'Google', birthDate: '2000-01-15', recencyScore: 1, frequencyScore: 1, monetaryScore: 1, hasPackage: false, isNew: false },
  { id: 'ca-19', firstName: 'Barbara', lastName: 'Marchetti', phone: '+39 331 9012340', email: 'barb.m@email.it', joinDate: '2025-04-20', lastVisitDate: '2026-02-10', totalRevenue: 520, revenue12Months: 320, revenueThisMonth: 0, revenueThisYear: 120, totalAppointments: 5, appointments12Months: 3, appointmentsThisMonth: 0, daysSinceLastVisit: 108, avgDaysBetweenVisits: 55, preferredTreatment: 'Trattamento Idratante Viso', lastTreatment: 'Trattamento Idratante Viso', preferredOperator: 'Chiara Moretti', source: 'Facebook', birthDate: '1986-11-28', recencyScore: 1, frequencyScore: 1, monetaryScore: 1, hasPackage: false, isNew: false },
  { id: 'ca-20', firstName: 'Daniela', lastName: 'Serra', phone: '+39 335 0123450', email: 'd.serra@email.it', joinDate: '2025-07-01', lastVisitDate: '2026-01-20', totalRevenue: 380, revenue12Months: 220, revenueThisMonth: 0, revenueThisYear: 0, totalAppointments: 4, appointments12Months: 2, appointmentsThisMonth: 0, daysSinceLastVisit: 129, avgDaysBetweenVisits: 60, preferredTreatment: 'Manicure Semipermanente', lastTreatment: 'Manicure Semipermanente', preferredOperator: 'Alessia Conti', source: 'Walk-in', birthDate: '1999-05-10', recencyScore: 1, frequencyScore: 1, monetaryScore: 1, hasPackage: false, isNew: false },
  { id: 'ca-21', firstName: 'Simona', lastName: 'Rinaldi', phone: '+39 330 1234560', email: 's.rinaldi@email.it', joinDate: '2025-09-10', lastVisitDate: '2025-12-15', totalRevenue: 280, revenue12Months: 180, revenueThisMonth: 0, revenueThisYear: 0, totalAppointments: 3, appointments12Months: 2, appointmentsThisMonth: 0, daysSinceLastVisit: 165, avgDaysBetweenVisits: 65, preferredTreatment: 'Pressoterapia', lastTreatment: 'Pressoterapia', preferredOperator: 'Francesca Romano', source: 'Passaparola', birthDate: '1983-08-22', recencyScore: 1, frequencyScore: 1, monetaryScore: 1, hasPackage: false, isNew: false },
  // More regular clients
  { id: 'ca-22', firstName: 'Beatrice', lastName: 'Martini', phone: '+39 329 2345670', email: 'bea.m@email.it', joinDate: '2024-07-15', lastVisitDate: '2026-05-25', totalRevenue: 3100, revenue12Months: 1500, revenueThisMonth: 250, revenueThisYear: 920, totalAppointments: 30, appointments12Months: 14, appointmentsThisMonth: 2, daysSinceLastVisit: 4, avgDaysBetweenVisits: 19, preferredTreatment: 'Radiofrequenza Viso', lastTreatment: 'Trattamento Anti-Age Premium', preferredOperator: 'Sara Rossi', source: 'Instagram', birthDate: '1991-06-14', recencyScore: 5, frequencyScore: 4, monetaryScore: 4, hasPackage: true, isNew: false },
  { id: 'ca-23', firstName: 'Ilaria', lastName: 'Fabbri', phone: '+39 328 3456780', email: 'ilaria.f@email.it', joinDate: '2024-10-01', lastVisitDate: '2026-05-21', totalRevenue: 2650, revenue12Months: 1350, revenueThisMonth: 180, revenueThisYear: 780, totalAppointments: 24, appointments12Months: 12, appointmentsThisMonth: 2, daysSinceLastVisit: 8, avgDaysBetweenVisits: 22, preferredTreatment: 'Trattamento Corpo Rimodellante', lastTreatment: 'Pressoterapia', preferredOperator: 'Francesca Romano', source: 'Google', birthDate: '1994-11-03', recencyScore: 5, frequencyScore: 3, monetaryScore: 3, hasPackage: false, isNew: false },
  { id: 'ca-24', firstName: 'Martina', lastName: 'Esposito', phone: '+39 327 4567890', email: 'martina.e@email.it', joinDate: '2025-05-10', lastVisitDate: '2026-05-19', totalRevenue: 1650, revenue12Months: 980, revenueThisMonth: 120, revenueThisYear: 650, totalAppointments: 15, appointments12Months: 9, appointmentsThisMonth: 1, daysSinceLastVisit: 10, avgDaysBetweenVisits: 26, preferredTreatment: 'Laminazione Ciglia', lastTreatment: 'Laminazione Ciglia', preferredOperator: 'Alessia Conti', source: 'Passaparola', birthDate: '1996-02-28', recencyScore: 4, frequencyScore: 3, monetaryScore: 2, hasPackage: false, isNew: false },
  { id: 'ca-25', firstName: 'Serena', lastName: 'Bruno', phone: '+39 326 5678900', email: 'serena.b@email.it', joinDate: '2025-08-20', lastVisitDate: '2026-05-12', totalRevenue: 1100, revenue12Months: 680, revenueThisMonth: 0, revenueThisYear: 420, totalAppointments: 11, appointments12Months: 6, appointmentsThisMonth: 0, daysSinceLastVisit: 17, avgDaysBetweenVisits: 30, preferredTreatment: 'Massaggio Decontratturante', lastTreatment: 'Massaggio Rilassante', preferredOperator: 'Chiara Moretti', source: 'Sito Web', birthDate: '1993-09-17', recencyScore: 4, frequencyScore: 2, monetaryScore: 2, hasPackage: false, isNew: false },
  // New clients this month
  { id: 'ca-26', firstName: 'Giorgia', lastName: 'Romano', phone: '+39 325 6789010', email: 'giorgia.r@email.it', joinDate: '2026-05-02', lastVisitDate: '2026-05-22', totalRevenue: 180, revenue12Months: 180, revenueThisMonth: 180, revenueThisYear: 180, totalAppointments: 2, appointments12Months: 2, appointmentsThisMonth: 2, daysSinceLastVisit: 7, avgDaysBetweenVisits: 10, preferredTreatment: 'Pulizia Viso Profonda', lastTreatment: 'Trattamento Idratante Viso', preferredOperator: 'Sara Rossi', source: 'Instagram', birthDate: '2001-04-05', recencyScore: 5, frequencyScore: 1, monetaryScore: 1, hasPackage: false, isNew: true },
  { id: 'ca-27', firstName: 'Alessia', lastName: 'Mazza', phone: '+39 324 7890120', email: 'alessia.ma@email.it', joinDate: '2026-05-08', lastVisitDate: '2026-05-20', totalRevenue: 95, revenue12Months: 95, revenueThisMonth: 95, revenueThisYear: 95, totalAppointments: 1, appointments12Months: 1, appointmentsThisMonth: 1, daysSinceLastVisit: 9, avgDaysBetweenVisits: 0, preferredTreatment: 'Manicure Semipermanente', lastTreatment: 'Manicure Semipermanente', preferredOperator: 'Alessia Conti', source: 'Walk-in', birthDate: '2003-07-19', recencyScore: 5, frequencyScore: 1, monetaryScore: 1, hasPackage: false, isNew: true },
  { id: 'ca-28', firstName: 'Cristina', lastName: 'Santoro', phone: '+39 323 8901230', email: 'cristina.s@email.it', joinDate: '2026-05-15', lastVisitDate: '2026-05-25', totalRevenue: 220, revenue12Months: 220, revenueThisMonth: 220, revenueThisYear: 220, totalAppointments: 2, appointments12Months: 2, appointmentsThisMonth: 2, daysSinceLastVisit: 4, avgDaysBetweenVisits: 5, preferredTreatment: 'Epilazione Laser', lastTreatment: 'Ceretta Integrale', preferredOperator: 'Valentina Bianchi', source: 'Google', birthDate: '1997-12-11', recencyScore: 5, frequencyScore: 1, monetaryScore: 1, hasPackage: false, isNew: true },
  { id: 'ca-29', firstName: 'Ludovica', lastName: 'Palumbo', phone: '+39 322 9012340', email: 'ludo.p@email.it', joinDate: '2026-05-20', lastVisitDate: '2026-05-27', totalRevenue: 85, revenue12Months: 85, revenueThisMonth: 85, revenueThisYear: 85, totalAppointments: 1, appointments12Months: 1, appointmentsThisMonth: 1, daysSinceLastVisit: 2, avgDaysBetweenVisits: 0, preferredTreatment: 'Pedicure Curativa', lastTreatment: 'Pedicure Curativa', preferredOperator: 'Francesca Romano', source: 'Passaparola', birthDate: '2002-10-30', recencyScore: 5, frequencyScore: 1, monetaryScore: 1, hasPackage: false, isNew: true },
  // More variety
  { id: 'ca-30', firstName: 'Teresa', lastName: 'Caruso', phone: '+39 321 0123450', email: 'teresa.c@email.it', joinDate: '2024-04-08', lastVisitDate: '2026-05-16', totalRevenue: 2800, revenue12Months: 1300, revenueThisMonth: 130, revenueThisYear: 820, totalAppointments: 26, appointments12Months: 11, appointmentsThisMonth: 1, daysSinceLastVisit: 13, avgDaysBetweenVisits: 23, preferredTreatment: 'Peeling Chimico', lastTreatment: 'Trattamento Anti-Age Premium', preferredOperator: 'Sara Rossi', source: 'Facebook', birthDate: '1979-01-25', recencyScore: 4, frequencyScore: 3, monetaryScore: 3, hasPackage: false, isNew: false },
  { id: 'ca-31', firstName: 'Giuseppina', lastName: 'De Rosa', phone: '+39 320 1234560', email: 'pina.dr@email.it', joinDate: '2023-12-20', lastVisitDate: '2026-05-23', totalRevenue: 3450, revenue12Months: 1600, revenueThisMonth: 200, revenueThisYear: 980, totalAppointments: 32, appointments12Months: 14, appointmentsThisMonth: 2, daysSinceLastVisit: 6, avgDaysBetweenVisits: 20, preferredTreatment: 'Trattamento Anti-Age Premium', lastTreatment: 'Radiofrequenza Viso', preferredOperator: 'Sara Rossi', source: 'Passaparola', birthDate: '1970-06-15', recencyScore: 5, frequencyScore: 4, monetaryScore: 4, hasPackage: true, isNew: false },
  { id: 'ca-32', firstName: 'Patrizia', lastName: 'Vitali', phone: '+39 319 2345670', email: 'pat.v@email.it', joinDate: '2025-01-15', lastVisitDate: '2026-04-25', totalRevenue: 1380, revenue12Months: 780, revenueThisMonth: 0, revenueThisYear: 450, totalAppointments: 13, appointments12Months: 7, appointmentsThisMonth: 0, daysSinceLastVisit: 34, avgDaysBetweenVisits: 32, preferredTreatment: 'Massaggio Rilassante', lastTreatment: 'Massaggio Decontratturante', preferredOperator: 'Chiara Moretti', source: 'Sito Web', birthDate: '1976-03-08', recencyScore: 2, frequencyScore: 2, monetaryScore: 2, hasPackage: false, isNew: false },
  { id: 'ca-33', firstName: 'Lucia', lastName: 'Parisi', phone: '+39 318 3456780', email: 'lucia.p@email.it', joinDate: '2025-10-05', lastVisitDate: '2026-03-15', totalRevenue: 450, revenue12Months: 350, revenueThisMonth: 0, revenueThisYear: 150, totalAppointments: 4, appointments12Months: 3, appointmentsThisMonth: 0, daysSinceLastVisit: 75, avgDaysBetweenVisits: 48, preferredTreatment: 'Ceretta Integrale', lastTreatment: 'Ceretta Integrale', preferredOperator: 'Valentina Bianchi', source: 'Walk-in', birthDate: '2000-08-20', recencyScore: 1, frequencyScore: 1, monetaryScore: 1, hasPackage: false, isNew: false },
  { id: 'ca-34', firstName: 'Grazia', lastName: 'Gentile', phone: '+39 317 4567890', email: 'grazia.g@email.it', joinDate: '2024-08-25', lastVisitDate: '2026-05-14', totalRevenue: 2200, revenue12Months: 1050, revenueThisMonth: 110, revenueThisYear: 680, totalAppointments: 20, appointments12Months: 9, appointmentsThisMonth: 1, daysSinceLastVisit: 15, avgDaysBetweenVisits: 27, preferredTreatment: 'Microblading Sopracciglia', lastTreatment: 'Laminazione Ciglia', preferredOperator: 'Alessia Conti', source: 'Instagram', birthDate: '1988-12-02', recencyScore: 4, frequencyScore: 3, monetaryScore: 3, hasPackage: false, isNew: false },
  { id: 'ca-35', firstName: 'Rita', lastName: 'Basile', phone: '+39 316 5678900', email: 'rita.b@email.it', joinDate: '2025-11-12', lastVisitDate: '2026-02-05', totalRevenue: 320, revenue12Months: 220, revenueThisMonth: 0, revenueThisYear: 80, totalAppointments: 3, appointments12Months: 2, appointmentsThisMonth: 0, daysSinceLastVisit: 113, avgDaysBetweenVisits: 55, preferredTreatment: 'Pulizia Viso Profonda', lastTreatment: 'Pulizia Viso Profonda', preferredOperator: 'Sara Rossi', source: 'Google', birthDate: '1985-05-30', recencyScore: 1, frequencyScore: 1, monetaryScore: 1, hasPackage: false, isNew: false },
  // Birthday in this month (June)
  { id: 'ca-36', firstName: 'Antonella', lastName: 'Leone', phone: '+39 315 6789010', email: 'anto.l@email.it', joinDate: '2024-02-14', lastVisitDate: '2026-05-18', totalRevenue: 1750, revenue12Months: 850, revenueThisMonth: 90, revenueThisYear: 500, totalAppointments: 16, appointments12Months: 7, appointmentsThisMonth: 1, daysSinceLastVisit: 11, avgDaysBetweenVisits: 28, preferredTreatment: 'Trattamento Corpo Rimodellante', lastTreatment: 'Pressoterapia', preferredOperator: 'Francesca Romano', source: 'Passaparola', birthDate: '1990-06-08', recencyScore: 4, frequencyScore: 2, monetaryScore: 2, hasPackage: false, isNew: false },
  { id: 'ca-37', firstName: 'Nadia', lastName: 'Ferraro', phone: '+39 314 7890120', email: 'nadia.f@email.it', joinDate: '2025-07-22', lastVisitDate: '2026-05-10', totalRevenue: 780, revenue12Months: 520, revenueThisMonth: 0, revenueThisYear: 340, totalAppointments: 7, appointments12Months: 5, appointmentsThisMonth: 0, daysSinceLastVisit: 19, avgDaysBetweenVisits: 30, preferredTreatment: 'Massaggio Rilassante', lastTreatment: 'Massaggio Decontratturante', preferredOperator: 'Chiara Moretti', source: 'Facebook', birthDate: '1992-06-15', recencyScore: 4, frequencyScore: 2, monetaryScore: 1, hasPackage: false, isNew: false },
  { id: 'ca-38', firstName: 'Viviana', lastName: 'Grasso', phone: '+39 313 8901230', email: 'vivi.g@email.it', joinDate: '2025-09-18', lastVisitDate: '2026-04-02', totalRevenue: 550, revenue12Months: 400, revenueThisMonth: 0, revenueThisYear: 200, totalAppointments: 5, appointments12Months: 4, appointmentsThisMonth: 0, daysSinceLastVisit: 57, avgDaysBetweenVisits: 40, preferredTreatment: 'Epilazione Laser', lastTreatment: 'Epilazione Laser', preferredOperator: 'Valentina Bianchi', source: 'Instagram', birthDate: '1995-01-10', recencyScore: 2, frequencyScore: 1, monetaryScore: 1, hasPackage: false, isNew: false },
];

// No-show/cancel data per client (indexed by id)
const noShowData: Record<string, { noShow: number; cancelled: number; extraBooked: number }> = {
  'ca-1': { noShow: 1, cancelled: 2, extraBooked: 3 }, 'ca-2': { noShow: 0, cancelled: 1, extraBooked: 1 },
  'ca-3': { noShow: 2, cancelled: 3, extraBooked: 5 }, 'ca-4': { noShow: 0, cancelled: 0, extraBooked: 0 },
  'ca-5': { noShow: 1, cancelled: 1, extraBooked: 2 }, 'ca-6': { noShow: 0, cancelled: 2, extraBooked: 2 },
  'ca-7': { noShow: 3, cancelled: 4, extraBooked: 7 }, 'ca-8': { noShow: 5, cancelled: 3, extraBooked: 8 },
  'ca-9': { noShow: 0, cancelled: 0, extraBooked: 0 }, 'ca-10': { noShow: 2, cancelled: 1, extraBooked: 3 },
  'ca-11': { noShow: 4, cancelled: 2, extraBooked: 6 }, 'ca-12': { noShow: 6, cancelled: 4, extraBooked: 10 },
  'ca-13': { noShow: 1, cancelled: 0, extraBooked: 1 }, 'ca-14': { noShow: 0, cancelled: 1, extraBooked: 1 },
  'ca-15': { noShow: 3, cancelled: 2, extraBooked: 5 }, 'ca-16': { noShow: 0, cancelled: 0, extraBooked: 0 },
  'ca-17': { noShow: 2, cancelled: 1, extraBooked: 3 }, 'ca-18': { noShow: 1, cancelled: 0, extraBooked: 1 },
  'ca-19': { noShow: 7, cancelled: 5, extraBooked: 12 }, 'ca-20': { noShow: 3, cancelled: 2, extraBooked: 5 },
  'ca-21': { noShow: 8, cancelled: 6, extraBooked: 14 }, 'ca-22': { noShow: 0, cancelled: 1, extraBooked: 1 },
  'ca-23': { noShow: 1, cancelled: 0, extraBooked: 1 }, 'ca-24': { noShow: 0, cancelled: 0, extraBooked: 0 },
  'ca-25': { noShow: 0, cancelled: 0, extraBooked: 0 }, 'ca-26': { noShow: 0, cancelled: 0, extraBooked: 0 },
  'ca-27': { noShow: 0, cancelled: 0, extraBooked: 0 }, 'ca-28': { noShow: 0, cancelled: 0, extraBooked: 0 },
  'ca-29': { noShow: 0, cancelled: 0, extraBooked: 0 }, 'ca-30': { noShow: 1, cancelled: 1, extraBooked: 2 },
  'ca-31': { noShow: 0, cancelled: 0, extraBooked: 0 }, 'ca-32': { noShow: 2, cancelled: 3, extraBooked: 5 },
  'ca-33': { noShow: 4, cancelled: 3, extraBooked: 7 }, 'ca-34': { noShow: 0, cancelled: 1, extraBooked: 1 },
  'ca-35': { noShow: 5, cancelled: 4, extraBooked: 9 }, 'ca-36': { noShow: 0, cancelled: 0, extraBooked: 0 },
  'ca-37': { noShow: 1, cancelled: 0, extraBooked: 1 }, 'ca-38': { noShow: 3, cancelled: 2, extraBooked: 5 },
};

export const mockClientAnalytics: ClientAnalytics[] = clientsData.map(c => {
  const nsd = noShowData[c.id] || { noShow: 0, cancelled: 0, extraBooked: 0 };
  const totalBooked = c.totalAppointments + nsd.extraBooked;
  const noShowRate = totalBooked > 0 ? (nsd.noShow + nsd.cancelled) / totalBooked : 0;
  return {
    ...c,
    avgTicket: c.totalAppointments > 0 ? Math.round(c.totalRevenue / c.totalAppointments) : 0,
    loyaltyLevel: calcLoyalty(c.totalRevenue, c.totalAppointments),
    rfmSegment: calcRFM(c.recencyScore, c.frequencyScore, c.monetaryScore),
    churnProbability: Math.round(calcChurn(c.daysSinceLastVisit, c.totalAppointments)),
    noShowCount: nsd.noShow,
    cancelledCount: nsd.cancelled,
    totalBooked,
    reliabilityScore: Math.round((1 - noShowRate) * 100),
  };
});

// ===== KPIs =====
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

export function getMonthlyNewClients() {
  return [
    { month: 'Giu 25', count: 5, converted: 3 }, { month: 'Lug 25', count: 4, converted: 2 },
    { month: 'Ago 25', count: 3, converted: 2 }, { month: 'Set 25', count: 6, converted: 4 },
    { month: 'Ott 25', count: 4, converted: 3 }, { month: 'Nov 25', count: 5, converted: 3 },
    { month: 'Dic 25', count: 3, converted: 1 }, { month: 'Gen 26', count: 6, converted: 4 },
    { month: 'Feb 26', count: 4, converted: 3 }, { month: 'Mar 26', count: 7, converted: 5 },
    { month: 'Apr 26', count: 5, converted: 3 }, { month: 'Mag 26', count: 4, converted: 3 },
  ];
}

export function getTreatmentStats(clients: ClientAnalytics[]) {
  const tMap: Record<string, { count: number; revenue: number; clients: string[] }> = {};
  clients.forEach(c => {
    const t = c.preferredTreatment;
    if (!tMap[t]) tMap[t] = { count: 0, revenue: 0, clients: [] };
    tMap[t].count += 1;
    tMap[t].revenue += Math.round(c.totalRevenue * 0.4);
    tMap[t].clients.push(`${c.firstName} ${c.lastName}`);
  });
  return Object.entries(tMap)
    .map(([name, d]) => ({ name, count: d.count, revenue: d.revenue, avgReturn: d.count > 0 ? Math.round(d.revenue / d.count) : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
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
    const bMonth = parseInt(c.birthDate.split('-')[1]);
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

export const monthlyRevenueTrend = [
  { month: 'Giu 25', revenue: 24500, clients: 28, newClients: 5 },
  { month: 'Lug 25', revenue: 22800, clients: 26, newClients: 4 },
  { month: 'Ago 25', revenue: 18200, clients: 20, newClients: 3 },
  { month: 'Set 25', revenue: 26400, clients: 30, newClients: 6 },
  { month: 'Ott 25', revenue: 27100, clients: 31, newClients: 4 },
  { month: 'Nov 25', revenue: 25800, clients: 29, newClients: 5 },
  { month: 'Dic 25', revenue: 21500, clients: 24, newClients: 3 },
  { month: 'Gen 26', revenue: 28900, clients: 32, newClients: 6 },
  { month: 'Feb 26', revenue: 26300, clients: 30, newClients: 4 },
  { month: 'Mar 26', revenue: 30100, clients: 34, newClients: 7 },
  { month: 'Apr 26', revenue: 28500, clients: 32, newClients: 5 },
  { month: 'Mag 26', revenue: 29800, clients: 33, newClients: 4 },
];

export const LOYALTY_COLORS: Record<string, string> = {
  'Bronze': '#CD7F32', 'Silver': '#C0C0C0', 'Gold': '#FFD700', 'Platinum': '#E5E4E2', 'VIP': '#8B5CF6',
};
