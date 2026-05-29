'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PackageItem {
  id: string; name: string; type: string; price: number; totalSessions: number;
  sold: number; color: string; description?: string; treatmentName?: string;
}

export interface PackagePayment {
  id: string;
  date: string;
  amount: number;
  method: 'Carta' | 'Contanti' | 'Satispay' | 'Bonifico';
  operator: string;
  note?: string;
}

export interface ClientPackage {
  id: string;
  clientName: string;
  packageName: string;
  packageColor: string;
  totalSessions: number;
  usedSessions: number;
  pricePaid: number; // prezzo totale del pacchetto
  totalPaid: number; // quanto ha pagato finora
  remainingBalance: number; // quanto deve ancora
  paymentPlan: 'full' | 'installments';
  payments: PackagePayment[];
  purchaseDate: string;
  expiryDate: string;
  status: 'active' | 'completed' | 'expired' | 'expiring';
  history: { date: string; operator: string; note?: string }[];
}

const defaultPackages: PackageItem[] = [
  { id: 'pkg-1', name: 'Pacchetto Anti-Age 10 Sedute', type: 'Sessioni', price: 850, totalSessions: 10, sold: 24, color: '#8B5CF6', treatmentName: 'Trattamento Anti-Age Premium' },
  { id: 'pkg-2', name: 'Pacchetto Laser 8 Sedute', type: 'Sessioni', price: 720, totalSessions: 8, sold: 18, color: '#F59E0B', treatmentName: 'Epilazione Laser' },
  { id: 'pkg-3', name: 'Combo Viso + Corpo 5+5', type: 'Bundle', price: 520, totalSessions: 10, sold: 12, color: '#22C55E', treatmentName: 'Combo Viso + Corpo' },
  { id: 'pkg-4', name: 'Pacchetto Massaggi Relax', type: 'Sessioni', price: 350, totalSessions: 6, sold: 31, color: '#3B82F6', treatmentName: 'Massaggio Rilassante' },
  { id: 'pkg-5', name: 'Pacchetto Peeling 5 Sedute', type: 'Sessioni', price: 300, totalSessions: 5, sold: 8, color: '#EC4899', treatmentName: 'Peeling Chimico' },
];

