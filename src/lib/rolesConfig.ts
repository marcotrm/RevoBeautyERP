// Costanti condivise per ruoli e permessi — usabili sia lato client (store)
// sia lato server (server actions per il seeding). NON deve avere 'use client'.

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

export const PERMISSION_GROUPS = [...new Set(PERMISSION_MODULES.map((m) => m.group))];

export const ROLE_COLORS = ['#EF4444', '#A855F7', '#3B82F6', '#22C55E', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1', '#F97316'];

export interface RoleConfig {
  id: string;
  name: string;
  color: string;
  isSystem: boolean; // i ruoli di sistema non si possono eliminare
  permissions: Record<string, boolean>;
}

const ALL_ON = Object.fromEntries(PERMISSION_MODULES.map((m) => [m.id, true]));

/** Permessi di default per un elenco di moduli attivi. */
export function permsFor(activeIds: string[]): Record<string, boolean> {
  return Object.fromEntries(PERMISSION_MODULES.map((m) => [m.id, activeIds.includes(m.id)]));
}

/** Mappa completa dei permessi con tutti su false (per nuovi ruoli custom). */
export function emptyPerms(): Record<string, boolean> {
  return Object.fromEntries(PERMISSION_MODULES.map((m) => [m.id, false]));
}

/** Normalizza una mappa permessi assicurando una chiave per ogni modulo. */
export function normalizePerms(perms: Record<string, boolean> | null | undefined): Record<string, boolean> {
  const base = emptyPerms();
  if (perms) for (const m of PERMISSION_MODULES) base[m.id] = !!perms[m.id];
  return base;
}

// Ruoli di default seminati nel DB al primo avvio.
export const DEFAULT_ROLES: RoleConfig[] = [
  { id: 'admin', name: 'Amministratore', color: '#EF4444', isSystem: true, permissions: { ...ALL_ON } },
  { id: 'owner', name: 'Proprietario', color: '#A855F7', isSystem: true, permissions: { ...ALL_ON } },
  { id: 'manager', name: 'Manager', color: '#3B82F6', isSystem: false,
    permissions: permsFor(PERMISSION_MODULES.filter((m) => !['roles', 'settings', 'clients_delete'].includes(m.id)).map((m) => m.id)) },
  { id: 'reception', name: 'Reception', color: '#22C55E', isSystem: false,
    permissions: permsFor(['dashboard', 'agenda_view', 'agenda_edit', 'clients_view', 'clients_edit', 'pos', 'packages']) },
  { id: 'estetista', name: 'Estetista', color: '#F59E0B', isSystem: false,
    permissions: permsFor(['dashboard', 'agenda_view', 'clients_view']) },
  { id: 'warehouse', name: 'Magazziniere', color: '#EC4899', isSystem: false,
    permissions: permsFor(['dashboard', 'inventory_view', 'inventory_edit']) },
];

// Account di default (creati nel DB al primo avvio se la tabella è vuota).
export const DEFAULT_ACCOUNTS = [
  { id: 'acc-dino', firstName: 'Dino', lastName: 'Caruso', email: 'dino@revobeauty.it', password: 'password123', roleId: 'owner', active: true },
  { id: 'acc-francesco', firstName: 'Francesco', lastName: '', email: 'francesco@revobeauty.it', password: 'password123', roleId: 'owner', active: true },
  { id: 'acc-staff', firstName: 'Staff', lastName: 'Member', email: 'staff@revobeauty.it', password: 'password123', roleId: 'estetista', active: true },
];
