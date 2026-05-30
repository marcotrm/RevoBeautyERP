import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PunchType = 'in' | 'out' | 'break_start' | 'break_end';

export interface TimePunch {
  id: string;
  staffId: string;
  staffName: string;
  type: PunchType;
  timestamp: string; // ISO string
}

interface TimeClockState {
  punches: TimePunch[];
  addPunch: (punch: Omit<TimePunch, 'id'>) => void;
  deletePunch: (id: string) => void;
  // Get the current status for a staff member (in, out, or on_break)
  getStaffStatus: (staffId: string) => 'out' | 'in' | 'on_break';
}

export const useTimeClockStore = create<TimeClockState>()(
  persist(
    (set, get) => ({
      punches: [],
      
      addPunch: (punch) =>
        set((state) => ({
          punches: [
            { ...punch, id: Date.now().toString() },
            ...state.punches,
          ],
        })),
        
      deletePunch: (id) =>
        set((state) => ({
          punches: state.punches.filter((p) => p.id !== id),
        })),
        
      getStaffStatus: (staffId) => {
        const { punches } = get();
        const staffPunches = punches.filter(p => p.staffId === staffId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (staffPunches.length === 0) return 'out';
        
        const lastPunch = staffPunches[0];
        if (lastPunch.type === 'in' || lastPunch.type === 'break_end') return 'in';
        if (lastPunch.type === 'break_start') return 'on_break';
        return 'out'; // if 'out'
      }
    }),
    {
      name: 'revo_time_clock',
    }
  )
);