const defaultClientPkgs: ClientPackage[] = [
  { id: 'cp-1', clientName: 'Maria Colombo', packageName: 'Pacchetto Anti-Age 10 Sedute', packageColor: '#8B5CF6', totalSessions: 10, usedSessions: 6, pricePaid: 850, totalPaid: 850, remainingBalance: 0, paymentPlan: 'full', payments: [{ id: 'pay-1', date: '2026-03-10', amount: 850, method: 'Carta', operator: 'Sara Rossi' }], purchaseDate: '2026-03-10', expiryDate: '2027-03-10', status: 'active', history: [
    { date: '2026-03-15', operator: 'Sara Rossi' }, { date: '2026-03-29', operator: 'Sara Rossi' },
    { date: '2026-04-12', operator: 'Valentina Bianchi' }, { date: '2026-04-26', operator: 'Sara Rossi' },
    { date: '2026-05-10', operator: 'Chiara Moretti' }, { date: '2026-05-24', operator: 'Sara Rossi' },
  ]},
  { id: 'cp-2', clientName: 'Laura Ferrari', packageName: 'Pacchetto Laser 8 Sedute', packageColor: '#F59E0B', totalSessions: 8, usedSessions: 3, pricePaid: 720, totalPaid: 400, remainingBalance: 320, paymentPlan: 'installments', payments: [{ id: 'pay-2', date: '2026-04-01', amount: 400, method: 'Carta', operator: 'Sara Rossi' }], purchaseDate: '2026-04-01', expiryDate: '2027-04-01', status: 'active', history: [
    { date: '2026-04-10', operator: 'Valentina Bianchi' }, { date: '2026-04-24', operator: 'Valentina Bianchi' },
    { date: '2026-05-15', operator: 'Valentina Bianchi' },
  ]},
  { id: 'cp-3', clientName: 'Anna Fontana', packageName: 'Pacchetto Massaggi Relax', packageColor: '#3B82F6', totalSessions: 6, usedSessions: 5, pricePaid: 350, totalPaid: 350, remainingBalance: 0, paymentPlan: 'full', payments: [{ id: 'pay-3', date: '2026-02-15', amount: 350, method: 'Contanti', operator: 'Chiara Moretti' }], purchaseDate: '2026-02-15', expiryDate: '2027-02-15', status: 'expiring', history: [
    { date: '2026-02-28', operator: 'Chiara Moretti' }, { date: '2026-03-14', operator: 'Chiara Moretti' },
    { date: '2026-03-28', operator: 'Chiara Moretti' }, { date: '2026-04-18', operator: 'Chiara Moretti' },
    { date: '2026-05-09', operator: 'Sara Rossi' },
  ]},
  { id: 'cp-4', clientName: 'Paola Mancini', packageName: 'Combo Viso + Corpo 5+5', packageColor: '#22C55E', totalSessions: 10, usedSessions: 3, pricePaid: 520, totalPaid: 200, remainingBalance: 320, paymentPlan: 'installments', payments: [{ id: 'pay-4', date: '2026-05-01', amount: 200, method: 'Satispay', operator: 'Francesca Romano' }], purchaseDate: '2026-05-01', expiryDate: '2027-05-01', status: 'active', history: [
    { date: '2026-05-05', operator: 'Francesca Romano' }, { date: '2026-05-12', operator: 'Francesca Romano' },
    { date: '2026-05-20', operator: 'Sara Rossi' },
  ]},
  { id: 'cp-5', clientName: 'Claudia Greco', packageName: 'Pacchetto Anti-Age 10 Sedute', packageColor: '#8B5CF6', totalSessions: 10, usedSessions: 10, pricePaid: 850, totalPaid: 850, remainingBalance: 0, paymentPlan: 'full', payments: [{ id: 'pay-5', date: '2025-12-01', amount: 850, method: 'Carta', operator: 'Sara Rossi' }], purchaseDate: '2025-12-01', expiryDate: '2026-12-01', status: 'completed', history: Array.from({ length: 10 }, (_, i) => ({
    date: `2026-0${Math.floor(i/3)+1}-${String((i%3+1)*8).padStart(2,'0')}`, operator: 'Sara Rossi',
  }))},
];

interface PackageStore {
  packages: PackageItem[];
  clientPackages: ClientPackage[];

  addPackage: (pkg: PackageItem) => void;
  deletePackage: (id: string) => void;

  activatePackage: (pkg: PackageItem, clientName: string, validityMonths: number, firstPayment: number, paymentMethod: PackagePayment['method'], operator: string, paymentPlan: 'full' | 'installments') => void;
  addPayment: (cpId: string, amount: number, method: PackagePayment['method'], operator: string, note?: string) => void;
  useSession: (cpId: string, operator: string, note: string) => void;
  deleteClientPackage: (cpId: string) => void;

  getClientPackages: (clientName: string) => ClientPackage[];
  getTotalDebt: () => number;
  getClientsWithDebt: () => ClientPackage[];
}

