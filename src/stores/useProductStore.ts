import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '@/types';
import { mockProducts } from '@/lib/mock-data';

interface ProductStore {
  products: Product[];
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
}

export const useProductStore = create<ProductStore>()(
  persist(
    (set) => ({
      products: mockProducts,
      addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
      updateProduct: (id, updates) => set((state) => ({
        products: state.products.map(p => p.id === id ? { ...p, ...updates } : p)
      })),
      deleteProduct: (id) => set((state) => ({
        products: state.products.filter(p => p.id !== id)
      }))
    }),
    { name: 'revo_products' }
  )
);
