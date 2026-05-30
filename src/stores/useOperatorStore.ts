import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Operator } from '@/types';
import { mockOperators } from '@/lib/mock-data';

interface OperatorStore {
  operators: Operator[];
  addOperator: (operator: Operator) => void;
  updateOperator: (id: string, updates: Partial<Operator>) => void;
  deleteOperator: (id: string) => void;
}

export const useOperatorStore = create<OperatorStore>()(
  persist(
    (set) => ({
      operators: mockOperators,
      addOperator: (operator) => set((state) => ({ operators: [...state.operators, operator] })),
      updateOperator: (id, updates) => set((state) => ({
        operators: state.operators.map(op => op.id === id ? { ...op, ...updates } : op)
      })),
      deleteOperator: (id) => set((state) => ({
        operators: state.operators.filter(op => op.id !== id)
      }))
    }),
    { name: 'revo_operators' }
  )
);
