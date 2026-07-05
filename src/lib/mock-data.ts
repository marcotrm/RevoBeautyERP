// ============================================================
// Revobeauty — Mock Data (Realistic Italian Beauty Center)
// ============================================================
import {
  Client, Operator, Treatment, Room, Appointment, Location,
  AppNotification, DashboardKPI, RevenueDataPoint, Activity,
  User, Product
} from '@/types';

// --- Current User ---
export const mockCurrentUser: User = {
  id: 'u1',
  email: 'giulia@revobeauty.it',
  firstName: 'Giulia',
  lastName: 'Marchetti',
  role: 'owner',
  avatar: '',
  phone: '+39 333 1234567',
  locationIds: ['loc1', 'loc2', 'loc3'],
  isActive: true,
  createdAt: '2024-01-15',
};

// --- Locations ---
export const mockLocations: Location[] = [
  {
    id: 'loc1',
    name: 'Revobeauty Maddaloni',
    address: 'Via Caudina',
    city: 'Maddaloni (CE) 81024',
    phone: '',
    email: 'revobeauty@pec.it',
    isActive: true,
    openingHours: [
      { day: 0, isOpen: false, openTime: '09:00', closeTime: '19:00' },
      { day: 1, isOpen: true, openTime: '09:00', closeTime: '19:00' },
      { day: 2, isOpen: true, openTime: '09:00', closeTime: '19:00' },
      { day: 3, isOpen: true, openTime: '09:00', closeTime: '19:00' },
      { day: 4, isOpen: true, openTime: '09:00', closeTime: '19:00' },
      { day: 5, isOpen: true, openTime: '09:00', closeTime: '19:00' },
      { day: 6, isOpen: true, openTime: '09:00', closeTime: '18:00' },
    ],
  },
];

// --- Operators ---
export const mockOperators: Operator[] = [
  {
    id: 'op1', firstName: 'Sara', lastName: 'Rossi', color: '#A855F7',
    specializations: ['facial', 'body', 'consultation'],
    locationIds: ['loc1'], isActive: true, phone: '+39 340 1111111',
    email: 'sara@revobeauty.it', commission: 15, hireDate: '2022-03-01',
    schedule: {
      1: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      2: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      3: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      4: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' },
      5: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      6: { isWorking: false, startTime: '09:00', endTime: '14:00' },
    }
  },
  {
    id: 'op2', firstName: 'Valentina', lastName: 'Bianchi', color: '#EC4899',
    specializations: ['laser', 'body', 'facial'],
    locationIds: ['loc1'], isActive: true, phone: '+39 340 2222222',
    email: 'valentina@revobeauty.it', commission: 12, hireDate: '2023-01-15',
    schedule: {
      1: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      2: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      3: { isWorking: false, startTime: '09:00', endTime: '18:00' },
      4: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' },
      5: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      6: { isWorking: true, startTime: '09:00', endTime: '14:00' },
    }
  },
  {
    id: 'op3', firstName: 'Chiara', lastName: 'Moretti', color: '#F59E0B',
    specializations: ['massage', 'body'],
    locationIds: ['loc1'], isActive: true, phone: '+39 340 3333333',
    email: 'chiara@revobeauty.it', commission: 18, hireDate: '2021-06-01',
    schedule: {
      1: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      2: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      3: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      4: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' },
      5: { isWorking: false, startTime: '09:00', endTime: '18:00' },
      6: { isWorking: true, startTime: '09:00', endTime: '14:00' },
    }
  },
  {
    id: 'op4', firstName: 'Francesca', lastName: 'Romano', color: '#22C55E',
    specializations: ['nails', 'waxing'],
    locationIds: ['loc1'], isActive: true, phone: '+39 340 4444444',
    email: 'francesca@revobeauty.it', commission: 10, hireDate: '2023-09-01',
    schedule: {
      1: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      2: { isWorking: false, startTime: '09:00', endTime: '18:00' },
      3: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      4: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' },
      5: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' },
      6: { isWorking: true, startTime: '09:00', endTime: '14:00' },
    }
  },
  {
    id: 'op5', firstName: 'Alessia', lastName: 'Conti', color: '#3B82F6',
    specializations: ['facial', 'consultation', 'makeup'],
    locationIds: ['loc1'], isActive: true, phone: '+39 340 5555555',
    email: 'alessia@revobeauty.it', commission: 14, hireDate: '2022-11-01',
    schedule: {
      1: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' },
      2: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' },
      3: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' },
      4: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' },
      5: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' },
      6: { isWorking: false, startTime: '09:00', endTime: '14:00' },
    }
  },
];

