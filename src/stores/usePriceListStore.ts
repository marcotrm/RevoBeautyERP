'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PriceList } from '@/types';

interface PriceListStore {
  priceLists: PriceList[];
  
  addPriceList: (priceList: Omit<PriceList, 'id'>) => void;
  updatePriceList: (id: string, updates: Partial<PriceList>) => void;
  deletePriceList: (id: string) => void;
}

const defaultPriceLists: PriceList[] = [
  { id: 'pl-1', name: 'Silver', discountPercentage: 5, isActive: true },
  { id: 'pl-2', name: 'Gold', discountPercentage: 10, isActive: true },
  { id: 'pl-3', name: 'VIP', discountPercentage: 20, isActive: true },
];

export const usePriceListStore = create<PriceListStore>()(
  persist(
    (set) => ({
      priceLists: defaultPriceLists,

      addPriceList: (data) =>
        set((state) => ({
          priceLists: [
            ...state.priceLists,
            {
              ...data,
              id: `pl-${Date.now()}`,
            },
          ],
        })),

      updatePriceList: (id, updates) =>
        set((state) => ({
          priceLists: state.priceLists.map((pl) =>
            pl.id === id ? { ...pl, ...updates } : pl
          ),
        })),

      deletePriceList: (id) =>
        set((state) => ({
          priceLists: state.priceLists.filter((pl) => pl.id !== id),
        })),
    }),
    {
      name: 'revo_pricelists',
    }
  )
);
