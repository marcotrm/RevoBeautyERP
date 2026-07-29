// Motivi dello scarico/carico magazzino (fuori dai file 'use server').

export interface StockReason {
  id: string;
  label: string;
}

// Perché un prodotto esce dal magazzino
export const OUT_REASONS: StockReason[] = [
  { id: 'uso_interno', label: 'Uso interno (cabina)' },
  { id: 'vendita', label: 'Venduto (fuori cassa)' },
  { id: 'omaggio', label: 'Omaggio / campione' },
  { id: 'scaduto', label: 'Scaduto' },
  { id: 'danneggiato', label: 'Rotto / danneggiato' },
  { id: 'reso_fornitore', label: 'Reso al fornitore' },
  { id: 'furto', label: 'Ammanco / furto' },
  { id: 'correzione', label: 'Correzione inventario' },
  { id: 'altro', label: 'Altro' },
];

// Perché un prodotto rientra nel magazzino
export const IN_REASONS: StockReason[] = [
  { id: 'acquisto', label: 'Acquisto / carico fornitore' },
  { id: 'reso_cliente', label: 'Reso dalla cliente' },
  { id: 'correzione', label: 'Correzione inventario' },
  { id: 'altro', label: 'Altro' },
];

export function reasonLabel(id: string): string {
  return [...OUT_REASONS, ...IN_REASONS].find(r => r.id === id)?.label ?? id;
}
