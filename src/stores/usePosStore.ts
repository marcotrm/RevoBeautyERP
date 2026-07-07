import { create } from 'zustand';
import { getTodayTransactions, createTransaction, TransactionRecord } from '@/app/actions/pos';

export type { TransactionRecord };

interface PosStore {
  transactions: TransactionRecord[];
  isLoading: boolean;
  fetchTransactions: () => Promise<void>;
  addTransaction: (tx: Omit<TransactionRecord, 'id'>) => Promise<TransactionRecord>;
}

export const usePosStore = create<PosStore>()((set) => ({
  transactions: [],
  isLoading: false,

  fetchTransactions: async () => {
    set({ isLoading: true });
    try {
      const data = await getTodayTransactions();
      set({ transactions: data, isLoading: false });
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  addTransaction: async (tx) => {
    try {
      const created = await createTransaction(tx);
      set((state) => ({ transactions: [created, ...state.transactions] }));
      return created;
    } catch (error) {
      console.error('Failed to add transaction', error);
      throw error;
    }
  },
}));
