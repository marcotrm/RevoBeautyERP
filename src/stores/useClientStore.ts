'use client';

import { create } from 'zustand';
import { Client } from '@/types';
import { getClients, createClient, updateClient as updateClientAction, deleteClient as deleteClientAction } from '@/app/actions/clients';

interface ClientStore {
  clients: Client[];
  isLoading: boolean;
  searchQuery: string;
  activeFilter: string;
  selectedClient: Client | null;

  fetchClients: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: string) => void;
  selectClient: (client: Client | null) => void;

  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'totalSpent' | 'visitCount' | 'avgTicket' | 'loyaltyPoints' | 'cashback'>) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  getFilteredClients: () => Client[];
}

export const useClientStore = create<ClientStore>()((set, get) => ({
  clients: [],
  isLoading: false,
  searchQuery: '',
  activeFilter: 'all',
  selectedClient: null,

  fetchClients: async () => {
    set({ isLoading: true });
    try {
      const data = await getClients();
      set({ clients: data, isLoading: false });
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  selectClient: (client) => set({ selectedClient: client }),

  addClient: async (clientData) => {
    try {
      const newClient = await createClient(clientData);
      set((state) => ({ clients: [...state.clients, newClient] }));
    } catch (error) {
      console.error('Failed to add client', error);
      throw error;
    }
  },

  updateClient: async (id, updates) => {
    try {
      const updated = await updateClientAction(id, updates);
      set((state) => ({
        clients: state.clients.map((c) => (c.id === id ? updated : c)),
      }));
    } catch (error) {
      console.error('Failed to update client', error);
      throw error;
    }
  },

  deleteClient: async (id) => {
    try {
      await deleteClientAction(id);
      set((state) => ({
        clients: state.clients.filter((c) => c.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete client', error);
      throw error;
    }
  },

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
}));
