import { cn } from '@/lib/utils';

export { cn };

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatTime(time: string): string {
  return time;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buongiorno';
  if (hour < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

export function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Ora';
  if (diffMin < 60) return `${diffMin}min fa`;
  if (diffHours < 24) return `${diffHours}h fa`;
  if (diffDays < 7) return `${diffDays}g fa`;
  return formatDate(timestamp);
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    facial: 'Viso',
    body: 'Corpo',
    laser: 'Laser',
    massage: 'Massaggi',
    nails: 'Unghie',
    waxing: 'Depilazione',
    consultation: 'Consulenza',
    hair: 'Capelli',
    makeup: 'Trucco',
  };
  return labels[category] || category;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    confirmed: 'Confermato',
    pending: 'In attesa',
    in_progress: 'Check-in',
    in_cabin: 'In Cabina',
    completed: 'Completato',
    no_show: 'No-Show',
    cancelled: 'Annullato',
    waitlist: 'Lista d\'attesa',
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    confirmed: '#22C55E',
    pending: '#F59E0B',
    in_progress: '#3B82F6',
    in_cabin: '#EC4899',
    completed: '#8B92A5',
    no_show: '#EF4444',
    cancelled: '#565D73',
    waitlist: '#A855F7',
  };
  return colors[status] || '#8B92A5';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Nomi italiani che non seguono la regola "finale -a = femmina"
const MALE_NAME_EXCEPTIONS = new Set([
  'andrea', 'luca', 'nicola', 'mattia', 'elia', 'enea', 'battista', 'tobia', 'amerigo',
]);
const FEMALE_NAME_EXCEPTIONS = new Set([
  'alice', 'beatrice', 'irene', 'adele', 'rachele', 'ester', 'nives', 'ines', 'iris',
  'carmen', 'miriam', 'noemi', 'ruth', 'consuelo', 'ingrid', 'agnese', 'gaia', 'dafne',
]);

// Deduce il sesso dal nome (euristica italiana). Usare il campo gender della scheda quando disponibile.
export function guessGenderFromName(fullName: string): 'male' | 'female' {
  const first = (fullName || '').trim().toLowerCase().split(/\s+/)[0] || '';
  if (!first) return 'female';
  if (MALE_NAME_EXCEPTIONS.has(first)) return 'male';
  if (FEMALE_NAME_EXCEPTIONS.has(first)) return 'female';
  const last = first[first.length - 1];
  if (last === 'a') return 'female';
  // -o, -e, consonanti: in italiano tipicamente maschili (le eccezioni femminili sono nella lista sopra)
  return 'male';
}