// --- Rooms ---
export const mockRooms: Room[] = [
  { id: 'r1', name: 'Cabina 1 - Viso', locationId: 'loc1', type: 'cabin', color: '#8B5CF6', isActive: true, equipment: ['Vaporizzatore', 'Alta Frequenza'] },
  { id: 'r2', name: 'Cabina 2 - Corpo', locationId: 'loc1', type: 'cabin', color: '#EC4899', isActive: true, equipment: ['Pressoterapia', 'Radiofrequenza'] },
  { id: 'r3', name: 'Cabina 3 - Laser', locationId: 'loc1', type: 'cabin', color: '#F59E0B', isActive: true, equipment: ['Laser Diodo', 'Luce Pulsata'] },
  { id: 'r4', name: 'Cabina 4 - Massaggi', locationId: 'loc1', type: 'cabin', color: '#22C55E', isActive: true, equipment: ['Lettino Riscaldato'] },
  { id: 'r5', name: 'Postazione Unghie', locationId: 'loc1', type: 'area', color: '#3B82F6', isActive: true },
];

// --- Treatments ---
export const mockTreatments: Treatment[] = [
  // Facial
  { id: 't1', name: 'Pulizia Viso Profonda', category: 'facial', duration: 60, price: 65, requiresRoom: true, bufferBefore: 0, bufferAfter: 10, color: '#8B5CF6', isActive: true },
  { id: 't2', name: 'Trattamento Anti-Age Premium', category: 'facial', duration: 75, price: 95, requiresRoom: true, bufferBefore: 0, bufferAfter: 10, color: '#8B5CF6', isActive: true },
  { id: 't3', name: 'Peeling Chimico', category: 'facial', duration: 45, price: 80, requiresRoom: true, bufferBefore: 0, bufferAfter: 15, color: '#8B5CF6', isActive: true },
  { id: 't4', name: 'Trattamento Idratante Viso', category: 'facial', duration: 50, price: 55, requiresRoom: true, bufferBefore: 0, bufferAfter: 5, color: '#8B5CF6', isActive: true },
  { id: 't5', name: 'Radiofrequenza Viso', category: 'facial', duration: 40, price: 70, requiresRoom: true, bufferBefore: 0, bufferAfter: 5, color: '#8B5CF6', isActive: true, requiresEquipment: 'Radiofrequenza' },
  // Body
  { id: 't6', name: 'Pressoterapia', category: 'body', duration: 45, price: 40, requiresRoom: true, bufferBefore: 5, bufferAfter: 5, color: '#EC4899', isActive: true, requiresEquipment: 'Pressoterapia' },
  { id: 't7', name: 'Bendaggio Drenante', category: 'body', duration: 60, price: 55, requiresRoom: true, bufferBefore: 5, bufferAfter: 10, color: '#EC4899', isActive: true },
  { id: 't8', name: 'Trattamento Anticellulite', category: 'body', duration: 60, price: 75, requiresRoom: true, bufferBefore: 5, bufferAfter: 10, color: '#EC4899', isActive: true },
  { id: 't9', name: 'Scrub Corpo Completo', category: 'body', duration: 45, price: 50, requiresRoom: true, bufferBefore: 0, bufferAfter: 10, color: '#EC4899', isActive: true },
  // Laser
  { id: 't10', name: 'Epilazione Laser Gambe', category: 'laser', duration: 45, price: 120, requiresRoom: true, bufferBefore: 0, bufferAfter: 5, color: '#F59E0B', isActive: true, requiresEquipment: 'Laser Diodo' },
  { id: 't11', name: 'Epilazione Laser Ascelle', category: 'laser', duration: 15, price: 40, requiresRoom: true, bufferBefore: 0, bufferAfter: 5, color: '#F59E0B', isActive: true, requiresEquipment: 'Laser Diodo' },
  { id: 't12', name: 'Epilazione Laser Inguine', category: 'laser', duration: 20, price: 50, requiresRoom: true, bufferBefore: 0, bufferAfter: 5, color: '#F59E0B', isActive: true, requiresEquipment: 'Laser Diodo' },
  { id: 't13', name: 'Fotoringiovanimento IPL', category: 'laser', duration: 30, price: 90, requiresRoom: true, bufferBefore: 0, bufferAfter: 10, color: '#F59E0B', isActive: true, requiresEquipment: 'Luce Pulsata' },
  // Massage
  { id: 't14', name: 'Massaggio Rilassante 60min', category: 'massage', duration: 60, price: 65, requiresRoom: true, bufferBefore: 5, bufferAfter: 10, color: '#22C55E', isActive: true },
  { id: 't15', name: 'Massaggio Decontratturante', category: 'massage', duration: 50, price: 60, requiresRoom: true, bufferBefore: 5, bufferAfter: 10, color: '#22C55E', isActive: true },
  { id: 't16', name: 'Massaggio Linfodrenante', category: 'massage', duration: 60, price: 70, requiresRoom: true, bufferBefore: 5, bufferAfter: 10, color: '#22C55E', isActive: true },
  { id: 't17', name: 'Hot Stone Massage', category: 'massage', duration: 75, price: 85, requiresRoom: true, bufferBefore: 5, bufferAfter: 15, color: '#22C55E', isActive: true },
  // Nails
  { id: 't18', name: 'Manicure Semipermanente', category: 'nails', duration: 45, price: 30, requiresRoom: false, bufferBefore: 0, bufferAfter: 5, color: '#3B82F6', isActive: true },
  { id: 't19', name: 'Pedicure Curativa', category: 'nails', duration: 50, price: 35, requiresRoom: false, bufferBefore: 0, bufferAfter: 5, color: '#3B82F6', isActive: true },
  { id: 't20', name: 'Ricostruzione Unghie Gel', category: 'nails', duration: 90, price: 55, requiresRoom: false, bufferBefore: 0, bufferAfter: 5, color: '#3B82F6', isActive: true },
  // Waxing
  { id: 't21', name: 'Ceretta Gambe Intere', category: 'waxing', duration: 30, price: 25, requiresRoom: true, bufferBefore: 0, bufferAfter: 5, color: '#F97316', isActive: true },
  { id: 't22', name: 'Ceretta Inguine', category: 'waxing', duration: 20, price: 18, requiresRoom: true, bufferBefore: 0, bufferAfter: 5, color: '#F97316', isActive: true },
  { id: 't23', name: 'Ceretta Baffetto', category: 'waxing', duration: 10, price: 8, requiresRoom: false, bufferBefore: 0, bufferAfter: 0, color: '#F97316', isActive: true },
  // Consultation
  { id: 't24', name: 'Consulenza Estetica', category: 'consultation', duration: 30, price: 0, requiresRoom: false, bufferBefore: 0, bufferAfter: 5, color: '#6366F1', isActive: true },
  { id: 't25', name: 'Analisi Pelle Digitale', category: 'consultation', duration: 20, price: 25, requiresRoom: true, bufferBefore: 0, bufferAfter: 5, color: '#6366F1', isActive: true },
];

