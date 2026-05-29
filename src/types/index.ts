// ============================================================
// Revobeauty — TypeScript Type Definitions
// ============================================================

// --- Auth & Users ---
export type UserRole = 'super_admin' | 'owner' | 'manager' | 'receptionist' | 'operator' | 'commercial' | 'warehouse';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  locationIds: string[];
  isActive: boolean;
  createdAt: string;
}

// --- Locations ---
export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  openingHours: DaySchedule[];
  isActive: boolean;
}

export interface DaySchedule {
  day: number; // 0=Sun, 1=Mon...6=Sat
  isOpen: boolean;
  openTime: string; // "09:00"
  closeTime: string; // "20:00"
  breakStart?: string;
  breakEnd?: string;
}

// --- Clients ---
export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  birthDate?: string;
  gender?: 'F' | 'M' | 'other';
  address?: string;
  city?: string;
  notes?: string;
  privateNotes?: string;
  allergies?: string;
  preferences?: string[];
  tags: string[];
  vipLevel: 0 | 1 | 2 | 3;
  loyaltyPoints: number;
  cashback: number;
  gdprConsent: boolean;
  marketingConsent: boolean;
  avatar?: string;
  createdAt: string;
  lastVisit?: string;
  totalSpent: number;
  visitCount: number;
  avgTicket: number;
  referredBy?: string;
}

// --- Treatments ---
export type TreatmentCategory = 'facial' | 'body' | 'laser' | 'massage' | 'nails' | 'waxing' | 'consultation' | 'hair' | 'makeup';

export interface Treatment {
  id: string;
  name: string;
  category: TreatmentCategory;
  duration: number; // minutes
  price: number;
  description?: string;
  requiresRoom: boolean;
  requiresEquipment?: string;
  bufferBefore: number; // minutes
  bufferAfter: number; // minutes
  color: string;
  isActive: boolean;
}

// --- Operators (Staff) ---
export interface Operator {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  color: string;
  specializations: TreatmentCategory[];
  locationIds: string[];
  schedule: OperatorWeekSchedule;
  isActive: boolean;
  phone?: string;
  email?: string;
  commission: number; // percentage
  hireDate: string;
}

export interface OperatorWeekSchedule {
  [key: number]: OperatorDaySchedule | undefined; // 0-6
}

export interface OperatorDaySchedule {
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
}

// --- Rooms & Equipment ---
export interface Room {
  id: string;
  name: string;
  locationId: string;
  type: 'cabin' | 'room' | 'area';
  color: string;
  isActive: boolean;
  equipment?: string[];
}

export interface Equipment {
  id: string;
  name: string;
  locationId: string;
  type: string;
  isActive: boolean;
}

// --- Appointments ---
export type AppointmentStatus = 'confirmed' | 'pending' | 'in_progress' | 'completed' | 'no_show' | 'cancelled' | 'waitlist';

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  operatorId: string;
  operatorName: string;
  treatmentId: string;
  treatmentName: string;
  treatmentCategory: TreatmentCategory;
  roomId?: string;
  locationId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  duration: number; // minutes
  status: AppointmentStatus;
  price: number;
  notes?: string;
  isLocked: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// --- Packages & Subscriptions ---
export type PackageType = 'sessions' | 'time' | 'membership' | 'open';

export interface Package {
  id: string;
  name: string;
  type: PackageType;
  treatments: { treatmentId: string; quantity: number }[];
  totalSessions?: number;
  usedSessions?: number;
  price: number;
  validFrom: string;
  validUntil?: string;
  isActive: boolean;
}

export interface ClientPackage {
  id: string;
  clientId: string;
  packageId: string;
  packageName: string;
  remainingSessions: number;
  totalSessions: number;
  validUntil: string;
  purchaseDate: string;
  price: number;
}

// --- Transactions ---
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'satispay' | 'klarna' | 'mixed' | 'gift_card' | 'package';

export interface Transaction {
  id: string;
  clientId: string;
  clientName: string;
  locationId: string;
  date: string;
  items: TransactionItem[];
  total: number;
  discount: number;
  paymentMethod: PaymentMethod;
  operatorId: string;
  notes?: string;
  receiptNumber?: string;
}

export interface TransactionItem {
  type: 'service' | 'product' | 'package' | 'gift_card';
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

// --- Products & Inventory ---
export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  sku: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  locationId: string;
  isActive: boolean;
}

// --- Notifications ---
export interface AppNotification {
  id: string;
  type: 'appointment' | 'client' | 'payment' | 'stock' | 'system' | 'marketing';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

// --- Dashboard KPIs ---
export interface DashboardKPI {
  revenueToday: number;
  revenueTrend: number; // percentage vs yesterday
  appointmentsToday: number;
  appointmentsTrend: number;
  newClientsToday: number;
  newClientsTrend: number;
  occupancyRate: number; // percentage
  occupancyTrend: number;
  noShowRate: number;
  avgTicket: number;
}

// --- Chart Data ---
export interface RevenueDataPoint {
  date: string;
  label: string;
  revenue: number;
  services: number;
  products: number;
}

// --- Activity Log ---
export interface Activity {
  id: string;
  type: 'appointment_created' | 'appointment_completed' | 'client_added' | 'payment_received' | 'no_show' | 'appointment_cancelled';
  title: string;
  description: string;
  timestamp: string;
  userId: string;
  icon: string;
  color: string;
}
