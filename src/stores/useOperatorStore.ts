import { create } from 'zustand';
import { Operator } from '@/types';
import { getOperators, createOperator, updateOperator as updateOperatorAction, deleteOperator as deleteOperatorAction } from '@/app/actions/operators';

interface OperatorStore {
  operators: Operator[];
  isLoading: boolean;
  fetchOperators: () => Promise<void>;
  addOperator: (operator: Operator) => Promise<void>;
  updateOperator: (id: string, updates: Partial<Operator>) => Promise<void>;
  deleteOperator: (id: string) => Promise<void>;
}

export const useOperatorStore = create<OperatorStore>()((set) => ({
  operators: [],
  isLoading: false,

  fetchOperators: async () => {
    set({ isLoading: true });
    try {
      const data = await getOperators();
      set({ operators: data, isLoading: false });
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  addOperator: async (operator) => {
    try {
      const newOp = await createOperator(operator);
      set((state) => ({ operators: [...state.operators, newOp] }));
    } catch (error) {
      console.error('Failed to add operator', error);
      throw error;
    }
  },

  updateOperator: async (id, updates) => {
    try {
      const updated = await updateOperatorAction(id, updates);
      set((state) => ({
        operators: state.operators.map((op) => (op.id === id ? updated : op)),
      }));
    } catch (error) {
      console.error('Failed to update operator', error);
      throw error;
    }
  },

  deleteOperator: async (id) => {
    try {
      await deleteOperatorAction(id);
      set((state) => ({
        operators: state.operators.filter((op) => op.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete operator', error);
      throw error;
    }
  },
}));
