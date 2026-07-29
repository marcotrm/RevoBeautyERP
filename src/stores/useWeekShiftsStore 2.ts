'use client';

import { create } from 'zustand';
import { getWeekShifts, type WeekScheduleMap } from '@/app/actions/weekShifts';

interface WeekShiftsStore {
  byWeek: Record<string, Record<string, WeekScheduleMap>>; // weekStart -> (opId -> {dow->turno})
  loading: Record<string, boolean>;
  fetchWeek: (weekStart: string, force?: boolean) => Promise<void>;
}

export const useWeekShiftsStore = create<WeekShiftsStore>((set, get) => ({
  byWeek: {},
  loading: {},

  fetchWeek: async (weekStart, force = false) => {
    if (!force && get().loading[weekStart]) return;
    set(s => ({ loading: { ...s.loading, [weekStart]: true } }));
    try {
      const map = await getWeekShifts(weekStart);
      set(s => ({ byWeek: { ...s.byWeek, [weekStart]: map }, loading: { ...s.loading, [weekStart]: false } }));
    } catch (e) {
      console.error('[weekShifts] fetch fallito', e);
      set(s => ({ loading: { ...s.loading, [weekStart]: false } }));
    }
  },
}));
