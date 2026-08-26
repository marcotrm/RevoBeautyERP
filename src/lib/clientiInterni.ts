/**
 * Le schede "di casa": titolari, staff, prove.
 *
 * Il titolare si prenota da solo per provare l'agenda, e quelle righe finiscono
 * nelle classifiche come se fosse la cliente che spende di più. Non sono
 * clienti veri e falsano ogni numero: incasso medio, scontrino, visite.
 *
 * Non si cancellano — hanno appuntamenti e pagamenti attaccati, e servono a
 * fare le prove — si marcano con un'etichetta e le statistiche le saltano.
 * L'etichetta si mette dalla scheda cliente, fra le altre etichette.
 */

export const TAG_INTERNO = 'interno';

/** Vero se la scheda è di casa e non deve entrare nelle statistiche. */
export function isInterno(c: { tags?: string[] | null }): boolean {
  return (c.tags || []).some(t => String(t).trim().toLowerCase() === TAG_INTERNO);
}

/** Le sole schede vere, senza quelle di casa. */
export function soloClientiVeri<T extends { tags?: string[] | null }>(clients: T[]): T[] {
  return clients.filter(c => !isInterno(c));
}

/* ============================================================
   Il filtro pronto per le statistiche.
   ============================================================ */

/**
 * Chi va tolto dai conti, riconosciuto sia per id sia per nome.
 *
 * Serve perché le righe di cassa non portano l'id della cliente ma solo il
 * nome scritto: senza il confronto sul nome, gli incassi delle prove
 * resterebbero dentro al fatturato anche dopo aver marcato la scheda.
 */
export async function filtroInterni(db: {
  client: { findMany: (args: { select: Record<string, boolean> }) => Promise<unknown> };
}): Promise<{
  ids: Set<string>;
  nomi: Set<string>;
  daEscludere: (r: { clientId?: string | null; clientName?: string | null }) => boolean;
}> {
  const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let schede: { id: string; firstName: string; lastName: string; tags: string[] | null }[] = [];
  try {
    schede = await db.client.findMany({
      select: { id: true, firstName: true, lastName: true, tags: true },
    }) as typeof schede;
  } catch {
    schede = [];
  }

  const interne = schede.filter(isInterno);
  const ids = new Set(interne.map(c => c.id));
  const nomi = new Set(interne.map(c => norm(`${c.firstName} ${c.lastName}`)));

  return {
    ids, nomi,
    daEscludere: (r) => {
      if (r.clientId && ids.has(r.clientId)) return true;
      const n = norm(r.clientName || '');
      return Boolean(n) && nomi.has(n);
    },
  };
}
