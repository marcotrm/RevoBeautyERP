import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FixedCost, mockFixedCosts } from '@/lib/admin-data';

interface FixedCostStore {
  fixedCosts: FixedCost[];
  addFixedCost: (cost: FixedCost) => void;
  updateFixedCost: (id: string, updates: Partial<FixedCost>) => void;
  deleteFixedCost: (id: string) => void;
}

export const useFixedCostStore = create<FixedCostStore>()(
  persist(
    (set) => ({
      fixedCosts: mockFixedCosts,
      addFixedCost: (cost) => set((state) => ({ fixedCosts: [...state.fixedCosts, cost] })),
      updateFixedCost: (id, updates) => set((state) => ({
        fixedCosts: state.fixedCosts.map(c => c.id === id ? { ...c, ...updates } : c)
      })),
      deleteFixedCost: (id) => set((state) => ({
        fixedCosts: state.fixedCosts.filter(c => c.id !== id)
      }))
    }),
    { name: 'revo_fixed_costs' }
  )
);
