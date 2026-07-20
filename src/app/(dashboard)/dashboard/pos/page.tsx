'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePosStore, TransactionRecord } from '@/stores/usePosStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import {
  CreditCard, Receipt, Calculator,
  Banknote, ArrowRight, Plus, X, CheckCircle,
  Trash2, Search, Smartphone,
} from 'lucide-react';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { useClientStore } from '@/stores/useClientStore';
import { formatCurrency } from '@/lib/helpers';
import { usePackageStore } from '@/stores/usePackageStore';
import { usePriceListStore } from '@/stores/usePriceListStore';
import { useProductStore } from '@/stores/useProductStore';

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  type: 'service' | 'product';
}

const PAYMENT_METHODS = [
  { id: 'carta', label: 'Carta', icon: '💳' },
  { id: 'contanti', label: 'Contanti', icon: '💵' },
  { id: 'satispay', label: 'Satispay', icon: '📱' },
  { id: 'bonifico', label: 'Bonifico', icon: '🏦' },
  { id: 'buono', label: 'Buono Regalo', icon: '🎁' },
  { id: 'misto', label: 'Misto', icon: '⚖️' },
];

function NewSaleModal({ onClose, onComplete, initialData }: {
  onClose: () => void; onComplete: (tx: Omit<TransactionRecord, 'id'>, debtPkgId?: string) => void;
  initialData?: { client: string; treatmentName: string; treatmentId: string; price: number; operator: string; debtPkgId?: string; cabinMinutes?: number } | null;
}) {
  const treatments = useTreatmentStore(s => s.treatments);
  const products = useProductStore(s => s.products);
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (!initialData) return [];
    // Try find by ID first
    if (initialData.treatmentId) {
      const t = treatments.find(t => t.id === initialData.treatmentId);
      if (t) return [{ id: t.id, name: t.name, price: initialData.price !== undefined ? initialData.price : t.price, qty: 1, type: 'service' }];
    }
    // Try find by name
    if (initialData.treatmentName) {
      const t = treatments.find(t => t.name === initialData.treatmentName);
      if (t) return [{ id: t.id, name: t.name, price: initialData.price !== undefined ? initialData.price : t.price, qty: 1, type: 'service' }];
    }
    // Fallback: create custom entry from initialData
    if (initialData.treatmentName && initialData.price !== undefined) {
      return [{ id: `agenda-${Date.now()}`, name: initialData.treatmentName, price: initialData.price, qty: 1, type: 'service' }];
    }
    return [];
  });
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(initialData?.client || '');
  const [serviceSearch, setServiceSearch] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discount, setDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('carta');
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [step, setStep] = useState<'items' | 'payment' | 'done'>(initialData && initialData.client ? 'payment' : 'items');

  const allClients = useClientStore(s => s.clients);
  const packages = usePackageStore(s => s.packages);
  const { priceLists } = usePriceListStore();
  const filteredClients = clientSearch.trim()
    ? allClients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8)
    : [];

  // Auto-apply price list discount when client is selected
  useEffect(() => {
    if (selectedClient && !initialData?.debtPkgId) {
      const clientObj = allClients.find(c => `${c.firstName} ${c.lastName}` === selectedClient);
      if (clientObj?.priceListId) {
        const list = priceLists.find(pl => pl.id === clientObj.priceListId);
        if (list) {
          setDiscountType('percent');
          setDiscount(String(list.discountPercentage));
        } else {
          setDiscount('');
        }
      } else {
        setDiscount('');
      }
    }
  }, [selectedClient, allClients, priceLists, initialData?.debtPkgId]);

  // Merge treatments + packages into one searchable list
  const allSellableItems = useMemo(() => {
    const treatmentItems = treatments.filter(t => t.isActive).map(t => ({
      id: t.id, name: t.name, price: t.price, duration: t.duration, color: t.color, type: 'service' as const, isPackage: false,
    }));
    const packageItems = packages.map(p => ({
      id: p.id, name: `📦 ${p.name}`, price: p.price, duration: 0, color: p.color, type: 'service' as const, isPackage: true,
    }));
    const productItems = products.map(p => ({
      id: p.id, name: `🧴 ${p.name}`, price: p.price, duration: 0, color: '#F59E0B', type: 'product' as const, isPackage: false,
    }));
    return [...treatmentItems, ...packageItems, ...productItems];
  }, [packages, treatments, products]);

  const filteredServices = serviceSearch.trim()
    ? allSellableItems.filter(t => t.name.toLowerCase().includes(serviceSearch.toLowerCase())).slice(0, 10)
    : allSellableItems.slice(0, 10);

  const addToCart = (t: typeof allSellableItems[0]) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === t.id);
      if (existing) return prev.map(i => i.id === t.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: t.id, name: t.name, price: t.price, qty: 1, type: t.type }];
    });
    setServiceSearch('');
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));
  const updateQty = (id: string, delta: number) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountValue = Number(discount) || 0;
  const discountAmount = discountType === 'percent' ? (subtotal * discountValue) / 100 : discountValue;
  const rawTotal = Math.max(0, subtotal - discountAmount);
  // Sempre per eccesso se c'è sconto percentuale, altrimenti preciso
  const total = (discountType === 'percent' && discountValue > 0) ? Math.ceil(rawTotal) : rawTotal;
  
  const isDebtPayment = !!initialData?.debtPkgId;
  const finalTotal = isDebtPayment ? (customAmount ? Number(customAmount) : 0) : total;
  const isMistoValid = paymentMethod === 'misto' ? Math.abs((Number(splitCash) + Number(splitCard)) - finalTotal) < 0.01 : true;
  const canComplete = (isDebtPayment ? finalTotal > 0 : cart.length > 0) && isMistoValid;

  const handleSplitCashChange = (val: string) => {
    setSplitCash(val);
    const num = Number(val);
    if (!isNaN(num) && finalTotal > 0) {
      setSplitCard(Math.max(0, finalTotal - num).toFixed(2));
    }
  };

  const handleSplitCardChange = (val: string) => {
    setSplitCard(val);
    const num = Number(val);
    if (!isNaN(num) && finalTotal > 0) {
      setSplitCash(Math.max(0, finalTotal - num).toFixed(2));
    }
  };

  const handleComplete = () => {
    if (!canComplete) return;
    const now = new Date();
    const finalMethod = paymentMethod === 'misto' 
      ? `Misto (Contanti: €${splitCash}, Carta: €${splitCard})` 
      : PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label || 'Carta';

    onComplete({
      client: selectedClient || 'Cliente Occasionale',
      items: cart.map(i => i.name).join(', '),
      total: finalTotal,
      method: finalMethod,
      time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      operator: initialData?.operator || 'Staff',
      // Solo i prodotti (non trattamenti/pacchetti) scaricano il magazzino
      productLines: cart.filter(i => i.type === 'product').map(i => ({ productId: i.id, qty: i.qty })),
      cabinMinutes: initialData?.cabinMinutes,
    }, initialData?.debtPkgId);
    setStep('done');
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center sm:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-display font-semibold text-text-primary">{isDebtPayment ? 'Incasso' : 'Nuova Vendita'}</h3>
              <div className="flex gap-1">
                <button onClick={() => setStep('items')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${step === 'items' ? 'bg-accent/15 text-accent' : 'text-text-muted'}`}>1. Articoli</button>
                <button onClick={() => setStep('payment')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${step === 'payment' ? 'bg-accent/15 text-accent' : 'text-text-muted'}`}>2. Pagamento</button>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {step === 'items' ? (
              <div className="p-6 space-y-4">
                {/* Client Search */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Cliente (Opzionale)</label>
                  {selectedClient ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent/10 border border-accent/20">
                      <span className="text-sm font-medium text-accent flex-1">{selectedClient}</span>
                      <button onClick={() => { setSelectedClient(''); setClientSearch(''); }} className="text-accent/60 hover:text-accent"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Cerca cliente..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                      {filteredClients.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-bg-secondary border border-border rounded-xl shadow-xl z-10 overflow-hidden">
                          {filteredClients.map(c => (
                            <button key={c.id} onClick={() => { setSelectedClient(`${c.firstName} ${c.lastName}`); setClientSearch(''); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-bg-hover text-sm text-text-primary transition-colors">{c.firstName} {c.lastName} <span className="text-text-muted">• {c.phone}</span></button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Services */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Aggiungi Servizi / Prodotti</label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input type="text" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} placeholder="Cerca trattamento..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto">
                    {filteredServices.map(t => (
                      <button key={t.id} onClick={() => addToCart(t)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-tertiary border border-border hover:border-accent/30 text-left transition-all group">
                        <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">{t.name}</p>
                          <p className="text-[10px] text-text-muted">{(t as any).duration > 0 ? `${(t as any).duration}min` : 'Pacchetto/Prodotto'}</p>
                        </div>
                        <span className="text-xs font-bold text-accent">{formatCurrency(t.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cart */}
                {cart.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Carrello ({cart.length})</label>
                    <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/30">
                      {cart.map(item => (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-text-primary">{item.name}</p></div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover text-xs font-bold">−</button>
                            <span className="w-6 text-center text-sm font-medium text-text-primary">{item.qty}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover text-xs font-bold">+</button>
                          </div>
                          <span className="text-sm font-semibold text-text-primary w-16 text-right">{formatCurrency(item.price * item.qty)}</span>
                          <button onClick={() => removeFromCart(item.id)} className="p-1 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : step === 'payment' ? (
              <div className="p-6 space-y-4">
                {/* Summary */}
                <div className="rounded-xl border border-border p-4 space-y-2">
                  {isDebtPayment ? (
                    <>
                      <div className="flex justify-between text-sm"><span className="text-text-secondary">Debito Rimanente Attuale</span><span className="text-text-primary font-medium">{formatCurrency(subtotal)}</span></div>
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-text-secondary">Importo da incassare ora</span>
                        <div className="relative">
                          <input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)} placeholder="0" className="w-24 pl-2 pr-6 py-1.5 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary text-right focus:outline-none focus:border-accent/50" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
                        </div>
                      </div>

                      {customAmount && Number(customAmount) > 0 && (
                        <div className="flex justify-between text-sm mt-3 pt-3 border-t border-border/30">
                          <span className="text-warning font-medium">Nuovo Debito Rimanente</span>
                          <span className="text-warning font-bold">{formatCurrency(Math.max(0, subtotal - Number(customAmount)))}</span>
                        </div>
                      )}

                      <div className="border-t border-border mt-3 pt-3 flex justify-between"><span className="text-base font-semibold text-text-primary">Totale da Incassare</span><span className="text-xl font-display font-bold text-accent">{formatCurrency(finalTotal)}</span></div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm"><span className="text-text-secondary">Subtotale</span><span className="text-text-primary font-medium">{formatCurrency(subtotal)}</span></div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">Sconto</span>
                        <div className="flex items-center gap-2">
                          <div className="flex bg-bg-tertiary p-1 rounded-lg border border-border">
                            <button onClick={() => setDiscountType('percent')} className={`px-2 py-0.5 rounded text-xs font-medium ${discountType === 'percent' ? 'bg-bg-secondary shadow-sm text-text-primary' : 'text-text-muted'}`}>%</button>
                            <button onClick={() => setDiscountType('fixed')} className={`px-2 py-0.5 rounded text-xs font-medium ${discountType === 'fixed' ? 'bg-bg-secondary shadow-sm text-text-primary' : 'text-text-muted'}`}>€</button>
                          </div>
                          <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" className="w-20 px-2 py-1 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary text-right focus:outline-none focus:border-accent/50" />
                        </div>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between"><span className="text-base font-semibold text-text-primary">Totale</span><span className="text-xl font-display font-bold text-accent">{formatCurrency(finalTotal)}</span></div>
                    </>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Metodo di Pagamento</label>
                  <div className="grid grid-cols-2 gap-3">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${paymentMethod === m.id ? 'border-accent bg-accent/5' : 'border-border hover:border-border-light'}`}>
                        <span className="text-2xl">{m.icon}</span>
                        <span className={`text-sm font-medium ${paymentMethod === m.id ? 'text-accent' : 'text-text-primary'}`}>{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {paymentMethod === 'misto' && (
                    <div className="mt-4 p-4 rounded-xl bg-bg-tertiary/50 border border-border space-y-3">
                      <p className="text-sm font-medium text-text-primary mb-2">Dividi Importo (Totale: {formatCurrency(finalTotal)})</p>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs text-text-secondary mb-1">Contanti</label>
                          <div className="relative">
                            <input type="number" step="0.01" value={splitCash} onChange={e => handleSplitCashChange(e.target.value)} placeholder="0.00" className="w-full pl-2 pr-6 py-2 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary text-right focus:outline-none focus:border-accent/50" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-text-secondary mb-1">Carta / POS</label>
                          <div className="relative">
                            <input type="number" step="0.01" value={splitCard} onChange={e => handleSplitCardChange(e.target.value)} placeholder="0.00" className="w-full pl-2 pr-6 py-2 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary text-right focus:outline-none focus:border-accent/50" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
                          </div>
                        </div>
                      </div>
                      {Math.abs((Number(splitCash) + Number(splitCard)) - finalTotal) > 0.01 && (
                        <p className="text-xs text-error font-medium">La somma deve essere uguale a {formatCurrency(finalTotal)} (Attuale: {formatCurrency(Number(splitCash) + Number(splitCard))})</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Client + Items Summary */}
                <div className="rounded-xl bg-bg-tertiary/50 p-3 space-y-1">
                  <p className="text-xs text-text-muted">Cliente: <span className="text-text-primary font-medium">{selectedClient || 'Cliente Occasionale'}</span></p>
                  <p className="text-xs text-text-muted">Articoli: <span className="text-text-primary font-medium">{cart.map(i => i.name).join(', ') || '—'}</span></p>
                </div>
              </div>
            ) : (
              /* Done / Success */
              <div className="p-8 flex flex-col items-center justify-center text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15, stiffness: 400 }}
                  className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-success" />
                </motion.div>
                <h3 className="text-xl font-display font-bold text-text-primary mb-1">Pagamento Completato!</h3>
                <p className="text-2xl font-display font-bold text-accent mb-2">{formatCurrency(finalTotal)}</p>
                <div className="space-y-1 mb-4">
                  <p className="text-sm text-text-secondary">{selectedClient}</p>
                  <p className="text-xs text-text-muted">{cart.map(i => i.name).join(', ')}</p>
                  <p className="text-xs text-text-muted">{PAYMENT_METHODS.find(m => m.id === paymentMethod)?.icon} {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-bg-tertiary/30 flex-shrink-0">
            {step === 'items' ? (
              <>
                <div><span className="text-sm text-text-secondary">Totale: </span><span className="text-lg font-display font-bold text-text-primary">{formatCurrency(subtotal)}</span></div>
                <button onClick={() => setStep('payment')} disabled={cart.length === 0}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${cart.length > 0 ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
                  Vai al Pagamento <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : step === 'payment' ? (
              <>
                <button onClick={() => setStep('items')} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">← Indietro</button>
                <button onClick={handleComplete} disabled={!canComplete}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canComplete ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
                  <CheckCircle className="w-4 h-4" /> Incassa {formatCurrency(finalTotal)}
                </button>
              </>
            ) : (
              <button onClick={onClose} className="w-full py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all">
                ✓ Chiudi
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

function POSPageInner() {
  const { addPayment } = usePackageStore();
  const { products } = useProductStore();
  const { transactions, fetchTransactions, addTransaction, removeTransaction } = usePosStore();
  const fetchClients = useClientStore(s => s.fetchClients);
  const fetchTreatments = useTreatmentStore(s => s.fetchTreatments);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleInitialData, setSaleInitialData] = useState<{ client: string; treatmentName: string; treatmentId: string; price: number; operator: string; debtPkgId?: string; cabinMinutes?: number } | null>(null);
  const [showCloseCassa, setShowCloseCassa] = useState(false);
  const [showLastReceipt, setShowLastReceipt] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const autoOpenedRef = useRef(false);
  const todayTotal = transactions.reduce((s, t) => s + t.total, 0);

  useEffect(() => {
    fetchTransactions();
    fetchClients();
    fetchTreatments();
  }, [fetchTransactions, fetchClients, fetchTreatments]);

  // Auto-open from agenda — una sola volta per caricamento pagina
  useEffect(() => {
    if (autoOpenedRef.current) return;
    const client = searchParams.get('client');
    const treatment = searchParams.get('treatment');
    const treatmentId = searchParams.get('treatmentId');
    const price = searchParams.get('price');
    const operator = searchParams.get('operator');
    const debtPkgId = searchParams.get('debtPkgId');
    const cabinMinutes = searchParams.get('cabinMinutes');
    if (client && treatment) {
      autoOpenedRef.current = true;
      setSaleInitialData({
        client, treatmentName: treatment, treatmentId: treatmentId || '',
        price: Number(price) || 0, operator: operator || 'Staff',
        debtPkgId: debtPkgId || undefined,
        cabinMinutes: cabinMinutes ? Number(cabinMinutes) : undefined,
      });
      setShowSaleModal(true);
      // Pulisco l'URL: così un refresh non riapre il popup di pagamento
      router.replace('/dashboard/pos');
    }
  }, [searchParams, router]);

  const handleNewSale = async (tx: Omit<TransactionRecord, 'id'>, debtPkgId?: string) => {
    const created = await addTransaction(tx);
    if (debtPkgId) {
      addPayment(debtPkgId, created.total, created.method as any, created.operator, 'Pagamento da Cassa');
    }
  };

  const handleRefund = async (txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    await addTransaction({
      client: tx.client,
      items: `RIMBORSO: ${tx.items}`,
      total: -tx.total,
      method: tx.method,
      time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
      operator: tx.operator,
    });
    setShowRefund(false);
  };

  const cashCount = transactions.filter(t => t.method === 'Contanti' && t.total > 0).reduce((s, t) => s + t.total, 0);
  const cardCount = transactions.filter(t => t.method === 'Carta' && t.total > 0).reduce((s, t) => s + t.total, 0);
  const satispayCount = transactions.filter(t => t.method === 'Satispay' && t.total > 0).reduce((s, t) => s + t.total, 0);
  const bonificoCount = transactions.filter(t => t.method === 'Bonifico' && t.total > 0).reduce((s, t) => s + t.total, 0);
  const refundsTotal = transactions.filter(t => t.total < 0).reduce((s, t) => s + t.total, 0);
  const lastTx = transactions.length > 0 ? transactions[0] : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Punto Cassa</h2>
          <p className="text-sm text-text-secondary">Gestisci vendite e pagamenti</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/dashboard-mobile" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bg-secondary border border-border text-text-primary text-sm font-medium hover:bg-bg-hover transition-all" title="Vedi i dati dal cellulare">
            <Smartphone className="w-4 h-4" /><span className="hidden sm:inline">Versione mobile</span>
          </a>
          <button onClick={() => { setSaleInitialData(null); setShowSaleModal(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all hover:scale-105">
            <Plus className="w-4 h-4" /> Nuova Vendita
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Nuova Vendita', icon: Plus, color: '#A855F7', action: () => { setSaleInitialData(null); setShowSaleModal(true); } },
          { label: 'Chiudi Cassa', icon: Calculator, color: '#F59E0B', action: () => setShowCloseCassa(true) },
          { label: 'Ultimo Scontrino', icon: Receipt, color: '#3B82F6', action: () => setShowLastReceipt(true) },
          { label: 'Rimborso', icon: Banknote, color: '#EF4444', action: () => setShowRefund(true) },
        ].map((qa) => {
          const Icon = qa.icon;
          return (
            <button key={qa.label} onClick={qa.action} className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-bg-secondary border border-border hover:border-border-light transition-all group cursor-pointer">
              <div className="p-3 rounded-xl transition-colors" style={{ backgroundColor: `${qa.color}15`, color: qa.color }}><Icon className="w-6 h-6" /></div>
              <span className="text-sm font-medium text-text-primary">{qa.label}</span>
            </button>
          );
        })}
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Incasso Oggi</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(todayTotal)}</p><p className="text-xs text-text-muted mt-1">{transactions.filter(t => t.total > 0).length} vendite</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Transazioni</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{transactions.length}</p><p className="text-xs text-text-muted mt-1">oggi</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Scontrino Medio</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(Math.round(todayTotal / Math.max(transactions.filter(t => t.total > 0).length, 1)))}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Cassa Aperta</p><p className="text-2xl font-display font-bold text-accent mt-1">Attiva</p><p className="text-xs text-text-muted mt-1">dalle 08:55</p></div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-display font-semibold text-text-primary">Ultime Transazioni</h3>
        </div>
        <div className="divide-y divide-border/30">
          {transactions.map(tx => (
            <div key={tx.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-bg-hover transition-colors group ${tx.total < 0 ? 'bg-error/[0.03]' : ''}`}>
              <div className={`p-2 rounded-lg ${tx.total < 0 ? 'bg-error/10 text-error' : 'bg-accent/10 text-accent'}`}>
                {tx.total < 0 ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-text-primary">{tx.client}</p><p className="text-xs text-text-secondary truncate">{tx.items}</p></div>
              <div className="hidden sm:block text-right"><p className="text-xs text-text-muted">{tx.operator}</p></div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${tx.total < 0 ? 'text-error' : 'text-text-primary'}`}>{tx.total < 0 ? '-' : ''}{formatCurrency(Math.abs(tx.total))}</p>
                <p className="text-[11px] text-text-muted">{tx.method} • {tx.time}</p>
              </div>
              <button onClick={() => { if (window.confirm(`Eliminare questa transazione di ${formatCurrency(Math.abs(tx.total))} (${tx.client})? L'incasso verrà ricalcolato.`)) removeTransaction(tx.id); }}
                title="Elimina transazione"
                className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="text-center py-10"><p className="text-text-muted">Nessuna transazione</p></div>
          )}
        </div>
      </div>

      {/* MODALS */}
      <AnimatePresence>{showSaleModal && <NewSaleModal onClose={() => { setShowSaleModal(false); setSaleInitialData(null); }} onComplete={handleNewSale} initialData={saleInitialData} />}</AnimatePresence>

      {/* Chiudi Cassa Modal */}
      <AnimatePresence>{showCloseCassa && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowCloseCassa(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowCloseCassa(false)}>
            <div className="w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-lg font-display font-semibold text-text-primary">Chiusura Cassa</h3>
                <button onClick={() => setShowCloseCassa(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="text-center p-4 rounded-xl bg-accent/5 border border-accent/20">
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Incasso Totale Giornata</p>
                  <p className="text-3xl font-display font-bold text-accent">{formatCurrency(todayTotal)}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between px-3 py-2 rounded-lg bg-bg-tertiary/50"><span className="text-sm text-text-secondary">💳 Carta</span><span className="text-sm font-semibold text-text-primary">{formatCurrency(cardCount)}</span></div>
                  <div className="flex justify-between px-3 py-2 rounded-lg bg-bg-tertiary/50"><span className="text-sm text-text-secondary">💵 Contanti</span><span className="text-sm font-semibold text-text-primary">{formatCurrency(cashCount)}</span></div>
                  <div className="flex justify-between px-3 py-2 rounded-lg bg-bg-tertiary/50"><span className="text-sm text-text-secondary">📱 Satispay</span><span className="text-sm font-semibold text-text-primary">{formatCurrency(satispayCount)}</span></div>
                  <div className="flex justify-between px-3 py-2 rounded-lg bg-bg-tertiary/50"><span className="text-sm text-text-secondary">🏦 Bonifico</span><span className="text-sm font-semibold text-text-primary">{formatCurrency(bonificoCount)}</span></div>
                  {refundsTotal < 0 && <div className="flex justify-between px-3 py-2 rounded-lg bg-error/5"><span className="text-sm text-error">↩️ Rimborsi</span><span className="text-sm font-semibold text-error">{formatCurrency(refundsTotal)}</span></div>}
                </div>
                <div className="flex justify-between px-3 py-3 rounded-xl border border-border">
                  <span className="text-sm font-semibold text-text-primary">Transazioni totali</span>
                  <span className="text-sm font-bold text-accent">{transactions.length}</span>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30">
                <button onClick={() => setShowCloseCassa(false)} className="w-full py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all">
                  ✓ Conferma Chiusura Cassa
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}</AnimatePresence>

      {/* Ultimo Scontrino Modal */}
      <AnimatePresence>{showLastReceipt && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowLastReceipt(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowLastReceipt(false)}>
            <div className="w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-lg font-display font-semibold text-text-primary">Ultimo Scontrino</h3>
                <button onClick={() => setShowLastReceipt(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
              </div>
              {lastTx ? (
                <div className="px-6 py-5 space-y-4">
                  <div className="text-center">
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Revo Beauty</p>
                    <div className="w-16 h-0.5 bg-border mx-auto my-2" />
                  </div>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="flex justify-between"><span className="text-text-secondary">Cliente:</span><span className="text-text-primary font-medium">{lastTx.client}</span></div>
                    <div className="flex justify-between"><span className="text-text-secondary">Articoli:</span><span className="text-text-primary font-medium text-right max-w-[60%]">{lastTx.items}</span></div>
                    <div className="flex justify-between"><span className="text-text-secondary">Operatore:</span><span className="text-text-primary">{lastTx.operator}</span></div>
                    <div className="flex justify-between"><span className="text-text-secondary">Ora:</span><span className="text-text-primary">{lastTx.time}</span></div>
                    <div className="flex justify-between"><span className="text-text-secondary">Metodo:</span><span className="text-text-primary">{lastTx.method}</span></div>
                    <div className="border-t border-dashed border-border pt-2 flex justify-between">
                      <span className="text-base font-bold text-text-primary">TOTALE</span>
                      <span className="text-xl font-display font-bold text-accent">{formatCurrency(lastTx.total)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-10 text-center"><p className="text-text-muted">Nessuna transazione registrata</p></div>
              )}
              <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30">
                <button onClick={() => setShowLastReceipt(false)} className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Chiudi</button>
              </div>
            </div>
          </motion.div>
        </>
      )}</AnimatePresence>

      {/* Rimborso Modal */}
      <AnimatePresence>{showRefund && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowRefund(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowRefund(false)}>
            <div className="w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-lg font-display font-semibold text-text-primary">Emetti Rimborso</h3>
                <button onClick={() => setShowRefund(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
              </div>
              <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
                <p className="text-xs text-text-muted mb-3">Seleziona la transazione da rimborsare:</p>
                <div className="space-y-2">
                  {transactions.filter(t => t.total > 0).map(tx => (
                    <button key={tx.id} onClick={() => handleRefund(tx.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-error/30 hover:bg-error/[0.03] transition-all text-left">
                      <div className="p-2 rounded-lg bg-error/10 text-error"><Banknote className="w-4 h-4" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{tx.client}</p>
                        <p className="text-xs text-text-muted truncate">{tx.items}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-error">-{formatCurrency(tx.total)}</p>
                        <p className="text-[10px] text-text-muted">{tx.time}</p>
                      </div>
                    </button>
                  ))}
                  {transactions.filter(t => t.total > 0).length === 0 && (
                    <p className="text-sm text-text-muted text-center py-4">Nessuna transazione da rimborsare</p>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30">
                <button onClick={() => setShowRefund(false)} className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
              </div>
            </div>
          </motion.div>
        </>
      )}</AnimatePresence>
    </motion.div>
  );
}

export default function POSPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-text-muted">Caricamento POS...</div>}>
      <POSPageInner />
    </Suspense>
  );
}
