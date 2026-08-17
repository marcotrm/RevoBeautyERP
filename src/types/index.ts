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
  /** id of a RoleConfig from useRolesStore (e.g. 'owner', 'manager', or a custom role id) */
  role: string;
  avatar?: string;
  phone?: string;
  locationIds: string[];
  isActive: boolean;
  createdAt: string;
}

// --- Price Lists ---
export interface PriceList {
  id: string;
  name: string;
  discountPercentage: number;
  isActive: boolean;
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
  customTreatments?: CustomTreatment[];
  tags: string[];
  vipLevel: 0 | 1 | 2 | 3;
  loyaltyPoints: number;
  cashback: number;
  priceListId?: string | null;
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
// 'prodotto' non è un vero trattamento: è la crema/cosmetico aggiunto al
// carrello della seduta dall'agenda (durata 0, si incassa al check-out).
export type TreatmentCategory = 'facial' | 'body' | 'laser' | 'massage' | 'nails' | 'waxing' | 'consultation' | 'hair' | 'makeup' | 'prodotto';

export interface CustomTreatment {
  treatmentId: string;
  treatmentName: string;
  duration: number; // custom duration in minutes
  price: number; // custom price
  notes?: string;
}

export interface Treatment {
  id: string;
  name: string;
  category: TreatmentCategory;
  duration: number; // minutes (default = valore donna)
  price: number; // default = prezzo donna
  priceMale?: number;
  priceFemale?: number;
  durationMale?: number; // minutes
  durationFemale?: number; // minutes
  description?: string;
  requiresRoom: boolean;
  requiresEquipment?: string;
  bufferBefore: number; // minutes
  bufferAfter: number; // minutes
  color: string;
  isActive: boolean;
  /**
   * Chi sa fare questo trattamento e quanto ci mette.
   *
   * Vuoto o assente = lo fanno tutte, con la durata standard. Appena si
   * mette anche una sola riga, il trattamento diventa "di quelle lì": in
   * prenotazione le altre non compaiono.
   */
  operatorSkills?: OperatorSkill[];
}

/** Una riga di "chi lo fa": l'operatrice, e i suoi tempi su quel trattamento. */
export interface OperatorSkill {
  operatorId: string;
  /** Minuti che impiega lei. Vuoto = la durata standard del trattamento. */
  duration?: number;
  /** Prezzo suo, se diverso. Quasi sempre vuoto. */
  price?: number;
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
  contractHours?: number; // ore settimanali da contratto
  isActive: boolean;
  phone?: string;
  email?: string;
  commission: number; // percentage
  hireDate: string;
  isResource?: boolean; // true = cabina/macchinario prenotabile senza operatrice
  monthlyCost?: number; // costo mensile lordo azienda (per il costo orario)
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
export type AppointmentStatus = 'confirmed' | 'pending' | 'in_progress' | 'in_cabin' | 'completed' | 'no_show' | 'cancelled' | 'waitlist';

export interface TodoItem {
  id: string;
  title: string;
  done: boolean;
  priority: 'low' | 'normal' | 'high';
  dueDate?: string;
  assignee?: string;
  createdAt: string;
  completedAt?: string;
  /** 'todo' = cose da fare, 'shopping' = cose da comprare per il centro */
  list?: 'todo' | 'shopping';
}

export interface AgendaBlock {
  id: string;
  operatorId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  reason?: string;
  createdAt: string;
}

export interface AppointmentService {
  treatmentId: string;
  treatmentName: string;
  treatmentCategory: TreatmentCategory;
  duration: number; // minuti
  price: number;
  gender?: 'male' | 'female';
  checkInAt?: string;  // ISO — inizio di QUESTO trattamento in cabina
  checkOutAt?: string; // ISO — fine di QUESTO trattamento
  /**
   * Chi esegue questo trattamento, se diverso dall'operatrice dell'appuntamento
   * (es. l'acrygel lo fa Michela e la pedicure Veronica). Vuoto = la principale.
   */
  operatorId?: string;
  operatorName?: string;
  /**
   * Upsell: trattamento aggiunto quando la cliente era GIÀ in cabina — cioè
   * venduto dall'estetista durante la seduta, non prenotato. È la base della
   * classifica upsell in Statistiche.
   */
  upsell?: boolean;
  upsellAt?: string; // ISO
  /**
   * Prodotto del magazzino aggiunto al carrello della seduta (crema, kit...):
   * al check-out va in cassa insieme ai trattamenti e scala la giacenza.
   */
  productId?: string;
}

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
  services?: AppointmentService[]; // dettaglio dei trattamenti quando ce n'è più d'uno
  notes?: string;
  cancelReason?: string; // motivo dell'annullamento (per storico/classificazione cliente)
  cancelledAt?: string; // quando è stato annullato
  checkInAt?: string; // ISO — inizio trattamento in cabina (check-in)
  checkOutAt?: string; // ISO — fine trattamento in cabina (check-out)
  cabinNumber?: string; // cabina scelta al check-in: è quella che l'annuncio vocale chiama
  isLocked: boolean;
  /** Sconto concordato: quanto tolto dal totale di listino, e perché. */
  discountAmount?: number;
  discountReason?: string;
  /** Chi ha applicato il prezzo diverso dal listino. */
  discountBy?: string;
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
  barcode?: string;
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
