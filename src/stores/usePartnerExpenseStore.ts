import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PartnerExpense {
  id: string;
  partner: 'Dino' | 'Francesco';
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
}

interface PartnerExpenseState {
  expenses: PartnerExpense[];
  addExpense: (expense: Omit<PartnerExpense, 'id'>) => void;
  deleteExpense: (id: string) => void;
  clearExpenses: () => void; // Useful for the "Salda e Azzera" functionality
}

export const usePartnerExpenseStore = create<PartnerExpenseState>()(
  persist(
    (set) => ({
      expenses: [
        // Mock data for initial testing
        { id: '1', partner: 'Dino', amount: 150, description: 'Prodotti pulizia', date: new Date().toISOString().split('T')[0] },
        { id: '2', partner: 'Francesco', amount: 45, description: 'Caffè e acqua per clienti', date: new Date().toISOString().split('T')[0] },
      ],
      addExpense: (expense) =>
        set((state) => ({
          expenses: [
            { ...expense, id: Date.now().toString() },
            ...state.expenses,
          ],
        })),
      deleteExpense: (id) =>
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        })),
      clearExpenses: () => set({ expenses: [] }),
    }),
    {
      name: 'revo_partner_expenses',
    }
  )
);
