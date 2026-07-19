import { create } from 'zustand';
import { MonthlyFinancials } from '@/lib/admin-data';
import { getAdminEntries, createAdminEntry, updateAdminEntry, deleteAdminEntry, migrateAdminEntries } from '@/app/actions/admin';

const KIND = 'financial';
const ID = 'month';

interface FinancialStore {
  monthlyFinancials: MonthlyFinancials[];
  fetchFinancials: () => Promise<void>;
  addMonthlyFinancial: (financial: MonthlyFinancials) => Promise<void>;
  updateMonthlyFinancial: (month: string, updates: Partial<MonthlyFinancials>) => Promise<void>;
  deleteMonthlyFinancial: (month: string) => Promise<void>;
}

async function migrateLocal() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('revo_financials');
    if (!raw) return;
    const list = JSON.parse(raw)?.state?.monthlyFinancials;
    if (Array.isArray(list) && list.length) await migrateAdminEntries(KIND, list, ID);
    window.localStorage.removeItem('revo_financials');
  } catch { /* ignora */ }
}

export const useFinancialStore = create<FinancialStore>((set) => ({
  monthlyFinancials: [],
  fetchFinancials: async () => {
    try { await migrateLocal(); const data = await getAdminEntries(KIND); set({ monthlyFinancials: data as unknown as MonthlyFinancials[] }); }
    catch (e) { console.error(e); }
  },
  addMonthlyFinancial: async (financial) => {
    await createAdminEntry(KIND, financial as unknown as Record<string, unknown>, ID);
    set((s) => ({ monthlyFinancials: [...s.monthlyFinancials, financial] }));
  },
  updateMonthlyFinancial: async (month, updates) => {
    await updateAdminEntry(KIND, month, updates as Record<string, unknown>);
    set((s) => ({ monthlyFinancials: s.monthlyFinancials.map(f => f.month === month ? { ...f, ...updates } : f) }));
  },
  deleteMonthlyFinancial: async (month) => {
    await deleteAdminEntry(KIND, month);
    set((s) => ({ monthlyFinancials: s.monthlyFinancials.filter(f => f.month !== month) }));
  },
}));
