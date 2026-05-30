import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CashFlowEntry, mockCashFlow } from '@/lib/admin-data';

interface CashFlowStore {
  cashFlowEntries: CashFlowEntry[];
  addCashFlowEntry: (entry: CashFlowEntry) => void;
  updateCashFlowEntry: (id: string, updates: Partial<CashFlowEntry>) => void;
  deleteCashFlowEntry: (id: string) => void;
}

export const useCashFlowStore = create<CashFlowStore>()(
  persist(
    (set) => ({
      cashFlowEntries: mockCashFlow,
      addCashFlowEntry: (entry) => set((state) => ({ cashFlowEntries: [...state.cashFlowEntries, entry] })),
      updateCashFlowEntry: (id, updates) => set((state) => ({
        cashFlowEntries: state.cashFlowEntries.map(e => e.id === id ? { ...e, ...updates } : e)
      })),
      deleteCashFlowEntry: (id) => set((state) => ({
        cashFlowEntries: state.cashFlowEntries.filter(e => e.id !== id)
      }))
    }),
    { name: 'revo_cash_flow' }
  )
);
