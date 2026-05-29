/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Prisma Seed Script
 * Populates the PostgreSQL database with all the mock data currently used locally.
 *
 * Run with: npx prisma db seed
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.appointment.deleteMany();
  await prisma.clientPackage.deleteMany();
  await prisma.giftCard.deleteMany();
  await prisma.posTransaction.deleteMany();
  await prisma.client.deleteMany();
  await prisma.operator.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.package.deleteMany();

  // ============================================================
  // OPERATORS
  // ============================================================
  console.log('  👩‍💼 Creating operators...');
  const operators = [
    { id: 'op1', firstName: 'Sara', lastName: 'Rossi', color: '#A855F7', specializations: ['facial', 'body', 'consultation'], locationIds: ['loc1'], isActive: true, phone: '+39 340 1111111', email: 'sara@revobeauty.it', commission: 15, hireDate: '2022-03-01', schedule: { 1: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' }, 2: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' }, 3: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' }, 4: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' }, 5: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' }, 6: { isWorking: false, startTime: '09:00', endTime: '14:00' } } },
    { id: 'op2', firstName: 'Valentina', lastName: 'Bianchi', color: '#EC4899', specializations: ['laser', 'body', 'facial'], locationIds: ['loc1'], isActive: true, phone: '+39 340 2222222', email: 'valentina@revobeauty.it', commission: 15, hireDate: '2023-01-15', schedule: { 1: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' }, 2: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' }, 3: { isWorking: false, startTime: '09:00', endTime: '14:00' }, 4: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' }, 5: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' }, 6: { isWorking: true, startTime: '09:00', endTime: '14:00' } } },
    { id: 'op3', firstName: 'Chiara', lastName: 'Moretti', color: '#3B82F6', specializations: ['massage', 'body'], locationIds: ['loc1'], isActive: true, phone: '+39 340 3333333', email: 'chiara@revobeauty.it', commission: 12, hireDate: '2023-06-01', schedule: { 1: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' }, 2: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' }, 3: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' }, 4: { isWorking: false, startTime: '09:00', endTime: '14:00' }, 5: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' }, 6: { isWorking: true, startTime: '09:00', endTime: '15:00' } } },
    { id: 'op4', firstName: 'Francesca', lastName: 'Romano', color: '#22C55E', specializations: ['nails', 'waxing', 'makeup'], locationIds: ['loc1'], isActive: true, phone: '+39 340 4444444', email: 'francesca@revobeauty.it', commission: 10, hireDate: '2024-02-01', schedule: { 1: { isWorking: true, startTime: '09:00', endTime: '17:00', breakStart: '12:30', breakEnd: '13:30' }, 2: { isWorking: true, startTime: '09:00', endTime: '17:00', breakStart: '12:30', breakEnd: '13:30' }, 3: { isWorking: true, startTime: '09:00', endTime: '17:00', breakStart: '12:30', breakEnd: '13:30' }, 4: { isWorking: true, startTime: '09:00', endTime: '17:00', breakStart: '12:30', breakEnd: '13:30' }, 5: { isWorking: false, startTime: '09:00', endTime: '14:00' }, 6: { isWorking: true, startTime: '09:00', endTime: '14:00' } } },
    { id: 'op5', firstName: 'Alessia', lastName: 'Conti', color: '#F59E0B', specializations: ['facial', 'consultation', 'hair'], locationIds: ['loc1'], isActive: true, phone: '+39 340 5555555', email: 'alessia@revobeauty.it', commission: 12, hireDate: '2024-09-01', schedule: { 1: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' }, 2: { isWorking: false, startTime: '09:00', endTime: '14:00' }, 3: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' }, 4: { isWorking: true, startTime: '10:00', endTime: '19:00', breakStart: '14:00', breakEnd: '15:00' }, 5: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' }, 6: { isWorking: false, startTime: '09:00', endTime: '14:00' } } },
  ];
  for (const op of operators) {
    await prisma.operator.create({ data: op });
  }

  // ============================================================
  // TREATMENTS
  // ============================================================
  console.log('  💅 Creating treatments...');
  const treatments = [
    { id: 'tr1', name: 'Pulizia Viso Profonda', category: 'facial', duration: 60, price: 75, color: '#A855F7', isActive: true, requiresRoom: true, bufferBefore: 0, bufferAfter: 10 },
    { id: 'tr2', name: 'Trattamento Anti-Age Premium', category: 'facial', duration: 90, price: 120, color: '#A855F7', isActive: true, requiresRoom: true, bufferBefore: 5, bufferAfter: 10, description: 'Trattamento completo con acido ialuronico e vitamina C' },
    { id: 'tr3', name: 'Epilazione Laser', category: 'laser', duration: 45, price: 95, color: '#EC4899', isActive: true, requiresRoom: true, requiresEquipment: 'Laser Alexandrite', bufferBefore: 5, bufferAfter: 15 },
    { id: 'tr4', name: 'Massaggio Rilassante', category: 'massage', duration: 60, price: 65, color: '#3B82F6', isActive: true, requiresRoom: true, bufferBefore: 0, bufferAfter: 10 },
    { id: 'tr5', name: 'Massaggio Decontratturante', category: 'massage', duration: 50, price: 70, color: '#3B82F6', isActive: true, requiresRoom: true, bufferBefore: 0, bufferAfter: 10 },
    { id: 'tr6', name: 'Manicure Semipermanente', category: 'nails', duration: 45, price: 35, color: '#22C55E', isActive: true, requiresRoom: false, bufferBefore: 0, bufferAfter: 5 },
    { id: 'tr7', name: 'Pedicure Estetico', category: 'nails', duration: 50, price: 40, color: '#22C55E', isActive: true, requiresRoom: false, bufferBefore: 0, bufferAfter: 5 },
    { id: 'tr8', name: 'Ceretta Gambe Complete', category: 'waxing', duration: 30, price: 30, color: '#F59E0B', isActive: true, requiresRoom: true, bufferBefore: 0, bufferAfter: 5 },
    { id: 'tr9', name: 'Ceretta Inguine', category: 'waxing', duration: 20, price: 20, color: '#F59E0B', isActive: true, requiresRoom: true, bufferBefore: 0, bufferAfter: 5 },
    { id: 'tr10', name: 'Radiofrequenza Viso', category: 'facial', duration: 45, price: 85, color: '#A855F7', isActive: true, requiresRoom: true, bufferBefore: 5, bufferAfter: 10 },
    { id: 'tr11', name: 'Peeling Chimico', category: 'facial', duration: 40, price: 65, color: '#A855F7', isActive: true, requiresRoom: true, bufferBefore: 0, bufferAfter: 15 },
    { id: 'tr12', name: 'Trattamento Corpo Rassodante', category: 'body', duration: 75, price: 90, color: '#14B8A6', isActive: true, requiresRoom: true, bufferBefore: 5, bufferAfter: 10 },
    { id: 'tr13', name: 'Pressoterapia', category: 'body', duration: 40, price: 45, color: '#14B8A6', isActive: true, requiresRoom: true, bufferBefore: 0, bufferAfter: 5 },
    { id: 'tr14', name: 'Consulenza Estetica', category: 'consultation', duration: 30, price: 0, color: '#6366F1', isActive: true, requiresRoom: false, bufferBefore: 0, bufferAfter: 0, description: 'Prima consulenza gratuita' },
    { id: 'tr15', name: 'Make-Up Sposa', category: 'makeup', duration: 90, price: 150, color: '#EC4899', isActive: true, requiresRoom: false, bufferBefore: 10, bufferAfter: 0 },
    { id: 'tr16', name: 'Laminazione Ciglia', category: 'facial', duration: 45, price: 55, color: '#A855F7', isActive: true, requiresRoom: false, bufferBefore: 0, bufferAfter: 5 },
  ];
  for (const t of treatments) {
    await prisma.treatment.create({ data: t });
  }

  // ============================================================
  // CLIENTS
  // ============================================================
  console.log('  👤 Creating clients...');
  const clients = [
    { id: 'c1', firstName: 'Maria', lastName: 'Colombo', phone: '+39 333 1001001', email: 'maria.colombo@email.it', birthDate: '1985-03-15', gender: 'F', tags: ['VIP', 'Anti-Age'], vipLevel: 3, loyaltyPoints: 2450, gdprConsent: true, marketingConsent: true, createdAt: '2024-06-15', lastVisit: '2026-05-24', totalSpent: 4250, visitCount: 52, avgTicket: 82 },
    { id: 'c2', firstName: 'Laura', lastName: 'Ferrari', phone: '+39 333 1002002', email: 'laura.ferrari@email.it', birthDate: '1990-07-22', gender: 'F', tags: ['Laser', 'Fedele'], vipLevel: 2, loyaltyPoints: 1800, gdprConsent: true, marketingConsent: true, createdAt: '2024-09-01', lastVisit: '2026-05-15', totalSpent: 3100, visitCount: 38, avgTicket: 82 },
    { id: 'c3', firstName: 'Anna', lastName: 'Fontana', phone: '+39 333 1003003', email: 'anna.fontana@email.it', birthDate: '1978-11-08', gender: 'F', tags: ['Massaggi'], vipLevel: 1, loyaltyPoints: 950, gdprConsent: true, marketingConsent: false, createdAt: '2025-01-10', lastVisit: '2026-05-09', totalSpent: 1650, visitCount: 24, avgTicket: 69 },
    { id: 'c4', firstName: 'Paola', lastName: 'Mancini', phone: '+39 333 1004004', email: 'paola.mancini@email.it', birthDate: '1995-05-30', gender: 'F', tags: ['Corpo', 'Nuova'], vipLevel: 0, loyaltyPoints: 320, gdprConsent: true, marketingConsent: true, createdAt: '2025-11-20', lastVisit: '2026-05-20', totalSpent: 780, visitCount: 10, avgTicket: 78 },
    { id: 'c5', firstName: 'Claudia', lastName: 'Greco', phone: '+39 333 1005005', email: 'claudia.greco@email.it', birthDate: '1982-09-12', gender: 'F', tags: ['VIP', 'Anti-Age', 'Fedele'], vipLevel: 3, loyaltyPoints: 3100, gdprConsent: true, marketingConsent: true, createdAt: '2024-03-01', lastVisit: '2026-04-10', totalSpent: 5200, visitCount: 65, avgTicket: 80 },
    { id: 'c6', firstName: 'Elena', lastName: 'Bianchi', phone: '+39 333 1006006', email: 'elena.bianchi@email.it', birthDate: '1992-01-25', gender: 'F', tags: ['Unghie'], vipLevel: 1, loyaltyPoints: 600, gdprConsent: true, marketingConsent: true, createdAt: '2025-06-01', lastVisit: '2026-05-22', totalSpent: 890, visitCount: 18, avgTicket: 49 },
    { id: 'c7', firstName: 'Francesca', lastName: 'Verdi', phone: '+39 333 1007007', email: 'francesca.verdi@email.it', birthDate: '1988-04-18', gender: 'F', tags: ['Viso'], vipLevel: 2, loyaltyPoints: 1400, gdprConsent: true, marketingConsent: false, createdAt: '2024-11-15', lastVisit: '2026-05-18', totalSpent: 2350, visitCount: 30, avgTicket: 78 },
    { id: 'c8', firstName: 'Giulia', lastName: 'Rossi', phone: '+39 333 1008008', email: 'giulia.rossi@email.it', birthDate: '1996-12-03', gender: 'F', tags: ['Laser', 'Nuova'], vipLevel: 0, loyaltyPoints: 180, gdprConsent: true, marketingConsent: true, createdAt: '2026-03-01', lastVisit: '2026-05-25', totalSpent: 380, visitCount: 5, avgTicket: 76 },
    { id: 'c9', firstName: 'Sofia', lastName: 'Esposito', phone: '+39 333 1009009', email: 'sofia.esposito@email.it', birthDate: '2000-08-14', gender: 'F', tags: ['Corpo', 'Fitness'], vipLevel: 1, loyaltyPoints: 720, gdprConsent: true, marketingConsent: true, createdAt: '2025-04-15', lastVisit: '2026-05-12', totalSpent: 1200, visitCount: 16, avgTicket: 75 },
    { id: 'c10', firstName: 'Valentina', lastName: 'Ricci', phone: '+39 333 1010010', email: 'valentina.ricci@email.it', birthDate: '1975-06-21', gender: 'F', tags: ['VIP', 'Premium'], vipLevel: 3, loyaltyPoints: 4200, gdprConsent: true, marketingConsent: true, createdAt: '2024-01-20', lastVisit: '2026-05-27', totalSpent: 7800, visitCount: 85, avgTicket: 92 },
  ];
  for (const c of clients) {
    await prisma.client.create({ data: c });
  }

  // ============================================================
  // PACKAGES (Catalog)
  // ============================================================
  console.log('  📦 Creating packages...');
  const packages = [
    { id: 'pkg-1', name: 'Pacchetto Anti-Age 10 Sedute', type: 'Sessioni', price: 850, totalSessions: 10, sold: 24, color: '#8B5CF6', treatmentName: 'Trattamento Anti-Age Premium' },
    { id: 'pkg-2', name: 'Pacchetto Laser 8 Sedute', type: 'Sessioni', price: 720, totalSessions: 8, sold: 18, color: '#F59E0B', treatmentName: 'Epilazione Laser' },
    { id: 'pkg-3', name: 'Combo Viso + Corpo 5+5', type: 'Bundle', price: 520, totalSessions: 10, sold: 12, color: '#22C55E', treatmentName: 'Combo Viso + Corpo' },
    { id: 'pkg-4', name: 'Pacchetto Massaggi Relax', type: 'Sessioni', price: 350, totalSessions: 6, sold: 31, color: '#3B82F6', treatmentName: 'Massaggio Rilassante' },
    { id: 'pkg-5', name: 'Pacchetto Peeling 5 Sedute', type: 'Sessioni', price: 300, totalSessions: 5, sold: 8, color: '#EC4899', treatmentName: 'Peeling Chimico' },
  ];
  for (const p of packages) {
    await prisma.package.create({ data: p });
  }

  // ============================================================
  // CLIENT PACKAGES
  // ============================================================
  console.log('  🔗 Creating client packages...');
  const clientPackages = [
    { id: 'cp-1', clientName: 'Maria Colombo', packageName: 'Pacchetto Anti-Age 10 Sedute', packageColor: '#8B5CF6', totalSessions: 10, usedSessions: 6, pricePaid: 850, totalPaid: 850, remainingBalance: 0, paymentPlan: 'full', purchaseDate: '2026-03-10', expiryDate: '2027-03-10', status: 'active', clientId: 'c1', packageId: 'pkg-1', payments: JSON.stringify([{ id: 'pay-1', date: '2026-03-10', amount: 850, method: 'Carta', operator: 'Sara Rossi' }]), history: JSON.stringify([{ date: '2026-03-15', operator: 'Sara Rossi' }, { date: '2026-03-29', operator: 'Sara Rossi' }, { date: '2026-04-12', operator: 'Valentina Bianchi' }, { date: '2026-04-26', operator: 'Sara Rossi' }, { date: '2026-05-10', operator: 'Chiara Moretti' }, { date: '2026-05-24', operator: 'Sara Rossi' }]) },
    { id: 'cp-2', clientName: 'Laura Ferrari', packageName: 'Pacchetto Laser 8 Sedute', packageColor: '#F59E0B', totalSessions: 8, usedSessions: 3, pricePaid: 720, totalPaid: 400, remainingBalance: 320, paymentPlan: 'installments', purchaseDate: '2026-04-01', expiryDate: '2027-04-01', status: 'active', clientId: 'c2', packageId: 'pkg-2', payments: JSON.stringify([{ id: 'pay-2', date: '2026-04-01', amount: 400, method: 'Carta', operator: 'Sara Rossi' }]), history: JSON.stringify([{ date: '2026-04-10', operator: 'Valentina Bianchi' }, { date: '2026-04-24', operator: 'Valentina Bianchi' }, { date: '2026-05-15', operator: 'Valentina Bianchi' }]) },
    { id: 'cp-3', clientName: 'Anna Fontana', packageName: 'Pacchetto Massaggi Relax', packageColor: '#3B82F6', totalSessions: 6, usedSessions: 5, pricePaid: 350, totalPaid: 350, remainingBalance: 0, paymentPlan: 'full', purchaseDate: '2026-02-15', expiryDate: '2027-02-15', status: 'expiring', clientId: 'c3', packageId: 'pkg-4', payments: JSON.stringify([{ id: 'pay-3', date: '2026-02-15', amount: 350, method: 'Contanti', operator: 'Chiara Moretti' }]), history: JSON.stringify([{ date: '2026-02-28', operator: 'Chiara Moretti' }, { date: '2026-03-14', operator: 'Chiara Moretti' }, { date: '2026-03-28', operator: 'Chiara Moretti' }, { date: '2026-04-18', operator: 'Chiara Moretti' }, { date: '2026-05-09', operator: 'Sara Rossi' }]) },
    { id: 'cp-4', clientName: 'Paola Mancini', packageName: 'Combo Viso + Corpo 5+5', packageColor: '#22C55E', totalSessions: 10, usedSessions: 3, pricePaid: 520, totalPaid: 200, remainingBalance: 320, paymentPlan: 'installments', purchaseDate: '2026-05-01', expiryDate: '2027-05-01', status: 'active', clientId: 'c4', packageId: 'pkg-3', payments: JSON.stringify([{ id: 'pay-4', date: '2026-05-01', amount: 200, method: 'Satispay', operator: 'Francesca Romano' }]), history: JSON.stringify([{ date: '2026-05-05', operator: 'Francesca Romano' }, { date: '2026-05-12', operator: 'Francesca Romano' }, { date: '2026-05-20', operator: 'Sara Rossi' }]) },
    { id: 'cp-5', clientName: 'Claudia Greco', packageName: 'Pacchetto Anti-Age 10 Sedute', packageColor: '#8B5CF6', totalSessions: 10, usedSessions: 10, pricePaid: 850, totalPaid: 850, remainingBalance: 0, paymentPlan: 'full', purchaseDate: '2025-12-01', expiryDate: '2026-12-01', status: 'completed', clientId: 'c5', packageId: 'pkg-1', payments: JSON.stringify([{ id: 'pay-5', date: '2025-12-01', amount: 850, method: 'Carta', operator: 'Sara Rossi' }]), history: JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ date: `2026-0${Math.floor(i / 3) + 1}-${String((i % 3 + 1) * 8).padStart(2, '0')}`, operator: 'Sara Rossi' }))) },
  ];
  for (const cp of clientPackages) {
    await prisma.clientPackage.create({ data: cp });
  }

  // ============================================================
  // GIFT CARDS
  // ============================================================
  console.log('  🎁 Creating gift cards...');
  const giftCards = [
    { id: 'gc-1', code: 'RB-2026-K7M3', purchasedBy: 'Marco Rossi', recipientName: 'Giulia Rossi', amount: 150, remainingBalance: 150, purchaseDate: '2026-05-10', expiryDate: '2027-05-10', paymentMethod: 'Carta', purchaseOperator: 'Sara Rossi', status: 'active', message: 'Buon compleanno amore! ❤️', transactions: JSON.stringify([]), buyerId: 'c8' },
    { id: 'gc-2', code: 'RB-2026-P9R2', purchasedBy: 'Elena Bianchi', recipientName: 'Francesca Verdi', amount: 100, remainingBalance: 35, purchaseDate: '2026-04-15', expiryDate: '2027-04-15', paymentMethod: 'Contanti', purchaseOperator: 'Valentina Bianchi', status: 'partial', message: 'Per la tua festa! 🎉', transactions: JSON.stringify([{ id: 'gct-1', date: '2026-04-28', amount: 65, service: 'Pulizia Viso Profonda', operator: 'Sara Rossi' }]), buyerId: 'c6' },
    { id: 'gc-3', code: 'RB-2026-W5T1', purchasedBy: 'Anna Colombo', recipientName: 'Laura Ferrari', amount: 200, remainingBalance: 0, purchaseDate: '2026-02-14', expiryDate: '2027-02-14', paymentMethod: 'Carta', purchaseOperator: 'Chiara Moretti', status: 'used', message: 'San Valentino 💕', transactions: JSON.stringify([{ id: 'gct-2', date: '2026-03-01', amount: 95, service: 'Trattamento Anti-Age Premium', operator: 'Sara Rossi' }, { id: 'gct-3', date: '2026-03-20', amount: 70, service: 'Radiofrequenza Viso', operator: 'Chiara Moretti' }, { id: 'gct-4', date: '2026-04-10', amount: 35, service: 'Manicure Semipermanente', operator: 'Francesca Romano' }]) },
  ];
  for (const gc of giftCards) {
    await prisma.giftCard.create({ data: gc });
  }

  // ============================================================
  // APPOINTMENTS (today's)
  // ============================================================
  console.log('  📅 Creating appointments...');
  const today = new Date().toISOString().split('T')[0];
  const appointments = [
    { id: 'apt-1', clientId: 'c1', clientName: 'Maria Colombo', operatorId: 'op1', operatorName: 'Sara Rossi', treatmentId: 'tr2', treatmentName: 'Trattamento Anti-Age Premium', treatmentCategory: 'facial', locationId: 'loc-1', date: today, startTime: '09:00', endTime: '10:30', duration: 90, status: 'confirmed', price: 120, color: '#A855F7', isLocked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'u1' },
    { id: 'apt-2', clientId: 'c2', clientName: 'Laura Ferrari', operatorId: 'op2', operatorName: 'Valentina Bianchi', treatmentId: 'tr3', treatmentName: 'Epilazione Laser', treatmentCategory: 'laser', locationId: 'loc-1', date: today, startTime: '09:30', endTime: '10:15', duration: 45, status: 'confirmed', price: 95, color: '#EC4899', isLocked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'u1' },
    { id: 'apt-3', clientId: 'c3', clientName: 'Anna Fontana', operatorId: 'op3', operatorName: 'Chiara Moretti', treatmentId: 'tr4', treatmentName: 'Massaggio Rilassante', treatmentCategory: 'massage', locationId: 'loc-1', date: today, startTime: '10:00', endTime: '11:00', duration: 60, status: 'confirmed', price: 65, color: '#3B82F6', isLocked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'u1' },
    { id: 'apt-4', clientId: 'c6', clientName: 'Elena Bianchi', operatorId: 'op4', operatorName: 'Francesca Romano', treatmentId: 'tr6', treatmentName: 'Manicure Semipermanente', treatmentCategory: 'nails', locationId: 'loc-1', date: today, startTime: '09:00', endTime: '09:45', duration: 45, status: 'completed', price: 35, color: '#22C55E', isLocked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'u1' },
    { id: 'apt-5', clientId: 'c7', clientName: 'Francesca Verdi', operatorId: 'op1', operatorName: 'Sara Rossi', treatmentId: 'tr10', treatmentName: 'Radiofrequenza Viso', treatmentCategory: 'facial', locationId: 'loc-1', date: today, startTime: '11:00', endTime: '11:45', duration: 45, status: 'pending', price: 85, color: '#A855F7', isLocked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'u1' },
    { id: 'apt-6', clientId: 'c10', clientName: 'Valentina Ricci', operatorId: 'op5', operatorName: 'Alessia Conti', treatmentId: 'tr1', treatmentName: 'Pulizia Viso Profonda', treatmentCategory: 'facial', locationId: 'loc-1', date: today, startTime: '14:00', endTime: '15:00', duration: 60, status: 'confirmed', price: 75, color: '#F59E0B', isLocked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'u1' },
  ];
  for (const a of appointments) {
    await prisma.appointment.create({ data: a });
  }

  console.log('✅ Database seeded successfully!');
  console.log(`   ${operators.length} operators`);
  console.log(`   ${treatments.length} treatments`);
  console.log(`   ${clients.length} clients`);
  console.log(`   ${packages.length} packages`);
  console.log(`   ${clientPackages.length} client packages`);
  console.log(`   ${giftCards.length} gift cards`);
  console.log(`   ${appointments.length} appointments`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
