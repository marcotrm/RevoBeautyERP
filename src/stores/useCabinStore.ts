import { create } from 'zustand';
import { loadCabins } from '@/app/actions/cabins';
import { DEFAULT_CABINS, type Cabin } from '@/lib/cabins';

/**
 * Cabine del centro (numero + nome), condivise fra agenda e avviso di fine
 * trattamento. Cambiano di rado: si caricano una volta e restano lì.
 */
interface CabinStore {
  cabins: Cabin[];
  loaded: boolean;
  fetchCabins: () => Promise<void>;
}

export const useCabinStore = create<CabinStore>()((set) => ({
  cabins: DEFAULT_CABINS,
  loaded: false,
  fetchCabins: async () => {
    try {
      set({ cabins: await loadCabins(), loaded: true });
    } catch {
      // Restano quelle di partenza: meglio numeri generici che nessuna scelta
    }
  },
}));
