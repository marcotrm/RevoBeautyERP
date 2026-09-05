'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { mockCurrentUser } from '@/lib/mock-data';
import { useRolesStore } from '@/stores/useRolesStore';
import { authenticate, getAccountById, esci } from '@/app/actions/accounts';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  currentLocationId: string;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: Partial<User>, password: string) => Promise<boolean>;
  logout: () => void;
  setCurrentLocation: (locationId: string) => void;
  hasPermission: (permission: string) => boolean;
  refreshSession: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      currentLocationId: 'loc1',

      login: async (email: string, password: string) => {
        // Autenticazione lato server contro il DB (account condivisi tra i dispositivi).
        // Gli account si gestiscono in Impostazioni > Account Gestionale.
        try {
          const account = await authenticate(email, password);
          if (account) {
            set({
              user: { ...mockCurrentUser, id: account.id, email: account.email, firstName: account.firstName, lastName: account.lastName, role: account.roleId },
              isAuthenticated: true,
            });
            return true;
          }
        } catch (e) {
          console.error('Login failed', e);
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
        // Anche la sessione sul server: il cookie firmato deve sparire, o
        // uscire dal gestionale lascerebbe aperta la porta che conta davvero.
        esci().catch(() => {});
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

      // Riallinea la sessione all'account nel DB: aggiorna il ruolo se cambiato,
      // e disconnette se l'account è stato disattivato o eliminato.
      refreshSession: async () => {
        const { user } = get();
        if (!user) return;
        try {
          const account = await getAccountById(user.id);
          if (!account || !account.active) {
            set({ user: null, isAuthenticated: false });
            return;
          }
          if (account.roleId !== user.role || account.firstName !== user.firstName || account.lastName !== user.lastName) {
            set({ user: { ...user, role: account.roleId, firstName: account.firstName, lastName: account.lastName } });
          }
        } catch (e) {
          console.error('refreshSession failed', e);
        }
      },
    }),
    {
      name: 'revo_auth_session',
    }
  )
);
