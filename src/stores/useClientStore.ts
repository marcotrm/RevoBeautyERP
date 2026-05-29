'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Client } from '@/types';
import { mockClients } from '@/lib/mock-data';
import { generateId } from '@/lib/helpers';

interface ClientStore {
  clients: Client[];
  searchQuery: string;
  activeFilter: string;
  selectedClient: Client | null;

  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: string) => void;
  selectClient: (client: Client | null) => void;

  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'totalSpent' | 'visitCount' | 'avgTicket' | 'loyaltyPoints' | 'cashback'>) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  getFilteredClients: () => Client[];
}

export const useClientStore = create<ClientStore>()(
  persist(
    (set, get) => ({
      clients: mockClients,
      searchQuery: '',
      activeFilter: 'all',
      selectedClient: null,

      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveFilter: (filter) => set({ activeFilter: filter }),
      selectClient: (client) => set({ selectedClient: client }),

      addClient: (clientData) =>
        set((state) => ({
          clients: [
            ...state.clients,
            {
              ...clientData,
              id: generateId(),
              createdAt: new Date().toISOString().split('T')[0],
              totalSpent: 0,
              visitCount: 0,
              avgTicket: 0,
              loyaltyPoints: 0,
              cashback: 0,
            } as Client,
          ],
        })),

      updateClient: (id, updates) =>
        set((state) => ({
          clients: state.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),

      deleteClient: (id) =>
        set((state) => ({
          clients: state.clients.filter((c) => c.id !== id),
        })),

      getFilteredClients: () => {
        const { clients, searchQuery, activeFilter } = get();
        let filtered = [...clients];

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.firstName.toLowerCase().includes(q) ||
              c.lastName.toLowerCase().includes(q) ||
              c.phone.includes(q) ||
              c.email?.toLowerCase().includes(q)
          );
        }

        switch (activeFilter) {
          case 'vip':
            filtered = filtered.filter((c) => c.vipLevel >= 2);
            break;
          case 'active':
            filtered = filtered.filter((c) => {
              if (!c.lastVisit) return false;
              const daysSince = (Date.now() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
              return daysSince <= 60;
            });
            break;
          case 'dormant':
            filtered = filtered.filter((c) => {
              if (!c.lastVisit) return true;
              const daysSince = (Date.now() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
              return daysSince > 60;
            });
            break;
          case 'new':
            filtered = filtered.filter((c) => {
              const daysSince = (Date.now() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24);
              return daysSince <= 30;
            });
            break;
        }

        return filtered.sort((a, b) => a.lastName.localeCompare(b.lastName));
      },
    }),
    {
      name: 'revo_clients',
      partialize: (state) => ({ clients: state.clients }),
    }
  )
);
