'use client';

import { create } from 'zustand';

interface UIStore {
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  commandPaletteOpen: boolean;
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarMobileOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openModal: (modal: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  commandPaletteOpen: false,
  activeModal: null,
  modalData: null,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  openModal: (modal, data) => set({ activeModal: modal, modalData: data || null }),
  closeModal: () => set({ activeModal: null, modalData: null }),
}));
