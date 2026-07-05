import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Treatment } from '@/types';
import { mockTreatments } from '@/lib/mock-data';

interface TreatmentState {
  treatments: Treatment[];
  addTreatment: (treatment: Treatment) => void;
  updateTreatment: (id: string, data: Partial<Treatment>) => void;
  deleteTreatment: (id: string) => void;
  setTreatments: (treatments: Treatment[]) => void;
}

export const useTreatmentStore = create<TreatmentState>()(
  persist(
    (set) => ({
      treatments: [...mockTreatments], // Initialize with mock if empty
      
      addTreatment: (treatment) => set((state) => ({
        treatments: [...state.treatments, treatment]
      })),
      
      updateTreatment: (id, data) => set((state) => ({
        treatments: state.treatments.map((t) => 
          t.id === id ? { ...t, ...data } : t
        )
      })),
      
      deleteTreatment: (id) => set((state) => ({
        treatments: state.treatments.filter((t) => t.id !== id)
      })),

      setTreatments: (treatments) => set({ treatments })
    }),
    {
      name: 'revo_treatments', // using the same key as the old usePersistedState so data is preserved
    }
  )
);
