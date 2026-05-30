import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '@/lib/helpers';

export interface WaitlistEntry {
  id: string;
  clientName: string;
  phone: string;
  treatmentId: string;
  treatmentName: string;
  duration: number; // in minutes
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  operatorId?: string; // Optional, can be any operator if undefined
  operatorName?: string;
  notes: string;
  status: 'waiting' | 'converted' | 'dismissed';
  createdAt: string; // ISO string
}

interface WaitlistState {
  entries: WaitlistEntry[];
  addEntry: (entry: Omit<WaitlistEntry, 'id' | 'createdAt' | 'status'>) => void;
  updateStatus: (id: string, status: WaitlistEntry['status']) => void;
  removeEntry: (id: string) => void;
}

export const useWaitlistStore = create<WaitlistState>()(
  persist(
    (set) => ({
      entries: [
        // Mock entry for demonstration
        {
          id: 'wl-1',
          clientName: 'Giulia Bianchi',
          phone: '3331234567',
          treatmentId: 't2',
          treatmentName: 'Pulizia Viso',
          duration: 60,
          date: new Date().toISOString().split('T')[0],
          startTime: '10:00',
          notes: 'Voleva questo orario ma era occupato.',
          status: 'waiting',
          createdAt: new Date().toISOString(),
        }
      ],
      addEntry: (entryData) =>
        set((state) => ({
          entries: [
            ...state.entries,
            {
              ...entryData,
              id: 'wl-' + generateId(),
              status: 'waiting',
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      updateStatus: (id, status) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, status } : e
          ),
        })),
      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),
    }),
    {
      name: 'revo_waitlist',
    }
  )
);
