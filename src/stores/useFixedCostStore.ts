import { create } from 'zustand';
import { FixedCost } from '@/lib/admin-data';
import { getAdminEntries, createAdminEntry, updateAdminEntry, deleteAdminEntry, migrateAdminEntries } from '@/app/actions/admin';

const KIND = 'fixed_cost';

interface FixedCostStore {
  fixedCosts: FixedCost[];
  fetchFixedCosts: () => Promise<void>;
  addFixedCost: (cost: FixedCost) => Promise<void>;
  updateFixedCost: (id: string, updates: Partial<FixedCost>) => Promise<void>;
  deleteFixedCost: (id: string) => Promise<void>;
}

async function migrateLocal() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('revo_fixed_costs');
    if (!raw) return;
    const list = JSON.parse(raw)?.state?.fixedCosts;
    if (Array.isArray(list) && list.length) await migrateAdminEntries(KIND, list);
    window.localStorage.removeItem('revo_fixed_costs');
  } catch { /* ignora */ }
}

export const useFixedCostStore = create<FixedCostStore>((set) => ({
  fixedCosts: [],
  fetchFixedCosts: async () => {
    try { await migrateLocal(); const data = await getAdminEntries(KIND); set({ fixedCosts: data as unknown as FixedCost[] }); }
    catch (e) { console.error(e); }
  },
  addFixedCost: async (cost) => {
    await createAdminEntry(KIND, cost as unknown as Record<string, unknown>);
    set((s) => ({ fixedCosts: [...s.fixedCosts, cost] }));
  },
  updateFixedCost: async (id, updates) => {
    await updateAdminEntry(KIND, id, updates as Record<string, unknown>);
    set((s) => ({ fixedCosts: s.fixedCosts.map(c => c.id === id ? { ...c, ...updates } : c) }));
  },
  deleteFixedCost: async (id) => {
    await deleteAdminEntry(KIND, id);
    set((s) => ({ fixedCosts: s.fixedCosts.filter(c => c.id !== id) }));
  },
}));
