'use server';

import { getCabins, saveCabins, type Cabin } from '@/lib/cabins';

export async function loadCabins(): Promise<Cabin[]> {
  return getCabins();
}

export async function saveCabinsAction(cabins: Cabin[]): Promise<{ ok: boolean }> {
  await saveCabins(cabins);
  return { ok: true };
}
