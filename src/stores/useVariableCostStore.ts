import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VariableCost, mockVariableCosts } from '@/lib/admin-data';

interface VariableCostStore {
  variableCosts: VariableCost[];
  addVariableCost: (cost: VariableCost) => void;
  updateVariableCost: (id: string, updates: Partial<VariableCost>) => void;
  deleteVariableCost: (id: string) => void;
}

export const useVariableCostStore = create<VariableCostStore>()(
  persist(
    (set) => ({
      variableCosts: mockVariableCosts,
      addVariableCost: (cost) => set((state) => ({ variableCosts: [...state.variableCosts, cost] })),
      updateVariableCost: (id, updates) => set((state) => ({
        variableCosts: state.variableCosts.map(c => c.id === id ? { ...c, ...updates } : c)
      })),
      deleteVariableCost: (id) => set((state) => ({
        variableCosts: state.variableCosts.filter(c => c.id !== id)
      }))
    }),
    { name: 'revo_variable_costs' }
  )
);
