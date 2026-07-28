'use client';

import { useEffect, useMemo } from 'react';
import { useOperatorStore } from '@/stores/useOperatorStore';

/** Soci: incassano anche loro, non sono nella lista operatrici. */
export const OWNERS = ['Dino', 'Francesco'];

/**
 * Nomi da mostrare in "Incassato da" / "Eseguito da": i soci più le
 * estetiste vere del centro (le cabine/risorse restano fuori).
 */
export function useStaffNames(): string[] {
  const operators = useOperatorStore(s => s.operators);
  const fetchOperators = useOperatorStore(s => s.fetchOperators);

  useEffect(() => { fetchOperators(); }, [fetchOperators]);

  return useMemo(() => {
    const staff = operators
      .filter(o => !o.isResource && o.isActive !== false)
      .map(o => `${o.firstName} ${o.lastName}`.trim())
      .filter(Boolean);
    return [...OWNERS, ...staff.filter(n => !OWNERS.includes(n))];
  }, [operators]);
}
