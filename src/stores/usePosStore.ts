import { create } from 'zustand';
import { getTodayTransactions, createTransaction, deleteTransaction, TransactionRecord } from '@/app/actions/pos';

export type { TransactionRecord };

interface PosStore {
  transactions: TransactionRecord[];
  isLoading: boolean;
  fetchTransactions: () => Promise<void>;
  addTransaction: (tx: Omit<TransactionRecord, 'id'>, originalTxId?: string) => Promise<TransactionRecord>;
  removeTransaction: (id: string) => Promise<void>;
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

  addTransaction: async (tx, originalTxId) => {
    try {
      const created = await createTransaction(tx, originalTxId);
      set((state) => ({ transactions: [created, ...state.transactions] }));
      return created;
    } catch (error) {
      console.error('Failed to add transaction', error);
      throw error;
    }
  },

  removeTransaction: async (id) => {
    try {
      await deleteTransaction(id);
      set((state) => ({ transactions: state.transactions.filter(t => t.id !== id) }));
    } catch (error) {
      console.error('Failed to delete transaction', error);
      throw error;
    }
  },
}));
