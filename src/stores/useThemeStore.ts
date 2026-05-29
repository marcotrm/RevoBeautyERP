'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const ACCENT_PAIRS: Record<string, { accent: string; hover: string; secondary: string; glow: string }> = {
  '#A855F7': { accent: '#A855F7', hover: '#9333EA', secondary: '#EC4899', glow: 'rgba(168, 85, 247, 0.15)' },
  '#EC4899': { accent: '#EC4899', hover: '#DB2777', secondary: '#F43F5E', glow: 'rgba(236, 72, 153, 0.15)' },
  '#3B82F6': { accent: '#3B82F6', hover: '#2563EB', secondary: '#6366F1', glow: 'rgba(59, 130, 246, 0.15)' },
  '#22C55E': { accent: '#22C55E', hover: '#16A34A', secondary: '#14B8A6', glow: 'rgba(34, 197, 94, 0.15)' },
  '#F59E0B': { accent: '#F59E0B', hover: '#D97706', secondary: '#F97316', glow: 'rgba(245, 158, 11, 0.15)' },
  '#EF4444': { accent: '#EF4444', hover: '#DC2626', secondary: '#F97316', glow: 'rgba(239, 68, 68, 0.15)' },
  '#6366F1': { accent: '#6366F1', hover: '#4F46E5', secondary: '#8B5CF6', glow: 'rgba(99, 102, 241, 0.15)' },
  '#14B8A6': { accent: '#14B8A6', hover: '#0D9488', secondary: '#06B6D4', glow: 'rgba(20, 184, 166, 0.15)' },
};

interface ThemeStore {
  isDark: boolean;
  accentColor: string;
  logoUrl: string | null;
  toggleTheme: () => void;
  setDark: (dark: boolean) => void;
  setAccentColor: (color: string) => void;
  setLogoUrl: (url: string | null) => void;
  _hydrated: boolean;
  setHydrated: () => void;
}

function applyAccent(color: string) {
  if (typeof document === 'undefined') return;
  const pair = ACCENT_PAIRS[color];
  if (!pair) return;
  const root = document.documentElement;
  root.style.setProperty('--color-accent', pair.accent);
  root.style.setProperty('--color-accent-hover', pair.hover);
  root.style.setProperty('--color-accent-secondary', pair.secondary);
  root.style.setProperty('--color-accent-glow', pair.glow);
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      isDark: true,
      accentColor: '#A855F7',
      logoUrl: null,
      _hydrated: false,
      setHydrated: () => set({ _hydrated: true }),
      toggleTheme: () =>
        set((state) => {
          const newDark = !state.isDark;
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', newDark);
            document.documentElement.classList.toggle('light', !newDark);
          }
          return { isDark: newDark };
        }),
      setDark: (dark) => {
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', dark);
          document.documentElement.classList.toggle('light', !dark);
        }
        set({ isDark: dark });
      },
      setAccentColor: (color) => {
        applyAccent(color);
        set({ accentColor: color });
      },
      setLogoUrl: (url) => set({ logoUrl: url }),
    }),
    {
      name: 'revobeauty-theme',
      partialize: (state) => ({
        isDark: state.isDark,
        accentColor: state.accentColor,
        logoUrl: state.logoUrl,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated();
          // Re-apply theme on load
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', state.isDark);
            document.documentElement.classList.toggle('light', !state.isDark);
          }
          if (state.accentColor) applyAccent(state.accentColor);
        }
      },
    }
  )
);
