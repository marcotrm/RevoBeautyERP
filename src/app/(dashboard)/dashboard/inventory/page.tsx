'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Plus, Search, Trash2, X, CheckCircle, Package,
} from 'lucide-react';
import { useProductStore } from '@/stores/useProductStore';
import { formatCurrency, generateId } from '@/lib/helpers';
import { Product } from '@/types';

const categories = ['Tutti', 'Viso', 'Corpo', 'Laser', 'Unghie', 'Capelli'];

function AddProductModal({ onClose, onSave }: { onClose: () => void; onSave: (p: Product) => void }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Viso');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('5');

  const canSave = name.trim() && price && stock;
  const margin = price && costPrice ? Math.round(((Number(price) - Number(costPrice)) / Number(price)) * 100) : null;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: generateId(),
      name: name.trim(),
      brand: brand.trim() || 'Generico',
      category,
      barcode: barcode.trim(),
      sku: sku.trim() || `SKU-${Date.now().toString(36).toUpperCase()}`,
      price: Number(price),
      costPrice: Number(costPrice) || 0,
      stock: Number(stock),
      minStock: Number(minStock) || 5,
      locationId: 'loc-1',
      isActive: true,
    });
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-lg bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-lg font-display font-semibold text-text-primary">Aggiungi Prodotto</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Nome Prodotto *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Es. Crema Idratante..."
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Brand</label>
                <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Es. Dermalogica..."
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Categoria</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                  {categories.filter(c => c !== 'Tutti').map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Codice a Barre</label>
                <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scannerizza..."
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">SKU</label>
                <input type="text" value={sku} onChange={e => setSku(e.target.value)} placeholder="Auto-generato"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Prezzo Vendita (€) *</label>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Costo Acquisto (€)</label>
                <input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            {margin !== null && margin > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/5 border border-success/10">
                <span className="text-xs text-success font-medium">Margine: {margin}% ({formatCurrency(Number(price) - Number(costPrice))} per unità)</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Quantità in Stock *</label>
                <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Scorta Minima</label>
                <input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} placeholder="5"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
            <button onClick={handleSave} disabled={!canSave}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canSave ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
              <CheckCircle className="w-4 h-4" /> Aggiungi
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

export default function InventoryPage() {
  const { products, addProduct, deleteProduct } = useProductStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tutti');

  const filtered = useMemo(() => {
    let list = [...products];
    if (activeCategory !== 'Tutti') list = list.filter(p => p.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)));
    }
    return list;
  }, [products, search, activeCategory]);

  const lowStock = products.filter(p => p.stock <= p.minStock).length;
  const totalValue = products.reduce((s, p) => s + p.costPrice * p.stock, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Magazzino</h2>
          <p className="text-sm text-text-secondary">Inventario, scorte e fornitori</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all hover:scale-105">
          <Plus className="w-4 h-4" /> Aggiungi Prodotto
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Prodotti Totali</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{products.length}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Valore Magazzino</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(totalValue)}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /><p className="text-sm text-text-secondary">Sotto Scorta</p></div>
          <p className="text-2xl font-display font-bold text-warning mt-1">{lowStock}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Categorie</p><p className="text-2xl font-display font-bold text-accent mt-1">{new Set(products.map(p => p.category)).size}</p></div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca prodotto, SKU, barcode, brand..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all" />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === cat ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-transparent'
              }`}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Prodotto</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Codici (SKU/Barcode)</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Prezzo</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Costo</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Stock</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Stato</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map(product => {
                const isLow = product.stock <= product.minStock;
                return (
                  <tr key={product.id} className="hover:bg-bg-hover transition-colors group">
                    <td className="px-5 py-3.5"><div><p className="text-sm font-medium text-text-primary">{product.name}</p><p className="text-xs text-text-muted">{product.brand} • {product.category}</p></div></td>
                    <td className="px-5 py-3.5 hidden md:table-cell"><span className="text-xs text-text-secondary font-mono">{product.sku}</span>{product.barcode && <p className="text-[10px] text-text-muted font-mono">{product.barcode}</p>}</td>
                    <td className="px-5 py-3.5 text-right"><span className="text-sm font-medium text-text-primary">{formatCurrency(product.price)}</span></td>
                    <td className="px-5 py-3.5 text-right"><span className="text-sm text-text-secondary">{formatCurrency(product.costPrice)}</span></td>
                    <td className="px-5 py-3.5 text-center"><span className={`text-sm font-semibold ${isLow ? 'text-error' : 'text-text-primary'}`}>{product.stock}</span></td>
                    <td className="px-5 py-3.5 text-center hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${isLow ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                        {isLow ? '⚠ Sotto Scorta' : '✓ In Stock'}
                      </span>
                    </td>
                    <td className="px-2 py-3.5">
                      <button onClick={() => { if(window.confirm('Eliminare prodotto?')) deleteProduct(product.id); }} className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-text-muted mx-auto mb-2" />
              <p className="text-text-secondary font-medium">Nessun prodotto trovato</p>
              <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-accent font-medium hover:underline">Aggiungi il primo prodotto</button>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border bg-bg-tertiary/30">
          <p className="text-xs text-text-muted">{filtered.length} prodotti su {products.length} totali</p>
        </div>
      </div>

      <AnimatePresence>{showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} onSave={(p) => { addProduct(p); setShowAddModal(false); }} />}</AnimatePresence>
    </motion.div>
  );
}
