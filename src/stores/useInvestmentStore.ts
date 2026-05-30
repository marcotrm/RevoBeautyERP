import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Investment, mockInvestments } from '@/lib/admin-data';

interface InvestmentStore {
  investments: Investment[];
  addInvestment: (investment: Investment) => void;
  updateInvestment: (id: string, updates: Partial<Investment>) => void;
  deleteInvestment: (id: string) => void;
}

export const useInvestmentStore = create<InvestmentStore>()(
  persist(
    (set) => ({
      investments: mockInvestments,
      addInvestment: (investment) => set((state) => ({ investments: [...state.investments, investment] })),
      updateInvestment: (id, updates) => set((state) => ({
        investments: state.investments.map(inv => inv.id === id ? { ...inv, ...updates } : inv)
      })),
      deleteInvestment: (id) => set((state) => ({
        investments: state.investments.filter(inv => inv.id !== id)
      }))
    }),
    {
      name: 'revo_investments'
    }
  )
);
