import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MonthlyFinancials, mockMonthlyFinancials } from '@/lib/admin-data';

interface FinancialStore {
  monthlyFinancials: MonthlyFinancials[];
  addMonthlyFinancial: (financial: MonthlyFinancials) => void;
  updateMonthlyFinancial: (month: string, updates: Partial<MonthlyFinancials>) => void;
  deleteMonthlyFinancial: (month: string) => void;
}

export const useFinancialStore = create<FinancialStore>()(
  persist(
    (set) => ({
      monthlyFinancials: mockMonthlyFinancials,
      addMonthlyFinancial: (financial) => set((state) => ({ monthlyFinancials: [...state.monthlyFinancials, financial] })),
      updateMonthlyFinancial: (month, updates) => set((state) => ({
        monthlyFinancials: state.monthlyFinancials.map(f => f.month === month ? { ...f, ...updates } : f)
      })),
      deleteMonthlyFinancial: (month) => set((state) => ({
        monthlyFinancials: state.monthlyFinancials.filter(f => f.month !== month)
      }))
    }),
    { name: 'revo_financials' }
  )
);
