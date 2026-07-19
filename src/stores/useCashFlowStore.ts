import { create } from 'zustand';
import { CashFlowEntry } from '@/lib/admin-data';
import { getAdminEntries, createAdminEntry, updateAdminEntry, deleteAdminEntry, migrateAdminEntries } from '@/app/actions/admin';

const KIND = 'cash_flow';

interface CashFlowStore {
  cashFlowEntries: CashFlowEntry[];
  fetchCashFlow: () => Promise<void>;
  addCashFlowEntry: (entry: CashFlowEntry) => Promise<void>;
  updateCashFlowEntry: (id: string, updates: Partial<CashFlowEntry>) => Promise<void>;
  deleteCashFlowEntry: (id: string) => Promise<void>;
}

async function migrateLocal() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('revo_cash_flow');
    if (!raw) return;
    const list = JSON.parse(raw)?.state?.cashFlowEntries;
    if (Array.isArray(list) && list.length) await migrateAdminEntries(KIND, list);
    window.localStorage.removeItem('revo_cash_flow');
  } catch { /* ignora */ }
}

export const useCashFlowStore = create<CashFlowStore>((set) => ({
  cashFlowEntries: [],
  fetchCashFlow: async () => {
    try { await migrateLocal(); const data = await getAdminEntries(KIND); set({ cashFlowEntries: data as unknown as CashFlowEntry[] }); }
    catch (e) { console.error(e); }
  },
  addCashFlowEntry: async (entry) => {
    await createAdminEntry(KIND, entry as unknown as Record<string, unknown>);
    set((s) => ({ cashFlowEntries: [...s.cashFlowEntries, entry] }));
  },
  updateCashFlowEntry: async (id, updates) => {
    await updateAdminEntry(KIND, id, updates as Record<string, unknown>);
    set((s) => ({ cashFlowEntries: s.cashFlowEntries.map(e => e.id === id ? { ...e, ...updates } : e) }));
  },
  deleteCashFlowEntry: async (id) => {
    await deleteAdminEntry(KIND, id);
    set((s) => ({ cashFlowEntries: s.cashFlowEntries.filter(e => e.id !== id) }));
  },
}));
