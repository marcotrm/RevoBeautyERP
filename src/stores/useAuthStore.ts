'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { mockCurrentUser } from '@/lib/mock-data';
import { useAccountsStore } from '@/stores/useAccountsStore';
import { useRolesStore } from '@/stores/useRolesStore';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  currentLocationId: string;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: Partial<User>, password: string) => Promise<boolean>;
  logout: () => void;
  setCurrentLocation: (locationId: string) => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      currentLocationId: 'loc1',

      login: async (email: string, password: string) => {
        // Accounts are managed in Impostazioni > Account Gestionale
        const account = useAccountsStore.getState().accounts.find(
          a => a.email.toLowerCase() === email.toLowerCase() && a.password === password && a.active
        );

        if (account) {
          set({
            user: { ...mockCurrentUser, id: account.id, email: account.email, firstName: account.firstName, lastName: account.lastName, role: account.roleId },
            isAuthenticated: true,
          });
          return true;
        }

        return false;
      },

      register: async (userData: Partial<User>, _password: string) => {
        // Mock register
        if (userData.email) {
          set({
            user: { ...mockCurrentUser, ...userData } as User,
            isAuthenticated: true,
          });
          return true;
        }
        return false;
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },

      setCurrentLocation: (locationId: string) => {
        set({ currentLocationId: locationId });
      },

      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;
        const role = useRolesStore.getState().roles.find(r => r.id === user.role);
        if (!role) return false;
        return !!role.permissions[permission];
      },
    }),
    {
      name: 'revo_auth_session',
    }
  )
);
