// Collega le voci di menu e le route della dashboard al permesso richiesto.
// I permessi sono definiti in useRolesStore (PERMISSION_MODULES) e assegnati
// ai ruoli/account in Impostazioni → Ruoli e Permessi / Account Gestionale.

import { RoleConfig } from '@/lib/rolesConfig';

// menu id (Sidebar) -> permesso richiesto per vedere la voce
export const MENU_PERMISSIONS: Record<string, string> = {
  dashboard: 'dashboard',
  agenda: 'agenda_view',
  clients: 'clients_view',
  pos: 'pos',
  'cassa-contanti': 'pos',
  scontrini: 'pos',
  packages: 'packages',
  'gift-cards': 'packages',
  inventory: 'inventory_view',
  marketing: 'marketing',
  'copri-buchi': 'marketing',
  // Contengono nome, telefono ed email di persone: stesso permesso della rubrica.
  contatti: 'clients_view',
  affiliati: 'marketing',
  reports: 'reports',
  statistiche: 'reports',
  todo: 'dashboard',
  admin: 'admin_dashboard',
  staff: 'staff_view',
  // Impostazioni si apre anche col solo permesso Autoclave: dentro, la pagina
  // mostra a quei ruoli soltanto la categoria del registro disinfezioni.
  settings: 'settings|autoclave',
  inaugurazione: 'settings',
  automazioni: 'admin_automations',
  assistente: 'admin_automations',
  // Le chat contengono dati personali dei clienti: stesso permesso della rubrica.
  whatsapp: 'clients_view',
};

// prefisso route -> permesso richiesto per accedere alla pagina
const ROUTE_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: '/dashboard/admin/automations', permission: 'admin_automations' },
  { prefix: '/dashboard/admin/breakeven', permission: 'admin_breakeven' },
  { prefix: '/dashboard/admin/cashflow', permission: 'admin_cashflow' },
  { prefix: '/dashboard/admin/fixed-costs', permission: 'admin_costs' },
  { prefix: '/dashboard/admin/variable-costs', permission: 'admin_costs' },
  { prefix: '/dashboard/admin/partner-expenses', permission: 'admin_costs' },
  { prefix: '/dashboard/admin/goals', permission: 'admin_goals' },
  { prefix: '/dashboard/admin/investments', permission: 'admin_investments' },
  { prefix: '/dashboard/admin/reports', permission: 'admin_reports' },
  { prefix: '/dashboard/admin', permission: 'admin_dashboard' },
  { prefix: '/dashboard/agenda', permission: 'agenda_view' },
  /*
    Le pagine del telefono chiedono gli stessi permessi delle loro gemelle sul
    computer. Stavano fuori dal controllo per ruolo — bastava conoscere
    l'indirizzo per vedere la cassaforte da qualunque account.
  */
  { prefix: '/m', permission: 'dashboard' },
  { prefix: '/agenda-mobile', permission: 'agenda_view' },
  { prefix: '/clienti-mobile', permission: 'clients_view' },
  { prefix: '/dashboard-mobile', permission: 'dashboard' },
  { prefix: '/cassaforte-mobile', permission: 'pos' },
  { prefix: '/dashboard/clients', permission: 'clients_view' },
  { prefix: '/dashboard/contatti', permission: 'clients_view' },
  { prefix: '/dashboard/pos', permission: 'pos' },
  { prefix: '/dashboard/cassa-contanti', permission: 'pos' },
  { prefix: '/dashboard/packages', permission: 'packages' },
  { prefix: '/dashboard/gift-cards', permission: 'packages' },
  { prefix: '/dashboard/inventory', permission: 'inventory_view' },
  { prefix: '/dashboard/marketing', permission: 'marketing' },
  { prefix: '/dashboard/reports', permission: 'reports' },
  { prefix: '/dashboard/statistiche', permission: 'reports' },
  { prefix: '/dashboard/todo', permission: 'dashboard' },
  { prefix: '/dashboard/staff', permission: 'staff_view' },
  { prefix: '/dashboard/settings/inaugurazione', permission: 'settings' },
  { prefix: '/dashboard/settings', permission: 'settings|autoclave' },
  { prefix: '/dashboard/automazioni', permission: 'admin_automations' },
  /*
    Le impostazioni dell'assistente stanno dietro lo stesso permesso delle
    automazioni: da lì si cambiano gli orari del centro e si legge tutto quello
    che l'assistente è autorizzato a dire alle clienti. Una rotta non elencata
    qui resta aperta a chiunque abbia un accesso — reception ed estetiste comprese.
  */
  { prefix: '/dashboard/assistente', permission: 'admin_automations' },
  { prefix: '/dashboard', permission: 'dashboard' },
]
  // il match più specifico (prefisso più lungo) vince
  .sort((a, b) => b.prefix.length - a.prefix.length);

/** Permesso richiesto per una route, o null se la route non è mappata (accesso libero). */
export function permissionForPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = ROUTE_PERMISSIONS.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/')
  );
  return match?.permission ?? null;
}

/**
 * true se il ruolo ha il permesso indicato. Il permesso può essere una lista
 * in OR separata da "|" (es. 'settings|autoclave'): basta averne uno.
 */
export function roleHasPermission(role: RoleConfig | undefined, permission: string | null): boolean {
  if (!permission) return true; // route/voce non protetta
  if (!role) return false;
  return permission.split('|').some(p => !!role.permissions[p]);
}
