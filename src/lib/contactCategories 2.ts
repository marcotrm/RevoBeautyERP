// Categorie della rubrica contatti (fornitori, professionisti, servizi).
// Sta fuori dai file 'use server' perché quelli possono esportare solo funzioni async.

export interface ContactCategory {
  id: string;
  label: string;
  color: string; // classi tailwind per il badge
}

export const CONTACT_CATEGORIES: ContactCategory[] = [
  { id: 'professionisti', label: 'Professionisti', color: 'bg-accent/10 text-accent' },
  { id: 'fornitori', label: 'Fornitori', color: 'bg-info/10 text-info' },
  { id: 'servizi', label: 'Servizi e manutenzione', color: 'bg-warning/10 text-warning' },
  { id: 'istituzioni', label: 'Banche e istituzioni', color: 'bg-success/10 text-success' },
  { id: 'altro', label: 'Altro', color: 'bg-bg-hover text-text-secondary' },
];

export function categoryLabel(id: string): string {
  return CONTACT_CATEGORIES.find((c) => c.id === id)?.label ?? 'Altro';
}

export function categoryColor(id: string): string {
  return CONTACT_CATEGORIES.find((c) => c.id === id)?.color ?? 'bg-bg-hover text-text-secondary';
}

// Ruoli suggeriti nel form (si può comunque scrivere quello che si vuole)
export const ROLE_SUGGESTIONS: Record<string, string[]> = {
  professionisti: ['Commercialista', 'Consulente del lavoro', 'Avvocato', 'Programmatore', 'HR / Selezione personale', 'Consulente marketing', 'Fotografo', 'Social media manager'],
  fornitori: ['Fornitore prodotti', 'Fornitore macchinari', 'Fornitore monouso', 'Grossista', 'Agente di zona'],
  servizi: ['Assistenza macchinari', 'Elettricista', 'Idraulico', 'Climatizzazione', 'Pulizie', 'Smaltimento rifiuti', 'Informatico / Rete', 'Insegne e stampa'],
  istituzioni: ['Banca', 'Assicurazione', 'POS / Pagamenti', 'Noleggio', 'Comune', 'ASL'],
  altro: [],
};
