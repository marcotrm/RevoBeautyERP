'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from '@/types';
import { mockCurrentUser } from '@/lib/mock-data';

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

const rolePermissions: Record<UserRole, string[]> = {
  super_admin: ['*'],
  owner: ['*'],
  manager: ['agenda', 'clients', 'pos', 'inventory', 'marketing', 'reports', 'staff', 'settings'],
  receptionist: ['agenda', 'clients', 'pos'],
  operator: ['agenda', 'clients.view'],
  commercial: ['clients', 'marketing', 'reports'],
  warehouse: ['inventory'],
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      currentLocationId: 'loc1',

      login: async (email: string, _password: string) => {
        // Mock login
        if (email) {
          const userRole = email.includes('staff') ? 'operator' : 'owner';
          const name = email.includes('staff') ? 'Staff Member' : 'Dino Caruso';
          set({
            user: { ...mockCurrentUser, email, firstName: name.split(' ')[0], lastName: name.split(' ')[1] || '', role: userRole as UserRole },
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
        const perms = rolePermissions[user.role];
        if (perms.includes('*')) return true;
        return perms.some(p => permission.startsWith(p));
      },
    }),
    {
      name: 'revo_auth_session',
    }
  )
);