export const usePackageStore = create<PackageStore>()(
  persist(
    (set, get) => ({
      packages: defaultPackages,
      clientPackages: defaultClientPkgs,

      addPackage: (pkg) => set((s) => ({ packages: [pkg, ...s.packages] })),
      deletePackage: (id) => set((s) => ({ packages: s.packages.filter(p => p.id !== id) })),

      activatePackage: (pkg, clientName, validityMonths, firstPayment, paymentMethod, operator, paymentPlan) => {
        const now = new Date();
        const exp = new Date(now); exp.setMonth(exp.getMonth() + validityMonths);
        const today = now.toISOString().split('T')[0];
        const newCp: ClientPackage = {
          id: `cp-${Date.now()}`, clientName, packageName: pkg.name, packageColor: pkg.color,
          totalSessions: pkg.totalSessions, usedSessions: 0, pricePaid: pkg.price,
          totalPaid: firstPayment,
          remainingBalance: pkg.price - firstPayment,
          paymentPlan,
          payments: [{
            id: `pay-${Date.now()}`,
            date: today,
            amount: firstPayment,
            method: paymentMethod,
            operator,
          }],
          purchaseDate: today, expiryDate: exp.toISOString().split('T')[0],
          status: 'active', history: [],
        };
        set((s) => ({
          clientPackages: [newCp, ...s.clientPackages],
          packages: s.packages.map(p => p.id === pkg.id ? { ...p, sold: p.sold + 1 } : p),
        }));
      },

      addPayment: (cpId, amount, method, operator, note) => {
        const today = new Date().toISOString().split('T')[0];
        set((s) => ({
          clientPackages: s.clientPackages.map(cp => {
            if (cp.id !== cpId) return cp;
            const newTotalPaid = cp.totalPaid + amount;
            const newRemaining = Math.max(0, cp.pricePaid - newTotalPaid);
            return {
              ...cp,
              totalPaid: newTotalPaid,
              remainingBalance: newRemaining,
              paymentPlan: newRemaining <= 0 ? 'full' : cp.paymentPlan,
              payments: [...cp.payments, {
                id: `pay-${Date.now()}`,
                date: today,
                amount,
                method,
                operator,
                note,
              }],
            };
          }),
        }));
      },

      useSession: (cpId, operator, note) => {
        const today = new Date().toISOString().split('T')[0];
        set((s) => ({
          clientPackages: s.clientPackages.map(cp => {
            if (cp.id !== cpId) return cp;
            const newUsed = cp.usedSessions + 1;
            return {
              ...cp, usedSessions: newUsed,
              status: newUsed >= cp.totalSessions ? 'completed' : cp.status,
              history: [...cp.history, { date: today, operator, note: note || undefined }],
            };
          }),
        }));
      },

      deleteClientPackage: (cpId) => set((s) => ({
        clientPackages: s.clientPackages.filter(cp => cp.id !== cpId),
      })),

      getClientPackages: (clientName) => {
        const normalize = (n: string) => n.toLowerCase().trim().split(/\s+/).sort().join(' ');
        const targetName = normalize(clientName);
        return get().clientPackages.filter(
          cp => (normalize(cp.clientName) === targetName ||
                 cp.clientName.toLowerCase().includes(clientName.toLowerCase()) ||
                 clientName.toLowerCase().includes(cp.clientName.toLowerCase())) &&
                (cp.status === 'active' || cp.status === 'expiring')
        );
      },

      getTotalDebt: () => get().clientPackages
        .filter(cp => cp.status === 'active' || cp.status === 'expiring')
        .reduce((s, cp) => s + (cp.remainingBalance || 0), 0),

      getClientsWithDebt: () => get().clientPackages
        .filter(cp => (cp.remainingBalance || 0) > 0 && (cp.status === 'active' || cp.status === 'expiring'))
        .sort((a, b) => (b.remainingBalance || 0) - (a.remainingBalance || 0)),
    }),
    {
      name: 'revo_packages_store',
      // Migrate old data without new fields
      merge: (persisted, current) => {
        const p = persisted as PackageStore;
        return {
          ...current,
          ...p,
          clientPackages: (p.clientPackages || current.clientPackages).map(cp => ({
            ...cp,
            totalPaid: cp.totalPaid ?? cp.pricePaid,
            remainingBalance: cp.remainingBalance ?? 0,
            paymentPlan: cp.paymentPlan ?? 'full',
            payments: cp.payments ?? [{ id: `pay-migr-${cp.id}`, date: cp.purchaseDate, amount: cp.pricePaid, method: 'Carta' as const, operator: 'Staff' }],
          })),
        };
      },
    }
  )
);
