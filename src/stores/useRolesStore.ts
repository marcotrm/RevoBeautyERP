'use client';

import { create } from 'zustand';
import {
  RoleConfig, PERMISSION_MODULES, PERMISSION_GROUPS, ROLE_COLORS, PermissionModule,
} from '@/lib/rolesConfig';
import {
  getRoles, createRole as createRoleAction, updateRolePermissions, deleteRole as deleteRoleAction,
} from '@/app/actions/roles';

// Re-export per compatibilità con gli import esistenti
export type { RoleConfig, PermissionModule };
export { PERMISSION_MODULES, PERMISSION_GROUPS, ROLE_COLORS };

interface RolesStore {
  roles: RoleConfig[];
  loaded: boolean;
  isLoading: boolean;
  fetchRoles: () => Promise<void>;
  addRole: (name: string) => Promise<string | null>;
  deleteRole: (roleId: string) => Promise<void>;
  togglePermission: (roleId: string, permId: string) => Promise<void>;
  toggleGroupAll: (roleId: string, group: string, value: boolean) => Promise<void>;
}

// Persiste su DB la mappa permessi aggiornata di un ruolo (usa lo stato corrente).
async function persistPermissions(get: () => RolesStore, roleId: string) {
  const role = get().roles.find((r) => r.id === roleId);
  if (role) {
    try {
      await updateRolePermissions(roleId, role.permissions);
    } catch (e) {
      console.error('Failed to persist permissions', e);
    }
  }
}

export const useRolesStore = create<RolesStore>()((set, get) => ({
  roles: [],
  loaded: false,
  isLoading: false,

  fetchRoles: async () => {
    set({ isLoading: true });
    try {
      const data = await getRoles();
      set({ roles: data, loaded: true, isLoading: false });
    } catch (e) {
      console.error('Failed to fetch roles', e);
      set({ isLoading: false });
    }
  },

  addRole: async (name) => {
    if (!name.trim()) return null;
    try {
      const role = await createRoleAction(name);
      set((s) => ({ roles: [...s.roles, role] }));
      return role.id;
    } catch (e) {
      console.error('Failed to create role', e);
      return null;
    }
  },

  deleteRole: async (roleId) => {
    try {
      await deleteRoleAction(roleId);
      set((s) => ({ roles: s.roles.filter((r) => r.id !== roleId) }));
    } catch (e) {
      console.error('Failed to delete role', e);
    }
  },

  togglePermission: async (roleId, permId) => {
    // update ottimistico
    set((s) => ({
      roles: s.roles.map((r) =>
        r.id === roleId ? { ...r, permissions: { ...r.permissions, [permId]: !r.permissions[permId] } } : r,
      ),
    }));
    await persistPermissions(get, roleId);
  },

  toggleGroupAll: async (roleId, group, value) => {
    const groupIds = PERMISSION_MODULES.filter((m) => m.group === group).map((m) => m.id);
    set((s) => ({
      roles: s.roles.map((r) => {
        if (r.id !== roleId) return r;
        const updated = { ...r.permissions };
        groupIds.forEach((id) => { updated[id] = value; });
        return { ...r, permissions: updated };
      }),
    }));
    await persistPermissions(get, roleId);
  },
}));
