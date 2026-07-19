import { create } from 'zustand';
import { Investment } from '@/lib/admin-data';
import { getAdminEntries, createAdminEntry, updateAdminEntry, deleteAdminEntry, migrateAdminEntries } from '@/app/actions/admin';

const KIND = 'investment';

interface InvestmentStore {
  investments: Investment[];
  fetchInvestments: () => Promise<void>;
  addInvestment: (investment: Investment) => Promise<void>;
  updateInvestment: (id: string, updates: Partial<Investment>) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
}

async function migrateLocal() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('revo_investments');
    if (!raw) return;
    const list = JSON.parse(raw)?.state?.investments;
    if (Array.isArray(list) && list.length) await migrateAdminEntries(KIND, list);
    window.localStorage.removeItem('revo_investments');
  } catch { /* ignora */ }
}

export const useInvestmentStore = create<InvestmentStore>((set) => ({
  investments: [],
  fetchInvestments: async () => {
    try { await migrateLocal(); const data = await getAdminEntries(KIND); set({ investments: data as unknown as Investment[] }); }
    catch (e) { console.error(e); }
  },
  addInvestment: async (investment) => {
    await createAdminEntry(KIND, investment as unknown as Record<string, unknown>);
    set((s) => ({ investments: [...s.investments, investment] }));
  },
  updateInvestment: async (id, updates) => {
    await updateAdminEntry(KIND, id, updates as Record<string, unknown>);
    set((s) => ({ investments: s.investments.map(inv => inv.id === id ? { ...inv, ...updates } : inv) }));
  },
  deleteInvestment: async (id) => {
    await deleteAdminEntry(KIND, id);
    set((s) => ({ investments: s.investments.filter(inv => inv.id !== id) }));
  },
}));