// --- Clients ---
export const mockClients: Client[] = [
  { id: 'c1', firstName: 'Maria', lastName: 'Colombo', phone: '+39 333 0001001', email: 'maria.colombo@email.it', birthDate: '1985-03-15', gender: 'F', city: 'Milano', tags: ['VIP', 'Laser'], vipLevel: 3, loyaltyPoints: 2450, cashback: 45.50, gdprConsent: true, marketingConsent: true, createdAt: '2023-01-10', lastVisit: '2025-05-25', totalSpent: 4850, visitCount: 62, avgTicket: 78.23, notes: 'Preferisce appuntamenti mattutini', allergies: 'Nichel', preferences: ['Sara Rossi', 'Cabina 1'] },
  { id: 'c2', firstName: 'Laura', lastName: 'Ferrari', phone: '+39 333 0002002', email: 'laura.ferrari@email.it', birthDate: '1990-07-22', gender: 'F', city: 'Milano', tags: ['Abbonamento Attivo'], vipLevel: 2, loyaltyPoints: 1200, cashback: 22.00, gdprConsent: true, marketingConsent: true, createdAt: '2023-06-05', lastVisit: '2025-05-26', totalSpent: 2380, visitCount: 35, avgTicket: 68.00, preferences: ['Valentina Bianchi'] },
  { id: 'c3', firstName: 'Alessandra', lastName: 'Russo', phone: '+39 333 0003003', email: 'alessandra.russo@email.it', birthDate: '1978-11-08', gender: 'F', city: 'Milano', tags: ['VIP', 'Anti-Age'], vipLevel: 3, loyaltyPoints: 3100, cashback: 65.00, gdprConsent: true, marketingConsent: false, createdAt: '2022-09-20', lastVisit: '2025-05-24', totalSpent: 6200, visitCount: 78, avgTicket: 79.49 },
  { id: 'c4', firstName: 'Roberta', lastName: 'Esposito', phone: '+39 333 0004004', email: 'roberta.esposito@email.it', birthDate: '1995-02-14', gender: 'F', city: 'Milano', tags: ['Nuova', 'Consulenza'], vipLevel: 0, loyaltyPoints: 150, cashback: 0, gdprConsent: true, marketingConsent: true, createdAt: '2025-05-01', lastVisit: '2025-05-20', totalSpent: 195, visitCount: 3, avgTicket: 65.00 },
  { id: 'c5', firstName: 'Federica', lastName: 'Ricci', phone: '+39 333 0005005', email: 'federica.ricci@email.it', birthDate: '1988-09-30', gender: 'F', city: 'Milano', tags: ['Massaggi', 'Corpo'], vipLevel: 1, loyaltyPoints: 800, cashback: 12.00, gdprConsent: true, marketingConsent: true, createdAt: '2024-02-10', lastVisit: '2025-05-22', totalSpent: 1650, visitCount: 24, avgTicket: 68.75 },
  { id: 'c6', firstName: 'Silvia', lastName: 'Marino', phone: '+39 333 0006006', email: 'silvia.marino@email.it', birthDate: '1992-05-18', gender: 'F', city: 'Milano', tags: ['Unghie'], vipLevel: 1, loyaltyPoints: 600, cashback: 8.50, gdprConsent: true, marketingConsent: true, createdAt: '2024-06-15', lastVisit: '2025-05-23', totalSpent: 980, visitCount: 28, avgTicket: 35.00 },
  { id: 'c7', firstName: 'Claudia', lastName: 'Greco', phone: '+39 333 0007007', email: 'claudia.greco@email.it', birthDate: '1983-12-03', gender: 'F', city: 'Milano', tags: ['VIP', 'Corpo', 'Laser'], vipLevel: 2, loyaltyPoints: 1800, cashback: 32.00, gdprConsent: true, marketingConsent: true, createdAt: '2023-03-25', lastVisit: '2025-05-21', totalSpent: 3400, visitCount: 45, avgTicket: 75.56 },
  { id: 'c8', firstName: 'Monica', lastName: 'Bruno', phone: '+39 333 0008008', email: 'monica.bruno@email.it', birthDate: '1975-08-25', gender: 'F', city: 'Milano', tags: ['Anti-Age', 'Viso'], vipLevel: 2, loyaltyPoints: 2000, cashback: 38.00, gdprConsent: true, marketingConsent: false, createdAt: '2022-12-01', lastVisit: '2025-05-19', totalSpent: 4100, visitCount: 52, avgTicket: 78.85 },
  { id: 'c9', firstName: 'Elena', lastName: 'Galli', phone: '+39 333 0009009', email: 'elena.galli@email.it', birthDate: '1998-04-12', gender: 'F', city: 'Milano', tags: ['Nuova', 'Laser'], vipLevel: 0, loyaltyPoints: 300, cashback: 5.00, gdprConsent: true, marketingConsent: true, createdAt: '2025-03-10', lastVisit: '2025-05-18', totalSpent: 520, visitCount: 6, avgTicket: 86.67 },
  { id: 'c10', firstName: 'Giorgia', lastName: 'Costa', phone: '+39 333 0010010', email: 'giorgia.costa@email.it', birthDate: '1993-01-27', gender: 'F', city: 'Milano', tags: ['Dormiente'], vipLevel: 1, loyaltyPoints: 500, cashback: 0, gdprConsent: true, marketingConsent: true, createdAt: '2024-01-20', lastVisit: '2025-02-15', totalSpent: 890, visitCount: 12, avgTicket: 74.17 },
  { id: 'c11', firstName: 'Anna', lastName: 'Fontana', phone: '+39 333 0011011', email: 'anna.fontana@email.it', birthDate: '1980-06-09', gender: 'F', city: 'Milano', tags: ['VIP', 'Massaggi'], vipLevel: 3, loyaltyPoints: 2800, cashback: 55.00, gdprConsent: true, marketingConsent: true, createdAt: '2022-06-15', lastVisit: '2025-05-26', totalSpent: 5600, visitCount: 72, avgTicket: 77.78 },
  { id: 'c12', firstName: 'Paola', lastName: 'Mancini', phone: '+39 333 0012012', email: 'paola.mancini@email.it', birthDate: '1987-10-31', gender: 'F', city: 'Milano', tags: ['Corpo', 'Abbonamento Attivo'], vipLevel: 2, loyaltyPoints: 1500, cashback: 25.00, gdprConsent: true, marketingConsent: true, createdAt: '2023-08-20', lastVisit: '2025-05-24', totalSpent: 2900, visitCount: 38, avgTicket: 76.32 },
];

