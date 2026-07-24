'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GestionaleAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
  active: boolean;
  createdAt: string;
}

const SEED_ACCOUNTS: GestionaleAccount[] = [
  { id: 'acc-dino', firstName: 'Dino', lastName: 'Caruso', email: 'dino@revobeauty.it', password: 'password123', roleId: 'owner', active: true, createdAt: '2024-01-01' },
  { id: 'acc-francesco', firstName: 'Francesco', lastName: '', email: 'francesco@revobeauty.it', password: 'password123', roleId: 'owner', active: true, createdAt: '2024-01-01' },
  { id: 'acc-staff', firstName: 'Staff', lastName: 'Member', email: 'staff@revobeauty.it', password: 'password123', roleId: 'estetista', active: true, createdAt: '2024-01-01' },
];

interface AccountsStore {
  accounts: GestionaleAccount[];
  addAccount: (data: Omit<GestionaleAccount, 'id' | 'createdAt'>) => void;
  updateAccount: (id: string, data: Partial<Omit<GestionaleAccount, 'id' | 'createdAt'>>) => void;
  deleteAccount: (id: string) => void;
  toggleActive: (id: string) => void;
}

export const useAccountsStore = create<AccountsStore>()(
  persist(
    (set) => ({
      accounts: SEED_ACCOUNTS,

      addAccount: (data) => set(state => ({
        accounts: [...state.accounts, {
          ...data,
          id: `acc-${Date.now()}`,
          createdAt: new Date().toISOString().slice(0, 10),
        }],
      })),

      updateAccount: (id, data) => set(state => ({
        accounts: state.accounts.map(a => a.id === id ? { ...a, ...data } : a),
      })),

      deleteAccount: (id) => set(state => ({
        accounts: state.accounts.filter(a => a.id !== id),
      })),

      toggleActive: (id) => set(state => ({
        accounts: state.accounts.map(a => a.id === id ? { ...a, active: !a.active } : a),
      })),
    }),
    {
      name: 'revo_gestionale_accounts',
    }
  )
);
