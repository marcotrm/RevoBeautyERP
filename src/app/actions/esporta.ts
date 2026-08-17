'use server';

/**
 * Il permesso per scaricare l'esportazione.
 *
 * La pagina non punta direttamente all'indirizzo del file: prima chiede qui un
 * permesso usa-e-getta, e solo con quello il server consegna i dati. Così
 * l'indirizzo del download non è qualcosa che si può passare a qualcun altro,
 * e chi non ha il gestionale aperto non ha niente da chiamare.
 */

import { creaTokenExport, type PeriodoExport } from '@/lib/esportaDati';

export async function linkEsportazione(periodo: PeriodoExport = {}): Promise<string> {
  const token = await creaTokenExport(periodo);
  const qs = new URLSearchParams({ t: token });
  if (periodo.da) qs.set('da', periodo.da);
  if (periodo.a) qs.set('a', periodo.a);
  return `/api/esporta?${qs.toString()}`;
}
