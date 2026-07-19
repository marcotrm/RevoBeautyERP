import { create } from 'zustand';
import { EconomicGoal } from '@/lib/admin-data';
import { getAdminEntries, createAdminEntry, updateAdminEntry, deleteAdminEntry, migrateAdminEntries } from '@/app/actions/admin';

const KIND = 'goal';

interface GoalStore {
  goals: EconomicGoal[];
  fetchGoals: () => Promise<void>;
  addGoal: (goal: EconomicGoal) => Promise<void>;
  updateGoal: (id: string, updates: Partial<EconomicGoal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

async function migrateLocal() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('revo_goals');
    if (!raw) return;
    const list = JSON.parse(raw)?.state?.goals;
    if (Array.isArray(list) && list.length) await migrateAdminEntries(KIND, list);
    window.localStorage.removeItem('revo_goals');
  } catch { /* ignora */ }
}

export const useGoalStore = create<GoalStore>((set) => ({
  goals: [],
  fetchGoals: async () => {
    try { await migrateLocal(); const data = await getAdminEntries(KIND); set({ goals: data as unknown as EconomicGoal[] }); }
    catch (e) { console.error(e); }
  },
  addGoal: async (goal) => {
    await createAdminEntry(KIND, goal as unknown as Record<string, unknown>);
    set((s) => ({ goals: [...s.goals, goal] }));
  },
  updateGoal: async (id, updates) => {
    await updateAdminEntry(KIND, id, updates as Record<string, unknown>);
    set((s) => ({ goals: s.goals.map(g => g.id === id ? { ...g, ...updates } : g) }));
  },
  deleteGoal: async (id) => {
    await deleteAdminEntry(KIND, id);
    set((s) => ({ goals: s.goals.filter(g => g.id !== id) }));
  },
}));
