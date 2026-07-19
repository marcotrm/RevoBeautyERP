import { create } from 'zustand';
import { VariableCost } from '@/lib/admin-data';
import { getAdminEntries, createAdminEntry, updateAdminEntry, deleteAdminEntry, migrateAdminEntries } from '@/app/actions/admin';

const KIND = 'variable_cost';

interface VariableCostStore {
  variableCosts: VariableCost[];
  fetchVariableCosts: () => Promise<void>;
  addVariableCost: (cost: VariableCost) => Promise<void>;
  updateVariableCost: (id: string, updates: Partial<VariableCost>) => Promise<void>;
  deleteVariableCost: (id: string) => Promise<void>;
}

async function migrateLocal() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('revo_variable_costs');
    if (!raw) return;
    const list = JSON.parse(raw)?.state?.variableCosts;
    if (Array.isArray(list) && list.length) await migrateAdminEntries(KIND, list);
    window.localStorage.removeItem('revo_variable_costs');
  } catch { /* ignora */ }
}

export const useVariableCostStore = create<VariableCostStore>((set) => ({
  variableCosts: [],
  fetchVariableCosts: async () => {
    try { await migrateLocal(); const data = await getAdminEntries(KIND); set({ variableCosts: data as unknown as VariableCost[] }); }
    catch (e) { console.error(e); }
  },
  addVariableCost: async (cost) => {
    await createAdminEntry(KIND, cost as unknown as Record<string, unknown>);
    set((s) => ({ variableCosts: [...s.variableCosts, cost] }));
  },
  updateVariableCost: async (id, updates) => {
    await updateAdminEntry(KIND, id, updates as Record<string, unknown>);
    set((s) => ({ variableCosts: s.variableCosts.map(c => c.id === id ? { ...c, ...updates } : c) }));
  },
  deleteVariableCost: async (id) => {
    await deleteAdminEntry(KIND, id);
    set((s) => ({ variableCosts: s.variableCosts.filter(c => c.id !== id) }));
  },
}));
