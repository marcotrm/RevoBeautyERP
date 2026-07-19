import { create } from 'zustand';
import { Product } from '@/types';
import {
  getProducts, createProduct, updateProduct as updateAction,
  deleteProduct as deleteAction, bulkCreateProducts, migrateProducts,
} from '@/app/actions/products';

interface ProductStore {
  products: Product[];
  isLoading: boolean;
  fetchProducts: () => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  importProducts: (items: Array<Omit<Product, 'id'>>) => Promise<number>;
}

async function migrateLocalIfNeeded() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('revo_products');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const list = parsed?.state?.products;
    if (Array.isArray(list) && list.length > 0) {
      await migrateProducts(list as Product[]);
    }
    window.localStorage.removeItem('revo_products');
  } catch { /* ignora */ }
}

export const useProductStore = create<ProductStore>((set) => ({
  products: [],
  isLoading: false,

  fetchProducts: async () => {
    set({ isLoading: true });
    try {
      await migrateLocalIfNeeded();
      const data = await getProducts();
      set({ products: data, isLoading: false });
    } catch (e) {
      console.error('Failed to fetch products', e);
      set({ isLoading: false });
    }
  },

  addProduct: async (product) => {
    try {
      const created = await createProduct(product);
      set((state) => ({ products: [...state.products, created] }));
    } catch (e) { console.error('Failed to add product', e); throw e; }
  },

  updateProduct: async (id, updates) => {
    try {
      const updated = await updateAction(id, updates);
      set((state) => ({ products: state.products.map(p => p.id === id ? updated : p) }));
    } catch (e) { console.error('Failed to update product', e); throw e; }
  },

  deleteProduct: async (id) => {
    try {
      await deleteAction(id);
      set((state) => ({ products: state.products.filter(p => p.id !== id) }));
    } catch (e) { console.error('Failed to delete product', e); throw e; }
  },

  importProducts: async (items) => {
    const created = await bulkCreateProducts(items);
    // Ricarica l'elenco completo per riflettere update di stock su prodotti esistenti
    const data = await getProducts();
    set({ products: data });
    return created.length;
  },
}));
