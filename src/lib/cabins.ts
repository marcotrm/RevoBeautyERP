/**
 * Anagrafica delle cabine del centro.
 *
 * Sull'appuntamento si salva SOLO il numero scelto al check-in: il nome vive
 * qui. Così rinominare una cabina ("Cabina 2" → "Sala Laser") non riscrive lo
 * storico degli appuntamenti già fatti, e basta cambiarlo in un posto solo
 * perché cambi anche quello che dice la voce a fine trattamento.
 */

import { prisma } from '@/lib/prisma';

const ROW_ID = 'cfg:cabine';

export interface Cabin {
  /** Quello che l'operatrice preme al check-in ed è salvato sull'appuntamento. */
  numero: string;
  /** Come si chiama davvero, se ha un nome: "Sala Laser", "Cabina Lampada". */
  nome?: string;
}

/** Se non è stato configurato niente si parte con sei cabine numerate. */
export const DEFAULT_CABINS: Cabin[] = [
  { numero: '1' }, { numero: '2' }, { numero: '3' },
  { numero: '4' }, { numero: '5' }, { numero: '6' },
];

export async function getCabins(): Promise<Cabin[]> {
  try {
    const row = await prisma.adminEntry.findUnique({ where: { rowId: ROW_ID } });
    const list = (row?.data as { cabins?: Cabin[] } | null)?.cabins;
    if (!Array.isArray(list) || list.length === 0) return DEFAULT_CABINS;
    return list
      .map(c => ({ numero: String(c.numero ?? '').trim(), nome: c.nome?.trim() || undefined }))
      .filter(c => c.numero !== '');
  } catch {
    return DEFAULT_CABINS;
  }
}

export async function saveCabins(cabins: Cabin[]): Promise<void> {
  const pulite = cabins
    .map(c => ({ numero: String(c.numero ?? '').trim(), nome: c.nome?.trim() || undefined }))
    .filter(c => c.numero !== '');
  const data = { cabins: pulite };
  await prisma.adminEntry.upsert({
    where: { rowId: ROW_ID },
    create: { rowId: ROW_ID, kind: 'config', entityId: 'cabine', data, createdAt: new Date().toISOString() },
    update: { data },
  });
}

/**
 * Come chiamare una cabina a schermo e a voce.
 * Con il nome: "Sala Laser". Senza: "Cabina 4".
 */
export function cabinName(numero: string, cabins: Cabin[]): string {
  const n = String(numero || '').trim();
  if (!n) return '';
  const trovata = cabins.find(c => c.numero === n);
  if (trovata?.nome) return trovata.nome;
  return /^\d+$/.test(n) ? `Cabina ${n}` : n;
}
