'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PermissionModule {
  id: string;
  label: string;
  group: string;
}

export const PERMISSION_MODULES: PermissionModule[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Principale' },
  { id: 'agenda_view', label: 'Agenda (Visualizza)', group: 'Principale' },
  { id: 'agenda_edit', label: 'Agenda (Modifica)', group: 'Principale' },
  { id: 'clients_view', label: 'Clienti (Visualizza)', group: 'CRM' },
  { id: 'clients_edit', label: 'Clienti (Modifica)', group: 'CRM' },
  { id: 'clients_delete', label: 'Clienti (Elimina)', group: 'CRM' },
  { id: 'pos', label: 'Cassa / POS', group: 'Vendite' },
  { id: 'packages', label: 'Pacchetti', group: 'Vendite' },
  { id: 'inventory_view', label: 'Magazzino (Visualizza)', group: 'Magazzino' },
  { id: 'inventory_edit', label: 'Magazzino (Modifica)', group: 'Magazzino' },
  { id: 'marketing', label: 'Marketing', group: 'Marketing' },
  { id: 'reports', label: 'Report', group: 'Analisi' },
  { id: 'admin_dashboard', label: 'Amministrazione Dashboard', group: 'Amministrazione' },
  { id: 'admin_costs', label: 'Costi Fissi / Variabili', group: 'Amministrazione' },
  { id: 'admin_investments', label: 'Investimenti', group: 'Amministrazione' },
  { id: 'admin_breakeven', label: 'Punto di Pareggio', group: 'Amministrazione' },
  { id: 'admin_cashflow', label: 'Cash Flow', group: 'Amministrazione' },
  { id: 'admin_goals', label: 'Obiettivi', group: 'Amministrazione' },
  { id: 'admin_reports', label: 'Report Amministrativi', group: 'Amministrazione' },
  { id: 'admin_automations', label: 'Automazioni', group: 'Amministrazione' },
  { id: 'staff_view', label: 'Staff (Visualizza)', group: 'Staff' },
  { id: 'staff_edit', label: 'Staff (Modifica)', group: 'Staff' },
  { id: 'settings', label: 'Impostazioni', group: 'Sistema' },
  { id: 'roles', label: 'Ruoli e Permessi', group: 'Sistema' },
];

export const PERMISSION_GROUPS = [...new Set(PERMISSION_MODULES.map(m => m.group))];

export interface RoleConfig {
  id: string;
  name: string;
  color: string;
  isSystem: boolean; // system roles can't be deleted
  permissions: Record<string, boolean>;
}

const ALL_ON = Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, true]));

export const ROLE_COLORS = ['#EF4444', '#A855F7', '#3B82F6', '#22C55E', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1', '#F97316'];

const DEFAULT_ROLES: RoleConfig[] = [
  { id: 'admin', name: 'Amministratore', color: '#EF4444', isSystem: true, permissions: { ...ALL_ON } },
  { id: 'owner', name: 'Proprietario', color: '#A855F7', isSystem: true, permissions: { ...ALL_ON } },
  { id: 'manager', name: 'Manager', color: '#3B82F6', isSystem: false,
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, !['roles', 'settings', 'clients_delete'].includes(m.id)])) },
  { id: 'reception', name: 'Reception', color: '#22C55E', isSystem: false,
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, ['dashboard', 'agenda_view', 'agenda_edit', 'clients_view', 'clients_edit', 'pos', 'packages'].includes(m.id)])) },
  { id: 'estetista', name: 'Estetista', color: '#F59E0B', isSystem: false,
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, ['dashboard', 'agenda_view', 'clients_view'].includes(m.id)])) },
  { id: 'warehouse', name: 'Magazziniere', color: '#EC4899', isSystem: false,
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, ['dashboard', 'inventory_view', 'inventory_edit'].includes(m.id)])) },
];

interface RolesStore {
  roles: RoleConfig[];
  addRole: (name: string) => string;
  deleteRole: (roleId: string) => void;
  togglePermission: (roleId: string, permId: string) => void;
  toggleGroupAll: (roleId: string, group: string, value: boolean) => void;
}

export const useRolesStore = create<RolesStore>()(
  persist(
    (set, get) => ({
      roles: DEFAULT_ROLES,

      addRole: (name) => {
        const id = `role-${Date.now()}`;
        const color = ROLE_COLORS[get().roles.length % ROLE_COLORS.length];
        set(state => ({
          roles: [...state.roles, {
            id, name: name.trim(), color, isSystem: false,
            permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, false])),
          }],
        }));
        return id;
      },

      deleteRole: (roleId) => set(state => ({ roles: state.roles.filter(r => r.id !== roleId) })),

      togglePermission: (roleId, permId) => set(state => ({
        roles: state.roles.map(r => r.id === roleId
          ? { ...r, permissions: { ...r.permissions, [permId]: !r.permissions[permId] } }
          : r),
      })),

      toggleGroupAll: (roleId, group, value) => {
        const groupIds = PERMISSION_MODULES.filter(m => m.group === group).map(m => m.id);
        set(state => ({
          roles: state.roles.map(r => {
            if (r.id !== roleId) return r;
            const updated = { ...r.permissions };
            groupIds.forEach(id => { updated[id] = value; });
            return { ...r, permissions: updated };
          }),
        }));
      },
    }),
    {
      name: 'revo_roles_config',
    }
  )
);
