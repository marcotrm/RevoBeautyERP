import { create } from 'zustand';
import { Treatment } from '@/types';
import { getTreatments, createTreatment, updateTreatment as updateTreatmentAction, deleteTreatment as deleteTreatmentAction } from '@/app/actions/treatments';

interface TreatmentState {
  treatments: Treatment[];
  isLoading: boolean;
  fetchTreatments: () => Promise<void>;
  addTreatment: (treatment: Treatment) => Promise<void>;
  updateTreatment: (id: string, data: Partial<Treatment>) => Promise<void>;
  deleteTreatment: (id: string) => Promise<void>;
  setTreatments: (treatments: Treatment[]) => void;
}

export const useTreatmentStore = create<TreatmentState>()((set) => ({
  treatments: [],
  isLoading: false,

  fetchTreatments: async () => {
    set({ isLoading: true });
    try {
      const data = await getTreatments();
      set({ treatments: data, isLoading: false });
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  addTreatment: async (treatment) => {
    try {
      const newTreatment = await createTreatment(treatment);
      set((state) => ({ treatments: [...state.treatments, newTreatment] }));
    } catch (error) {
      console.error('Failed to add treatment', error);
      throw error;
    }
  },

  updateTreatment: async (id, data) => {
    try {
      const updated = await updateTreatmentAction(id, data);
      set((state) => ({
        treatments: state.treatments.map((t) => (t.id === id ? updated : t)),
      }));
    } catch (error) {
      console.error('Failed to update treatment', error);
      throw error;
    }
  },

  deleteTreatment: async (id) => {
    try {
      await deleteTreatmentAction(id);
      set((state) => ({
        treatments: state.treatments.filter((t) => t.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete treatment', error);
      throw error;
    }
  },

  setTreatments: (treatments) => set({ treatments }),
}));
