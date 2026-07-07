'use client';

import { create } from 'zustand';
import {
  getPackages, getClientPackages, createPackage, deletePackage as deletePackageAction,
  activatePackage as activatePackageAction, addPayment as addPaymentAction,
  recordSessionUse, deleteClientPackage as deleteClientPackageAction,
} from '@/app/actions/packages';

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

interface PackageStore {
  packages: PackageItem[];
  clientPackages: ClientPackage[];
  isLoading: boolean;

  fetchPackages: () => Promise<void>;

  addPackage: (pkg: PackageItem) => Promise<void>;
  deletePackage: (id: string) => Promise<void>;

  activatePackage: (pkg: PackageItem, clientName: string, validityMonths: number, firstPayment: number, paymentMethod: PackagePayment['method'], operator: string, paymentPlan: 'full' | 'installments') => Promise<void>;
  addPayment: (cpId: string, amount: number, method: PackagePayment['method'], operator: string, note?: string) => Promise<void>;
  useSession: (cpId: string, operator: string, note: string) => Promise<void>;
  deleteClientPackage: (cpId: string) => Promise<void>;

  getClientPackages: (clientName: string) => ClientPackage[];
  getTotalDebt: () => number;
  getClientsWithDebt: () => ClientPackage[];
}

export const usePackageStore = create<PackageStore>()((set, get) => ({
  packages: [],
  clientPackages: [],
  isLoading: false,

  fetchPackages: async () => {
    set({ isLoading: true });
    try {
      const [packages, clientPackages] = await Promise.all([getPackages(), getClientPackages()]);
      set({ packages, clientPackages, isLoading: false });
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  addPackage: async (pkg) => {
    try {
      const created = await createPackage(pkg);
      set((s) => ({ packages: [created, ...s.packages] }));
    } catch (error) {
      console.error('Failed to add package', error);
      throw error;
    }
  },

  deletePackage: async (id) => {
    try {
      await deletePackageAction(id);
      set((s) => ({ packages: s.packages.filter(p => p.id !== id) }));
    } catch (error) {
      console.error('Failed to delete package', error);
      throw error;
    }
  },

  activatePackage: async (pkg, clientName, validityMonths, firstPayment, paymentMethod, operator, paymentPlan) => {
    try {
      const newCp = await activatePackageAction(pkg, clientName, validityMonths, firstPayment, paymentMethod, operator, paymentPlan);
      set((s) => ({
        clientPackages: [newCp, ...s.clientPackages],
        packages: s.packages.map(p => p.id === pkg.id ? { ...p, sold: p.sold + 1 } : p),
      }));
    } catch (error) {
      console.error('Failed to activate package', error);
      throw error;
    }
  },

  addPayment: async (cpId, amount, method, operator, note) => {
    try {
      const updated = await addPaymentAction(cpId, amount, method, operator, note);
      set((s) => ({
        clientPackages: s.clientPackages.map(cp => cp.id === cpId ? updated : cp),
      }));
    } catch (error) {
      console.error('Failed to add payment', error);
      throw error;
    }
  },

  useSession: async (cpId, operator, note) => {
    try {
      const updated = await recordSessionUse(cpId, operator, note);
      set((s) => ({
        clientPackages: s.clientPackages.map(cp => cp.id === cpId ? updated : cp),
      }));
    } catch (error) {
      console.error('Failed to use session', error);
      throw error;
    }
  },

  deleteClientPackage: async (cpId) => {
    try {
      await deleteClientPackageAction(cpId);
      set((s) => ({ clientPackages: s.clientPackages.filter(cp => cp.id !== cpId) }));
    } catch (error) {
      console.error('Failed to delete client package', error);
      throw error;
    }
  },

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
}));