// --- Helper to generate today's appointments ---
function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const today = getTodayStr();

// --- Appointments (Today) ---
export const mockAppointments: Appointment[] = [
  // Sara Rossi (op1)
  { id: 'a1', clientId: 'c1', clientName: 'Maria Colombo', operatorId: 'op1', operatorName: 'Sara Rossi', treatmentId: 't1', treatmentName: 'Pulizia Viso Profonda', treatmentCategory: 'facial', roomId: 'r1', locationId: 'loc1', date: today, startTime: '09:00', endTime: '10:00', duration: 60, status: 'confirmed', price: 65, isLocked: false, color: '#8B5CF6', createdAt: '2025-05-20', updatedAt: '2025-05-20', createdBy: 'u1' },
  { id: 'a2', clientId: 'c3', clientName: 'Alessandra Russo', operatorId: 'op1', operatorName: 'Sara Rossi', treatmentId: 't2', treatmentName: 'Trattamento Anti-Age Premium', treatmentCategory: 'facial', roomId: 'r1', locationId: 'loc1', date: today, startTime: '10:15', endTime: '11:30', duration: 75, status: 'confirmed', price: 95, isLocked: false, color: '#8B5CF6', createdAt: '2025-05-18', updatedAt: '2025-05-18', createdBy: 'u1' },
  { id: 'a3', clientId: 'c8', clientName: 'Monica Bruno', operatorId: 'op1', operatorName: 'Sara Rossi', treatmentId: 't5', treatmentName: 'Radiofrequenza Viso', treatmentCategory: 'facial', roomId: 'r1', locationId: 'loc1', date: today, startTime: '11:45', endTime: '12:25', duration: 40, status: 'pending', price: 70, isLocked: false, color: '#8B5CF6', createdAt: '2025-05-22', updatedAt: '2025-05-22', createdBy: 'u1' },
  { id: 'a4', clientId: 'c11', clientName: 'Anna Fontana', operatorId: 'op1', operatorName: 'Sara Rossi', treatmentId: 't4', treatmentName: 'Trattamento Idratante Viso', treatmentCategory: 'facial', roomId: 'r1', locationId: 'loc1', date: today, startTime: '14:00', endTime: '14:50', duration: 50, status: 'confirmed', price: 55, isLocked: false, color: '#8B5CF6', createdAt: '2025-05-19', updatedAt: '2025-05-19', createdBy: 'u1' },
  { id: 'a5', clientId: 'c4', clientName: 'Roberta Esposito', operatorId: 'op1', operatorName: 'Sara Rossi', treatmentId: 't24', treatmentName: 'Consulenza Estetica', treatmentCategory: 'consultation', roomId: undefined, locationId: 'loc1', date: today, startTime: '15:00', endTime: '15:30', duration: 30, status: 'confirmed', price: 0, isLocked: false, color: '#6366F1', createdAt: '2025-05-24', updatedAt: '2025-05-24', createdBy: 'u1' },
  { id: 'a6', clientId: 'c12', clientName: 'Paola Mancini', operatorId: 'op1', operatorName: 'Sara Rossi', treatmentId: 't8', treatmentName: 'Trattamento Anticellulite', treatmentCategory: 'body', roomId: 'r2', locationId: 'loc1', date: today, startTime: '16:00', endTime: '17:00', duration: 60, status: 'confirmed', price: 75, isLocked: false, color: '#EC4899', createdAt: '2025-05-21', updatedAt: '2025-05-21', createdBy: 'u1' },

  // Valentina Bianchi (op2)
  { id: 'a7', clientId: 'c2', clientName: 'Laura Ferrari', operatorId: 'op2', operatorName: 'Valentina Bianchi', treatmentId: 't10', treatmentName: 'Epilazione Laser Gambe', treatmentCategory: 'laser', roomId: 'r3', locationId: 'loc1', date: today, startTime: '09:00', endTime: '09:45', duration: 45, status: 'completed', price: 120, isLocked: true, color: '#F59E0B', createdAt: '2025-05-15', updatedAt: '2025-05-27', createdBy: 'u1' },
  { id: 'a8', clientId: 'c9', clientName: 'Elena Galli', operatorId: 'op2', operatorName: 'Valentina Bianchi', treatmentId: 't11', treatmentName: 'Epilazione Laser Ascelle', treatmentCategory: 'laser', roomId: 'r3', locationId: 'loc1', date: today, startTime: '10:00', endTime: '10:15', duration: 15, status: 'confirmed', price: 40, isLocked: false, color: '#F59E0B', createdAt: '2025-05-20', updatedAt: '2025-05-20', createdBy: 'u1' },
  { id: 'a9', clientId: 'c9', clientName: 'Elena Galli', operatorId: 'op2', operatorName: 'Valentina Bianchi', treatmentId: 't12', treatmentName: 'Epilazione Laser Inguine', treatmentCategory: 'laser', roomId: 'r3', locationId: 'loc1', date: today, startTime: '10:15', endTime: '10:35', duration: 20, status: 'confirmed', price: 50, isLocked: false, color: '#F59E0B', createdAt: '2025-05-20', updatedAt: '2025-05-20', createdBy: 'u1' },
  { id: 'a10', clientId: 'c7', clientName: 'Claudia Greco', operatorId: 'op2', operatorName: 'Valentina Bianchi', treatmentId: 't13', treatmentName: 'Fotoringiovanimento IPL', treatmentCategory: 'laser', roomId: 'r3', locationId: 'loc1', date: today, startTime: '11:00', endTime: '11:30', duration: 30, status: 'confirmed', price: 90, isLocked: false, color: '#F59E0B', createdAt: '2025-05-22', updatedAt: '2025-05-22', createdBy: 'u1' },
  { id: 'a11', clientId: 'c5', clientName: 'Federica Ricci', operatorId: 'op2', operatorName: 'Valentina Bianchi', treatmentId: 't7', treatmentName: 'Bendaggio Drenante', treatmentCategory: 'body', roomId: 'r2', locationId: 'loc1', date: today, startTime: '14:30', endTime: '15:30', duration: 60, status: 'confirmed', price: 55, isLocked: false, color: '#EC4899', createdAt: '2025-05-23', updatedAt: '2025-05-23', createdBy: 'u1' },
  { id: 'a12', clientId: 'c1', clientName: 'Maria Colombo', operatorId: 'op2', operatorName: 'Valentina Bianchi', treatmentId: 't6', treatmentName: 'Pressoterapia', treatmentCategory: 'body', roomId: 'r2', locationId: 'loc1', date: today, startTime: '16:00', endTime: '16:45', duration: 45, status: 'confirmed', price: 40, isLocked: false, color: '#EC4899', createdAt: '2025-05-20', updatedAt: '2025-05-20', createdBy: 'u1' },

  // Chiara Moretti (op3)
  { id: 'a13', clientId: 'c11', clientName: 'Anna Fontana', operatorId: 'op3', operatorName: 'Chiara Moretti', treatmentId: 't14', treatmentName: 'Massaggio Rilassante 60min', treatmentCategory: 'massage', roomId: 'r4', locationId: 'loc1', date: today, startTime: '09:30', endTime: '10:30', duration: 60, status: 'in_progress', price: 65, isLocked: false, color: '#22C55E', createdAt: '2025-05-18', updatedAt: '2025-05-27', createdBy: 'u1' },
  { id: 'a14', clientId: 'c5', clientName: 'Federica Ricci', operatorId: 'op3', operatorName: 'Chiara Moretti', treatmentId: 't17', treatmentName: 'Hot Stone Massage', treatmentCategory: 'massage', roomId: 'r4', locationId: 'loc1', date: today, startTime: '11:00', endTime: '12:15', duration: 75, status: 'confirmed', price: 85, isLocked: false, color: '#22C55E', createdAt: '2025-05-22', updatedAt: '2025-05-22', createdBy: 'u1' },
  { id: 'a15', clientId: 'c3', clientName: 'Alessandra Russo', operatorId: 'op3', operatorName: 'Chiara Moretti', treatmentId: 't16', treatmentName: 'Massaggio Linfodrenante', treatmentCategory: 'massage', roomId: 'r4', locationId: 'loc1', date: today, startTime: '14:00', endTime: '15:00', duration: 60, status: 'confirmed', price: 70, isLocked: false, color: '#22C55E', createdAt: '2025-05-20', updatedAt: '2025-05-20', createdBy: 'u1' },
  { id: 'a16', clientId: 'c10', clientName: 'Giorgia Costa', operatorId: 'op3', operatorName: 'Chiara Moretti', treatmentId: 't15', treatmentName: 'Massaggio Decontratturante', treatmentCategory: 'massage', roomId: 'r4', locationId: 'loc1', date: today, startTime: '15:30', endTime: '16:20', duration: 50, status: 'pending', price: 60, notes: 'Cliente dormiente - recall riuscito!', isLocked: false, color: '#22C55E', createdAt: '2025-05-25', updatedAt: '2025-05-25', createdBy: 'u1' },

  // Francesca Romano (op4)
  { id: 'a17', clientId: 'c6', clientName: 'Silvia Marino', operatorId: 'op4', operatorName: 'Francesca Romano', treatmentId: 't18', treatmentName: 'Manicure Semipermanente', treatmentCategory: 'nails', roomId: 'r5', locationId: 'loc1', date: today, startTime: '09:00', endTime: '09:45', duration: 45, status: 'completed', price: 30, isLocked: true, color: '#3B82F6', createdAt: '2025-05-19', updatedAt: '2025-05-27', createdBy: 'u1' },
  { id: 'a18', clientId: 'c2', clientName: 'Laura Ferrari', operatorId: 'op4', operatorName: 'Francesca Romano', treatmentId: 't20', treatmentName: 'Ricostruzione Unghie Gel', treatmentCategory: 'nails', roomId: 'r5', locationId: 'loc1', date: today, startTime: '10:00', endTime: '11:30', duration: 90, status: 'confirmed', price: 55, isLocked: false, color: '#3B82F6', createdAt: '2025-05-21', updatedAt: '2025-05-21', createdBy: 'u1' },
  { id: 'a19', clientId: 'c7', clientName: 'Claudia Greco', operatorId: 'op4', operatorName: 'Francesca Romano', treatmentId: 't21', treatmentName: 'Ceretta Gambe Intere', treatmentCategory: 'waxing', locationId: 'loc1', date: today, startTime: '11:45', endTime: '12:15', duration: 30, status: 'confirmed', price: 25, isLocked: false, color: '#F97316', createdAt: '2025-05-22', updatedAt: '2025-05-22', createdBy: 'u1' },
  { id: 'a20', clientId: 'c12', clientName: 'Paola Mancini', operatorId: 'op4', operatorName: 'Francesca Romano', treatmentId: 't19', treatmentName: 'Pedicure Curativa', treatmentCategory: 'nails', roomId: 'r5', locationId: 'loc1', date: today, startTime: '14:00', endTime: '14:50', duration: 50, status: 'confirmed', price: 35, isLocked: false, color: '#3B82F6', createdAt: '2025-05-23', updatedAt: '2025-05-23', createdBy: 'u1' },
  { id: 'a21', clientId: 'c8', clientName: 'Monica Bruno', operatorId: 'op4', operatorName: 'Francesca Romano', treatmentId: 't22', treatmentName: 'Ceretta Inguine', treatmentCategory: 'waxing', locationId: 'loc1', date: today, startTime: '15:00', endTime: '15:20', duration: 20, status: 'no_show', price: 18, isLocked: false, color: '#F97316', createdAt: '2025-05-20', updatedAt: '2025-05-27', createdBy: 'u1' },

  // Alessia Conti (op5)
  { id: 'a22', clientId: 'c4', clientName: 'Roberta Esposito', operatorId: 'op5', operatorName: 'Alessia Conti', treatmentId: 't3', treatmentName: 'Peeling Chimico', treatmentCategory: 'facial', roomId: 'r1', locationId: 'loc1', date: today, startTime: '10:00', endTime: '10:45', duration: 45, status: 'confirmed', price: 80, isLocked: false, color: '#8B5CF6', createdAt: '2025-05-24', updatedAt: '2025-05-24', createdBy: 'u1' },
  { id: 'a23', clientId: 'c6', clientName: 'Silvia Marino', operatorId: 'op5', operatorName: 'Alessia Conti', treatmentId: 't25', treatmentName: 'Analisi Pelle Digitale', treatmentCategory: 'consultation', roomId: 'r1', locationId: 'loc1', date: today, startTime: '11:00', endTime: '11:20', duration: 20, status: 'confirmed', price: 25, isLocked: false, color: '#6366F1', createdAt: '2025-05-25', updatedAt: '2025-05-25', createdBy: 'u1' },
  { id: 'a24', clientId: 'c1', clientName: 'Maria Colombo', operatorId: 'op5', operatorName: 'Alessia Conti', treatmentId: 't2', treatmentName: 'Trattamento Anti-Age Premium', treatmentCategory: 'facial', roomId: 'r1', locationId: 'loc1', date: today, startTime: '15:00', endTime: '16:15', duration: 75, status: 'confirmed', price: 95, isLocked: false, color: '#8B5CF6', createdAt: '2025-05-18', updatedAt: '2025-05-18', createdBy: 'u1' },
  { id: 'a25', clientId: 'c7', clientName: 'Claudia Greco', operatorId: 'op5', operatorName: 'Alessia Conti', treatmentId: 't9', treatmentName: 'Scrub Corpo Completo', treatmentCategory: 'body', roomId: 'r2', locationId: 'loc1', date: today, startTime: '16:30', endTime: '17:15', duration: 45, status: 'waitlist', price: 50, isLocked: false, color: '#EC4899', createdAt: '2025-05-26', updatedAt: '2025-05-26', createdBy: 'u1' },
];

