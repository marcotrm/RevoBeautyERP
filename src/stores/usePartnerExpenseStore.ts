import { create } from 'zustand';
import {
  getPartnerExpenses, createPartnerExpense, deletePartnerExpense as deleteAction,
  clearPartnerExpenses, migratePartnerExpenses,
} from '@/app/actions/partner-expenses';

export interface PartnerExpense {
  id: string;
  partner: 'Dino' | 'Francesco';
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
}

interface PartnerExpenseState {
  expenses: PartnerExpense[];
  isLoading: boolean;
  fetchExpenses: () => Promise<void>;
  addExpense: (expense: Omit<PartnerExpense, 'id'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  clearExpenses: () => Promise<void>;
}

// Migrazione una-tantum: sposta le spese che erano nel browser (localStorage) sul DB condiviso.
async function migrateLocalIfNeeded() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('revo_partner_expenses');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const list = parsed?.state?.expenses;
    if (Array.isArray(list) && list.length > 0) {
      await migratePartnerExpenses(list.map((e: PartnerExpense) => ({
        partner: e.partner, amount: e.amount, description: e.description, date: e.date,
      })));
    }
    // Non rimigrare più da questo browser
    window.localStorage.removeItem('revo_partner_expenses');
  } catch {
    // ignora errori di migrazione
  }
}

export const usePartnerExpenseStore = create<PartnerExpenseState>((set) => ({
  expenses: [],
  isLoading: false,

  fetchExpenses: async () => {
    set({ isLoading: true });
    try {
      await migrateLocalIfNeeded();
      const data = await getPartnerExpenses();
      set({ expenses: data as PartnerExpense[], isLoading: false });
    } catch (e) {
      console.error('Failed to fetch partner expenses', e);
      set({ isLoading: false });
    }
  },

  addExpense: async (expense) => {
    try {
      const created = await createPartnerExpense(expense);
      set((state) => ({ expenses: [created as PartnerExpense, ...state.expenses] }));
    } catch (e) {
      console.error('Failed to add partner expense', e);
      throw e;
    }
  },

  deleteExpense: async (id) => {
    try {
      await deleteAction(id);
      set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
    } catch (e) {
      console.error('Failed to delete partner expense', e);
      throw e;
    }
  },

  clearExpenses: async () => {
    try {
      await clearPartnerExpenses();
      set({ expenses: [] });
    } catch (e) {
      console.error('Failed to clear partner expenses', e);
      throw e;
    }
  },
}));
