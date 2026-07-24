'use client';

import { create } from 'zustand';
import {
  GestionaleAccount,
  getAccounts,
  createAccount as createAccountAction,
  updateAccount as updateAccountAction,
  deleteAccount as deleteAccountAction,
  toggleAccountActive,
} from '@/app/actions/accounts';

export type { GestionaleAccount };

interface AccountsStore {
  accounts: GestionaleAccount[];
  loaded: boolean;
  isLoading: boolean;
  fetchAccounts: () => Promise<void>;
  addAccount: (data: Omit<GestionaleAccount, 'id' | 'createdAt'>) => Promise<void>;
  updateAccount: (id: string, data: Partial<Omit<GestionaleAccount, 'id' | 'createdAt'>>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
}

export const useAccountsStore = create<AccountsStore>()((set) => ({
  accounts: [],
  loaded: false,
  isLoading: false,

  fetchAccounts: async () => {
    set({ isLoading: true });
    try {
      const data = await getAccounts();
      set({ accounts: data, loaded: true, isLoading: false });
    } catch (e) {
      console.error('Failed to fetch accounts', e);
      set({ isLoading: false });
    }
  },

  addAccount: async (data) => {
    const account = await createAccountAction(data);
    set((s) => ({ accounts: [...s.accounts, account] }));
  },

  updateAccount: async (id, data) => {
    const account = await updateAccountAction(id, data);
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? account : a)) }));
  },

  deleteAccount: async (id) => {
    await deleteAccountAction(id);
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
  },

  toggleActive: async (id) => {
    const account = await toggleAccountActive(id);
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? account : a)) }));
  },
}));