// --- Dashboard KPI ---
export const mockDashboardKPI: DashboardKPI = {
  revenueToday: 1845,
  revenueTrend: 12.5,
  appointmentsToday: 25,
  appointmentsTrend: 8.3,
  newClientsToday: 2,
  newClientsTrend: -14.3,
  occupancyRate: 82,
  occupancyTrend: 5.1,
  noShowRate: 4,
  avgTicket: 73.80,
};

// --- Revenue Chart Data (Last 7 days) ---
export const mockRevenueData: RevenueDataPoint[] = [
  { date: '2025-05-21', label: 'Lun', revenue: 1650, services: 1320, products: 330 },
  { date: '2025-05-22', label: 'Mar', revenue: 1920, services: 1540, products: 380 },
  { date: '2025-05-23', label: 'Mer', revenue: 1480, services: 1200, products: 280 },
  { date: '2025-05-24', label: 'Gio', revenue: 2100, services: 1680, products: 420 },
  { date: '2025-05-25', label: 'Ven', revenue: 1780, services: 1420, products: 360 },
  { date: '2025-05-26', label: 'Sab', revenue: 1350, services: 1080, products: 270 },
  { date: '2025-05-27', label: 'Oggi', revenue: 1845, services: 1476, products: 369 },
];

// --- Recent Activity ---
export const mockActivities: Activity[] = [
  { id: 'act1', type: 'appointment_completed', title: 'Appuntamento completato', description: 'Epilazione Laser Gambe — Laura Ferrari con Valentina Bianchi', timestamp: '2025-05-27T09:45:00', userId: 'u1', icon: 'check-circle', color: '#22C55E' },
  { id: 'act2', type: 'appointment_completed', title: 'Appuntamento completato', description: 'Manicure Semipermanente — Silvia Marino con Francesca Romano', timestamp: '2025-05-27T09:45:00', userId: 'u1', icon: 'check-circle', color: '#22C55E' },
  { id: 'act3', type: 'no_show', title: 'No-Show registrato', description: 'Ceretta Inguine — Monica Bruno non si è presentata', timestamp: '2025-05-27T15:20:00', userId: 'u1', icon: 'user-x', color: '#EF4444' },
  { id: 'act4', type: 'client_added', title: 'Nuova cliente registrata', description: 'Sofia Lombardi — via prenotazione online', timestamp: '2025-05-27T08:30:00', userId: 'u1', icon: 'user-plus', color: '#3B82F6' },
  { id: 'act5', type: 'payment_received', title: 'Pagamento ricevuto', description: '€120.00 — Laura Ferrari (Carta)', timestamp: '2025-05-27T09:48:00', userId: 'u1', icon: 'credit-card', color: '#A855F7' },
  { id: 'act6', type: 'appointment_created', title: 'Nuovo appuntamento', description: 'Hot Stone Massage — Federica Ricci, dom 28/05 ore 11:00', timestamp: '2025-05-27T10:15:00', userId: 'u1', icon: 'calendar-plus', color: '#EC4899' },
  { id: 'act7', type: 'appointment_cancelled', title: 'Appuntamento annullato', description: 'Pulizia Viso — Giorgia Costa ha cancellato', timestamp: '2025-05-27T07:50:00', userId: 'u1', icon: 'calendar-x', color: '#F59E0B' },
];

