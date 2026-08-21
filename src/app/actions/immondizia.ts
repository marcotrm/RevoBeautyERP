'use server';

/**
 * Il calendario dell'immondizia, salvato una volta per tutte.
 *
 * Sta in `admin_entries` come le altre configurazioni del centro: non è un
 * dato del lavoro, è una regola del posto.
 */

import { prisma } from '@/lib/prisma';
import { CALENDARIO_VUOTO, type CalendarioImmondizia } from '@/lib/immondizia';

const ROW_ID = 'integration:immondizia';

export async function leggiCalendarioImmondizia(): Promise<CalendarioImmondizia> {
  try {
    const row = await prisma.adminEntry.findUnique({ where: { rowId: ROW_ID } });
    const d = (row?.data || {}) as Partial<CalendarioImmondizia>;
    return {
      giorni: (d.giorni || {}) as CalendarioImmondizia['giorni'],
      seraPrima: d.seraPrima !== false,
    };
  } catch {
    return CALENDARIO_VUOTO;
  }
}

export async function salvaCalendarioImmondizia(cal: CalendarioImmondizia): Promise<{ ok: boolean }> {
  await prisma.adminEntry.upsert({
    where: { rowId: ROW_ID },
    update: { data: cal as unknown as object },
    create: {
      rowId: ROW_ID, kind: 'integration', entityId: 'immondizia',
      data: cal as unknown as object, createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}
