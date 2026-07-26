// Etichette dei motivi di entrata/uscita della cassa contanti.
// Sta fuori dalle server action perché un file 'use server' può esportare solo funzioni.
export const CATEGORY_LABELS: Record<string, string> = {
  fondo: 'Fondo cassa',
  spesa: 'Spesa',
  entrata: 'Entrata varia',
  prelievo: 'Prelievo',
  correzione: 'Correzione conteggio',
  altro: 'Altro',
};