// --- Notifications ---
export const mockNotifications: AppNotification[] = [
  { id: 'n1', type: 'appointment', title: 'Appuntamento tra 15 min', message: 'Alessandra Russo — Trattamento Anti-Age con Sara Rossi', isRead: false, createdAt: '2025-05-27T10:00:00' },
  { id: 'n2', type: 'client', title: 'Compleanno cliente!', message: 'Oggi è il compleanno di Roberta Esposito 🎂', isRead: false, createdAt: '2025-05-27T08:00:00' },
  { id: 'n3', type: 'stock', title: 'Scorta bassa', message: 'Crema Anti-Age Professional — solo 3 pezzi rimasti', isRead: false, createdAt: '2025-05-27T07:00:00' },
  { id: 'n4', type: 'payment', title: 'Pagamento in sospeso', message: 'Claudia Greco — rata abbonamento scaduta da 3 giorni', isRead: true, createdAt: '2025-05-26T18:00:00' },
  { id: 'n5', type: 'marketing', title: 'Campagna recall completata', message: '15 clienti dormienti contattati — 4 hanno prenotato', isRead: true, createdAt: '2025-05-26T14:00:00' },
];

// --- Products (for future POS/Inventory) ---
export const mockProducts: Product[] = [
  { id: 'p1', name: 'Crema Idratante Viso SPF30', brand: 'Revo Professional', category: 'Viso', sku: 'RP-V001', price: 42, costPrice: 18, stock: 12, minStock: 5, locationId: 'loc1', isActive: true },
  { id: 'p2', name: 'Siero Anti-Age Acido Ialuronico', brand: 'Revo Professional', category: 'Viso', sku: 'RP-V002', price: 58, costPrice: 24, stock: 8, minStock: 4, locationId: 'loc1', isActive: true },
  { id: 'p3', name: 'Olio Corpo Drenante', brand: 'Revo Professional', category: 'Corpo', sku: 'RP-C001', price: 35, costPrice: 15, stock: 15, minStock: 6, locationId: 'loc1', isActive: true },
  { id: 'p4', name: 'Crema Anticellulite Intensiva', brand: 'Revo Professional', category: 'Corpo', sku: 'RP-C002', price: 48, costPrice: 20, stock: 3, minStock: 5, locationId: 'loc1', isActive: true },
  { id: 'p5', name: 'Gel Post Laser Lenitivo', brand: 'Revo Professional', category: 'Laser', sku: 'RP-L001', price: 28, costPrice: 12, stock: 20, minStock: 8, locationId: 'loc1', isActive: true },
];
