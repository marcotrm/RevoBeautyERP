import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EconomicGoal, mockEconomicGoals } from '@/lib/admin-data';

interface GoalStore {
  goals: EconomicGoal[];
  addGoal: (goal: EconomicGoal) => void;
  updateGoal: (id: string, updates: Partial<EconomicGoal>) => void;
  deleteGoal: (id: string) => void;
}

export const useGoalStore = create<GoalStore>()(
  persist(
    (set) => ({
      goals: mockEconomicGoals,
      addGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),
      updateGoal: (id, updates) => set((state) => ({
        goals: state.goals.map(g => g.id === id ? { ...g, ...updates } : g)
      })),
      deleteGoal: (id) => set((state) => ({
        goals: state.goals.filter(g => g.id !== id)
      }))
    }),
    { name: 'revo_goals' }
  )
);
