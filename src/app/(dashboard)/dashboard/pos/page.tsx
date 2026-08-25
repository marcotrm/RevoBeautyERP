'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import SegniCliente from '@/components/SegniCliente';
import { usePosStore, TransactionRecord } from '@/stores/usePosStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import {
  CreditCard, Receipt, Calculator,
  Banknote, ArrowRight, Plus, X, CheckCircle,
  Trash2, Search, Smartphone, Lock, Vault, ArrowDownToLine, Printer, Gift, AlertCircle,
} from 'lucide-react';
import { getCassaforte, closeCassa, withdrawCassa, CassaMovementRecord } from '@/app/actions/cassaforte';
import { getTransactionsByRange } from '@/app/actions/pos';
import { printThermalReceipt, primeVatRate } from '@/lib/printReceipt';
import { buonoDiCliente, usaBuono } from '@/app/actions/buoni';
import type { BuonoCompleanno } from '@/lib/buonoCompleanno';
import IncomeSummary from './IncomeSummary';
import CassaTabs from '@/components/CassaTabs';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { useClientStore } from '@/stores/useClientStore';
import { formatCurrency } from '@/lib/helpers';
import { usePackageStore } from '@/stores/usePackageStore';
import { usePriceListStore } from '@/stores/usePriceListStore';
import { useProductStore } from '@/stores/useProductStore';
import { NO_AUTOFILL } from '@/lib/noAutofill';

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
  onClose: () => void; onComplete: (tx: Omit<TransactionRecord, 'id'>, debtPkgId?: string) => Promise<TransactionRecord | undefined>;
  initialData?: {
    client: string; treatmentName: string; treatmentId: string; price: number; operator: string;
    debtPkgId?: string; cabinMinutes?: number; appointmentId?: string;
    products?: { id: string; name: string; price: number; qty: number }[];
    /** Le righe vere della seduta: una per trattamento, col suo prezzo. */
    servizi?: { id: string; name: string; price: number; qty: number }[];
    /** Lo sconto già concordato in agenda, da mostrare come sconto e non nascosto nei prezzi. */
    sconto?: number;
  } | null;
}) {
  const treatments = useTreatmentStore(s => s.treatments);
  const products = useProductStore(s => s.products);
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (!initialData) return [];
    const base: CartItem[] = [];

    /*
      Dall'agenda arriva una riga per trattamento. Prima arrivava un nome solo
      col totale dentro: la cliente che aveva fatto ceretta, manicure e altre
      tre cose risultava con "Ceretta Gamba Intera 90 €", e quella riga finiva
      sullo scontrino e nell'avviso su Telegram.
    */
    if (initialData.servizi?.length) {
      for (const sv of initialData.servizi) {
        if (!sv?.name) continue;
        base.push({
          id: sv.id || `agenda-${sv.name}`,
          name: sv.name,
          price: Number(sv.price) || 0,
          qty: Number(sv.qty) || 1,
          type: 'service',
        });
      }
      for (const p of initialData.products || []) {
        if (p?.id) base.push({ id: p.id, name: `🧴 ${p.name}`, price: Number(p.price) || 0, qty: Number(p.qty) || 1, type: 'product' });
      }
      return base;
    }

    // Try find by ID first
    const t = (initialData.treatmentId && treatments.find(x => x.id === initialData.treatmentId))
      || (initialData.treatmentName && treatments.find(x => x.name === initialData.treatmentName))
      || null;
    if (t) {
      base.push({ id: t.id, name: t.name, price: initialData.price !== undefined ? initialData.price : t.price, qty: 1, type: 'service' });
    } else if (initialData.treatmentName && initialData.price !== undefined) {
      // Fallback: create custom entry from initialData
      base.push({ id: `agenda-${Date.now()}`, name: initialData.treatmentName, price: initialData.price, qty: 1, type: 'service' });
    }
    // I prodotti del carrello della seduta arrivano come vere righe di
    // magazzino: al salvataggio finiscono in productLines e scalano la giacenza.
    for (const p of initialData.products || []) {
      if (p?.id) base.push({ id: p.id, name: `🧴 ${p.name}`, price: Number(p.price) || 0, qty: Number(p.qty) || 1, type: 'product' });
    }
    return base;
  });
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(initialData?.client || '');
  const [serviceSearch, setServiceSearch] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(initialData?.sconto ? 'fixed' : 'percent');
  const [discount, setDiscount] = useState(initialData?.sconto ? String(initialData.sconto) : '');
  const [paymentMethod, setPaymentMethod] = useState('carta');
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [step, setStep] = useState<'items' | 'payment' | 'done'>(initialData && initialData.client ? 'payment' : 'items');
  const [saving, setSaving] = useState(false);
  const [cashGiven, setCashGiven] = useState('');
  // Transazione salvata a incasso concluso: porta con sé l'esito dello scontrino fiscale C95
  // (progressivo e idtrx), che finiscono sul tagliando stampato.
  const [savedTx, setSavedTx] = useState<TransactionRecord | null>(null);
  /*
    Il regalo di compleanno della cliente, se ne ha uno da spendere.

    Lo sconto lo mette il gestionale, non la ragazza al banco: il messaggio
    l'ha promesso settimane fa e nessuno può ricordarselo a memoria cliente per
    cliente. Si chiude solo a incasso avvenuto — se la vendita non si conclude
    il buono resta buono.
  */
  const [buono, setBuono] = useState<BuonoCompleanno | null>(null);
  /** Quanto è stato scalato davvero: serve a dirlo nella schermata finale, dove il buono ormai è chiuso. */
  const [buonoScalato, setBuonoScalato] = useState<number | null>(null);

  const allClients = useClientStore(s => s.clients);
  const packages = usePackageStore(s => s.packages);
  const { priceLists } = usePriceListStore();
  const filteredClients = clientSearch.trim()
    ? allClients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8)
    : [];

  /*
    Il buono compleanno si carica appena si sa chi è la cliente, e si applica
    da solo. Se il listino personale le fa uno sconto più grosso vince quello:
    fra i due regali si dà il migliore, non l'ultimo arrivato.
  */
  const clienteScelto = useMemo(
    () => allClients.find(c => `${c.firstName} ${c.lastName}` === selectedClient) || null,
    [allClients, selectedClient],
  );

  useEffect(() => {
    let vivo = true;
    // Si chiede sempre, anche senza cliente: la risposta è null e lo stato si
    // azzera lì, senza toccarlo mentre il componente si sta disegnando.
    const id = initialData?.debtPkgId ? null : clienteScelto?.id;
    buonoDiCliente(id).then(b => {
      if (!vivo) return;
      setBuono(b);
      if (!b) return;
      setDiscountType(prevTipo => {
        // Uno sconto in euro già concordato in agenda non si tocca: è un patto
        // fatto con la cliente, non un automatismo.
        if (prevTipo === 'fixed') return prevTipo;
        setDiscount(prev => (Number(prev) || 0) >= b.percento ? prev : String(b.percento));
        return prevTipo;
      });
    }).catch(() => {});
    return () => { vivo = false; };
  }, [clienteScelto?.id, initialData?.debtPkgId]);

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
    /*
      I prodotti si cercano anche per codice a barre e per codice interno.

      Al banco il lettore non scrive il nome: spara le cifre del codice a
      barre e va a capo. Cercando solo per nome non trovava mai niente, e la
      crema finiva battuta a mano — o non battuta affatto, col magazzino che
      resta pieno di roba già venduta.
    */
    const productItems = products.map(p => ({
      id: p.id, name: `🧴 ${p.name}`, price: p.price, duration: 0, color: '#F59E0B', type: 'product' as const, isPackage: false,
      barcode: (p.barcode || '').trim(),
      cerca: `${p.name} ${p.barcode || ''} ${p.sku || ''}`.toLowerCase(),
    }));
    return [
      ...treatmentItems.map(t => ({ ...t, barcode: '', cerca: t.name.toLowerCase() })),
      ...packageItems.map(t => ({ ...t, barcode: '', cerca: t.name.toLowerCase() })),
      ...productItems,
    ];
  }, [packages, treatments, products]);

  const cercato = serviceSearch.trim().toLowerCase();
  const filteredServices = cercato
    ? allSellableItems.filter(t => t.cerca.includes(cercato)).slice(0, 10)
    : allSellableItems.slice(0, 10);

  /*
    Il lettore di codici a barre finisce con l'invio.

    Se quello che è stato digitato è esattamente un codice a barre, il prodotto
    entra nel carrello e il campo si svuota, pronto per il pezzo dopo: è così
    che si batte una spesa senza staccare la mano dal lettore. Se non è un
    codice ma la ricerca ha lasciato una sola riga, si prende quella.
  */
  const suInvio = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !cercato) return;
    e.preventDefault();
    const perCodice = allSellableItems.find(t => t.barcode && t.barcode.toLowerCase() === cercato);
    const scelto = perCodice || (filteredServices.length === 1 ? filteredServices[0] : null);
    if (scelto) addToCart(scelto);
  };

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
  /*
    Il buono si considera usato solo se lo sconto a schermo è davvero il suo:
    se qualcuno lo azzera o lo cambia in euro, il regalo non è stato dato e
    resta valido per la prossima volta.
  */
  const buonoApplicato = Boolean(buono) && discountType === 'percent' && discountValue >= (buono?.percento || 0);
  const discountAmount = discountType === 'percent' ? (subtotal * discountValue) / 100 : discountValue;
  // Arrotondato ai centesimi: sommando prezzi con la virgola viene fuori
  // 89,99999999999999, che poi si legge così anche nei riepiloghi.
  const rawTotal = Math.round(Math.max(0, subtotal - discountAmount) * 100) / 100;
  // Sempre per eccesso se c'è sconto percentuale, altrimenti preciso
  const total = (discountType === 'percent' && discountValue > 0) ? Math.ceil(rawTotal) : rawTotal;
  
  const isDebtPayment = !!initialData?.debtPkgId;
  const finalTotal = isDebtPayment ? (customAmount ? Number(customAmount) : 0) : total;
  const isMistoValid = paymentMethod === 'misto' ? Math.abs((Number(splitCash) + Number(splitCard)) - finalTotal) < 0.01 : true;
  // Resto: null se il contante battuto non copre il totale (o non è ancora stato inserito)
  const changeDue = (() => {
    if (paymentMethod !== 'contanti' || cashGiven === '') return null;
    const given = Number(cashGiven);
    if (!isFinite(given) || given + 0.005 < finalTotal) return null;
    return Math.round((given - finalTotal) * 100) / 100;
  })();
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

  const handleComplete = async () => {
    if (!canComplete || saving) return;
    setSaving(true);
    const now = new Date();
    const finalMethod = paymentMethod === 'misto'
      ? `Misto (Contanti: €${splitCash}, Carta: €${splitCard})`
      : PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label || 'Carta';

    const saved = await onComplete({
      client: selectedClient || 'Cliente Occasionale',
      items: cart.map(i => i.name).join(', '),
      total: finalTotal,
      method: finalMethod,
      time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      operator: initialData?.operator || 'Staff',
      // Solo i prodotti (non trattamenti/pacchetti) scaricano il magazzino
      productLines: cart.filter(i => i.type === 'product').map(i => ({ productId: i.id, qty: i.qty })),
      cabinMinutes: initialData?.cabinMinutes,
      // Il legame con l'appuntamento: da qui in poi il gestionale sa che quella
      // seduta è stata incassata davvero, e non solo chiusa.
      appointmentId: initialData?.appointmentId,
    }, initialData?.debtPkgId).catch(() => undefined);
    setSavedTx(saved || null);
    setSaving(false);
    setStep('done');

    // Il buono si chiude adesso, che l'incasso c'è stato: vale una volta sola.
    if (buonoApplicato && clienteScelto?.id) {
      usaBuono(clienteScelto.id, saved?.id).catch(() => {});
      setBuonoScalato(buono?.percento ?? null);
      setBuono(null);
    }

    /*
      Lo scontrino esce da solo.

      Prima bisognava premere "Stampa scontrino" a incasso finito: un passaggio
      in più con la cliente davanti che aspetta, e quando qualcuno se ne
      dimenticava la copia cartacea non usciva affatto. Il tasto resta, per la
      seconda copia.
    */
    handlePrintReceipt(saved || null);
  };

  /**
   * Stampa il tagliando.
   *
   * `tx` si passa a mano subito dopo l'incasso: lo stato con i riferimenti del
   * documento fiscale è appena stato impostato e in quel giro di render non è
   * ancora leggibile, e senza quei numeri lo scontrino uscirebbe senza il
   * riferimento al documento commerciale.
   */
  const handlePrintReceipt = (tx?: TransactionRecord | null) => {
    const doc = tx !== undefined ? tx : savedTx;
    const finalMethod = paymentMethod === 'misto'
      ? `Misto (Contanti €${splitCash}, Carta €${splitCard})`
      : PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label || 'Carta';
    printThermalReceipt({
      lines: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price * i.qty })),
      total: finalTotal,
      method: finalMethod,
      client: selectedClient || 'Cliente Occasionale',
      operator: initialData?.operator || 'Staff',
      // Riferimenti del documento commerciale elettronico, se C95 lo ha già emesso
      progressivo: doc?.c95Progressivo,
      idtrx: doc?.c95Idtrx,
    });
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
                      <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)} {...NO_AUTOFILL} placeholder="Cerca cliente..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                      {filteredClients.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-bg-secondary border border-border rounded-xl shadow-xl z-10 overflow-hidden">
                          {filteredClients.map(c => (
                            <button key={c.id} onClick={() => { setSelectedClient(`${c.firstName} ${c.lastName}`); setClientSearch(''); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-bg-hover text-sm text-text-primary transition-colors flex items-center gap-1.5">
                                {c.firstName} {c.lastName}
                                <SegniCliente clientId={c.id} nome={`${c.firstName} ${c.lastName}`} conMotivo />
                                <span className="text-text-muted">• {c.phone}</span></button>
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
                    <input type="text" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} onKeyDown={suInvio} {...NO_AUTOFILL}
                      placeholder="Cerca trattamento, prodotto o codice a barre…"
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
                      {/* Perché c'è quello sconto: senza questa riga sembra un
                          errore di battitura e qualcuno lo cancella. */}
                      {buono && (
                        <div className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-[11px] leading-relaxed ${
                          buonoApplicato ? 'bg-accent/10 border-accent/25 text-accent' : 'bg-bg-tertiary border-border text-text-secondary'}`}>
                          <Gift className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span>
                            {buonoApplicato
                              ? <><b>Regalo di compleanno applicato: {buono.percento}%.</b> Vale una volta sola e si chiude con questo incasso.</>
                              : <><b>Ha un regalo di compleanno del {buono.percento}%</b> valido fino al {buono.scadenza.split('-').reverse().slice(0, 2).join('/')}. Non è applicato: se lo incassi così, resta buono per la prossima volta.</>}
                          </span>
                        </div>
                      )}
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

                  {/* Contanti: l'operatrice batte quanto ha ricevuto e legge il resto da dare.
                      Il totale incassato resta finalTotal, il contante ricevuto non viene registrato. */}
                  {paymentMethod === 'contanti' && finalTotal > 0 && (
                    <div className="mt-4 p-4 rounded-xl bg-bg-tertiary/50 border border-border">
                      <div className="flex items-center justify-between gap-4">
                        <label className="text-sm font-medium text-text-primary">Contanti ricevuti</label>
                        <div className="relative">
                          <input type="number" step="0.01" inputMode="decimal" value={cashGiven} onChange={e => setCashGiven(e.target.value)}
                            placeholder="0.00" autoComplete="off"
                            className="w-32 pl-2 pr-6 py-2 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary text-right focus:outline-none focus:border-accent/50" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
                        </div>
                      </div>
                      {/* Tagli rapidi: banconote utili al di sopra del totale, più l'importo esatto */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button onClick={() => setCashGiven(finalTotal.toFixed(2))}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">Esatto</button>
                        {[5, 10, 20, 50, 100].filter(v => v > finalTotal).map(v => (
                          <button key={v} onClick={() => setCashGiven(String(v))}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">{v} €</button>
                        ))}
                      </div>
                      {cashGiven !== '' && (
                        changeDue !== null ? (
                          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                            <span className="text-sm font-semibold text-text-primary">Resto da dare</span>
                            <span className="text-2xl font-display font-bold text-accent">{formatCurrency(changeDue)}</span>
                          </div>
                        ) : (
                          <p className="mt-3 pt-3 border-t border-border/40 text-xs text-error font-medium">
                            Contante ricevuto inferiore al totale di {formatCurrency(finalTotal)}
                          </p>
                        )
                      )}
                    </div>
                  )}

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
                {/* Il resto resta a schermo anche dopo l'incasso, finché il modal è aperto */}
                {changeDue !== null && changeDue > 0 && (
                  <div className="w-full rounded-xl bg-accent/10 border border-accent/20 px-3 py-2 mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-primary">Resto da dare</span>
                    <span className="text-xl font-display font-bold text-accent">{formatCurrency(changeDue)}</span>
                  </div>
                )}
                {/* Esito scontrino fiscale: l'operatore deve sapere subito se il documento
                    commerciale è stato trasmesso all'Agenzia delle Entrate. */}
                {buonoScalato !== null && (
                  <div className="w-full rounded-xl bg-accent/10 border border-accent/20 px-3 py-2 mb-3 text-left">
                    <p className="text-xs font-semibold text-accent">🎁 Regalo di compleanno scalato ({buonoScalato}%)</p>
                    <p className="text-[11px] text-text-secondary">Da adesso è speso: non comparirà più nella sua scheda.</p>
                  </div>
                )}
                {savedTx?.c95Status === 'emitted' ? (
                  <div className="w-full rounded-xl bg-success/10 border border-success/20 px-3 py-2 text-left">
                    <p className="text-xs font-semibold text-success mb-0.5">✓ Scontrino fiscale emesso</p>
                    {savedTx.c95Progressivo && <p className="text-[11px] text-text-secondary font-mono">N. {savedTx.c95Progressivo}</p>}
                    {savedTx.c95Idtrx && <p className="text-[11px] text-text-muted font-mono">Cod. transazione {savedTx.c95Idtrx}</p>}
                  </div>
                ) : savedTx?.c95Status ? (
                  <div className="w-full rounded-xl bg-error/10 border border-error/20 px-3 py-2 text-left">
                    <p className="text-xs font-semibold text-error mb-0.5">⚠️ Scontrino fiscale NON emesso</p>
                    <p className="text-[11px] text-text-secondary">{savedTx.c95Error || 'Verifica su C95 ed emetti il documento a mano.'}</p>
                  </div>
                ) : null}
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
                <button onClick={handleComplete} disabled={!canComplete || saving}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canComplete && !saving ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
                  <CheckCircle className="w-4 h-4" /> {saving ? 'Emissione scontrino...' : `Incassa ${formatCurrency(finalTotal)}`}
                </button>
              </>
            ) : (
              <div className="w-full flex items-center gap-3">
                <button onClick={() => handlePrintReceipt()} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary hover:bg-bg-hover transition-colors">
                  <Printer className="w-4 h-4" /> Stampa un'altra copia
                </button>
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all">
                  ✓ Chiudi
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

function WithdrawModal({ balance, onClose, onDone }: { balance: number; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleWithdraw = async () => {
    const amt = Number(amount.replace(',', '.'));
    if (!amt || amt <= 0) { setError('Inserisci un importo valido'); return; }
    if (amt > balance + 0.001) { setError('Importo superiore al saldo in cassaforte'); return; }
    setSaving(true);
    const res = await withdrawCassa(amt, note);
    setSaving(false);
    if (res.ok) onDone();
    else setError(res.error === 'insufficient' ? 'Importo superiore al saldo' : 'Importo non valido');
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-lg font-display font-semibold text-text-primary">Preleva contanti</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="flex justify-between px-3 py-2.5 rounded-xl bg-bg-tertiary/50">
              <span className="text-sm text-text-secondary">Saldo in cassaforte</span>
              <span className="text-sm font-bold text-accent">{formatCurrency(balance)}</span>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Importo da prelevare</label>
              <input type="text" inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); setError(''); }}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-text-primary focus:border-accent outline-none" />
              <button onClick={() => setAmount(balance.toFixed(2))} className="mt-1.5 text-xs text-accent hover:underline">Preleva tutto ({formatCurrency(balance)})</button>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Nota (facoltativa)</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="es. ritiro settimanale, versamento in banca…"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-text-primary focus:border-accent outline-none" />
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30">
            <button onClick={handleWithdraw} disabled={saving}
              className="w-full py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100">
              {saving ? 'Prelievo in corso…' : 'Conferma prelievo'}
            </button>
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
  const [saleInitialData, setSaleInitialData] = useState<{
    client: string; treatmentName: string; treatmentId: string; price: number; operator: string;
    debtPkgId?: string; cabinMinutes?: number; appointmentId?: string;
    products?: { id: string; name: string; price: number; qty: number }[];
    servizi?: { id: string; name: string; price: number; qty: number }[];
    sconto?: number;
  } | null>(null);
  const [showCloseCassa, setShowCloseCassa] = useState(false);
  const [showLastReceipt, setShowLastReceipt] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const router = useRouter();
  const autoOpenedRef = useRef(false);
  const todayTotal = transactions.reduce((s, t) => s + t.total, 0);

  /*
    Gli incassi sospetti: stessa cliente, stesso importo, a meno di dieci minuti
    di distanza. Non li tocco e non li nascondo — dico solo che ci sono, perché
    a volte una persona paga davvero due cose uguali di fila, e a deciderlo deve
    essere chi era al banco.
  */
  const doppioni = useMemo(() => {
    const minuti = (ora: string) => {
      const [h, m] = (ora || '').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const sospetti: typeof transactions = [];
    const ordinate = [...transactions].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    for (let i = 1; i < ordinate.length; i++) {
      const prima = ordinate[i - 1], adesso = ordinate[i];
      if (adesso.total <= 0) continue;
      if (prima.client !== adesso.client) continue;
      if (Math.abs(prima.total - adesso.total) > 0.001) continue;
      if (Math.abs(minuti(adesso.time) - minuti(prima.time)) > 10) continue;
      sospetti.push(adesso);
    }
    return sospetti;
  }, [transactions]);

  // Cassaforte
  const [safeBalance, setSafeBalance] = useState(0);
  const [safeMovements, setSafeMovements] = useState<CassaMovementRecord[]>([]);
  const [closeState, setCloseState] = useState<'idle' | 'saving' | 'done' | 'already'>('idle');
  const [showWithdraw, setShowWithdraw] = useState(false);
  const todayRomeStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const closedToday = safeMovements.some(m => m.type === 'deposit' && m.date === todayRomeStr);

  // Elenco transazioni: segue il periodo scelto nel Riepilogo Incassi. Finché
  // il periodo è "oggi" si usa lo store (si aggiorna da solo dopo una vendita),
  // altrimenti si caricano le transazioni di quelle date.
  const [period, setPeriod] = useState<{ from: string; to: string }>({ from: todayRomeStr, to: todayRomeStr });
  const [periodTxs, setPeriodTxs] = useState<TransactionRecord[] | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const isToday = period.from === todayRomeStr && period.to === todayRomeStr;

  const loadPeriodTxs = React.useCallback(async (from: string, to: string) => {
    setPeriodLoading(true);
    try {
      setPeriodTxs(await getTransactionsByRange(from, to));
    } catch {
      setPeriodTxs([]);
    } finally {
      setPeriodLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isToday) { setPeriodTxs(null); return; }
    loadPeriodTxs(period.from, period.to);
  }, [isToday, period.from, period.to, loadPeriodTxs]);

  const listTxs = isToday ? transactions : (periodTxs ?? []);
  const periodLabel = isToday
    ? 'oggi'
    : period.from === period.to
      ? new Date(period.from + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
      : `${new Date(period.from + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} → ${new Date(period.to + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;

  const refreshSafe = async () => {
    const s = await getCassaforte();
    setSafeBalance(s.balance);
    setSafeMovements(s.movements);
  };

  const handleCloseCassa = async () => {
    setCloseState('saving');
    const res = await closeCassa();
    if (res.ok) {
      await refreshSafe();
      setCloseState('done');
    } else if (res.error === 'already_closed') {
      setCloseState('already');
    } else {
      setCloseState('idle');
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchClients();
    fetchTreatments();
    refreshSafe();
    primeVatRate(); // aliquota per lo scorporo IVA sul tagliando stampato
  }, [fetchTransactions, fetchClients, fetchTreatments]);

  // Auto-open dalla vendita in arrivo dall'agenda — via memoria di sessione,
  // così l'URL resta sempre pulito e il popup NON si riapre al refresh o rientrando in cassa.
  useEffect(() => {
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    let raw: string | null = null;
    try { raw = sessionStorage.getItem('revo_pos_autosale'); } catch {}
    if (raw) {
      try { sessionStorage.removeItem('revo_pos_autosale'); } catch {}
      try {
        const d = JSON.parse(raw);
        const prodotti = Array.isArray(d?.products) ? d.products : [];
        if (d?.client && (d?.treatment || prodotti.length > 0)) {
          setSaleInitialData({
            client: d.client, treatmentName: d.treatment, treatmentId: d.treatmentId || '',
            price: Number(d.price) || 0, operator: d.operator || 'Staff',
            servizi: Array.isArray(d?.servizi) ? d.servizi : undefined,
            sconto: Number(d?.sconto) || undefined,
            debtPkgId: d.debtPkgId || undefined,
            cabinMinutes: d.cabinMinutes ? Number(d.cabinMinutes) : undefined,
            appointmentId: d.appointmentId || undefined,
            products: prodotti,
          });
          setShowSaleModal(true);
        }
      } catch { /* payload non valido: ignoro */ }
    }
    // Ripulisco eventuali parametri legacy rimasti nell'URL dal vecchio meccanismo
    if (typeof window !== 'undefined' && window.location.search) {
      router.replace('/dashboard/pos');
    }
  }, [router]);

  const handleNewSale = async (tx: Omit<TransactionRecord, 'id'>, debtPkgId?: string) => {
    const created = await addTransaction(tx);
    if (debtPkgId) {
      addPayment(debtPkgId, created.total, created.method as any, created.operator, 'Pagamento da Cassa');
    }
    return created;
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
    }, tx.id);
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
      <CassaTabs />
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
          { label: 'Chiudi Cassa', icon: Calculator, color: '#F59E0B', action: () => { setCloseState('idle'); setShowCloseCassa(true); } },
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

      {/* Due incassi identici a pochi minuti l'uno dall'altro sono quasi sempre
          lo stesso incasso battuto due volte: la giornata chiude più alta di
          quello che c'è nel cassetto e ci si accorge dell'errore giorni dopo,
          quando non si ricorda più com'è andata. */}
      {doppioni.length > 0 && (
        <div className="rounded-2xl bg-warning/10 border border-warning/30 p-4">
          <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-warning" />
            {doppioni.length === 1 ? 'Un incasso sembra battuto due volte' : `${doppioni.length} incassi sembrano battuti due volte`}
          </p>
          <div className="mt-2 space-y-1">
            {doppioni.map(d => (
              <p key={d.id} className="text-xs text-text-secondary">
                <strong className="text-text-primary">{d.client}</strong> · {formatCurrency(d.total)} alle {d.time} — stesso importo e stessa cliente di un altro incasso di oggi.
              </p>
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            Se è un errore, cancella quello di troppo dall&apos;elenco qui sotto. Se invece ha pagato davvero due volte, va bene così.
          </p>
        </div>
      )}

      {/* Today Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Incasso Oggi</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(todayTotal)}</p><p className="text-xs text-text-muted mt-1">{transactions.filter(t => t.total > 0).length} vendite</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Transazioni</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{transactions.length}</p><p className="text-xs text-text-muted mt-1">oggi</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Scontrino Medio</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(Math.round(todayTotal / Math.max(transactions.filter(t => t.total > 0).length, 1)))}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Cassa Aperta</p><p className="text-2xl font-display font-bold text-accent mt-1">Attiva</p><p className="text-xs text-text-muted mt-1">dalle 08:55</p></div>
      </div>

      {/* Incassi per periodo: giorno, settimana, mese o intervallo, divisi per metodo */}
      <IncomeSummary onPeriodChange={(from, to) => setPeriod({ from, to })} />

      {/* Recent Transactions */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <h3 className="text-base font-display font-semibold text-text-primary">
            {isToday ? 'Ultime Transazioni' : 'Transazioni del periodo'}
          </h3>
          <span className="text-xs text-text-muted capitalize">{periodLabel}</span>
        </div>
        <div className="divide-y divide-border/30">
          {listTxs.map(tx => {
            // Regalo: sta in elenco per sapere che è successo, ma non è un incasso
            const isGift = tx.method === 'Regalo';
            return (
            <div key={tx.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-bg-hover transition-colors group ${tx.total < 0 ? 'bg-error/[0.03]' : isGift ? 'bg-accent/[0.03]' : ''}`}>
              <div className={`p-2 rounded-lg ${tx.total < 0 ? 'bg-error/10 text-error' : 'bg-accent/10 text-accent'}`}>
                {tx.total < 0 ? <Banknote className="w-4 h-4" /> : isGift ? <Gift className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{tx.client}</p>
                <p className="text-xs text-text-secondary truncate">{tx.items}</p>
                {tx.total > 0 && tx.c95Status && tx.c95Status !== 'emitted' && (
                  <p className="text-[11px] text-error mt-0.5 truncate" title={tx.c95Error || undefined}>
                    ⚠️ Scontrino fiscale NON emesso{tx.c95Error ? ` — ${tx.c95Error}` : ''}
                  </p>
                )}
                {tx.c95Progressivo && (
                  <p className="text-[11px] text-text-muted font-mono truncate">{tx.c95Progressivo}</p>
                )}
              </div>
              <div className="hidden sm:block text-right"><p className="text-xs text-text-muted">{tx.operator}</p></div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${tx.total < 0 ? 'text-error' : isGift ? 'text-accent' : 'text-text-primary'}`}>
                  {isGift ? 'Regalo' : `${tx.total < 0 ? '-' : ''}${formatCurrency(Math.abs(tx.total))}`}
                </p>
                <p className="text-[11px] text-text-muted">{isGift ? 'nessun incasso' : tx.method} • {isToday ? tx.time : `${new Date(tx.date + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' })} ${tx.time}`}</p>
              </div>
              <button onClick={() => { if (window.confirm(isGift ? `Eliminare questa riga di regalo (${tx.client})? Il pacchetto resta regalato: sparisce solo la traccia in cassa.` : `Eliminare questa transazione di ${formatCurrency(Math.abs(tx.total))} (${tx.client})? L'incasso verrà ricalcolato.`)) { removeTransaction(tx.id).then(() => { if (!isToday) loadPeriodTxs(period.from, period.to); }); } }}
                title="Elimina transazione"
                className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            );
          })}
          {listTxs.length === 0 && (
            <div className="text-center py-10"><p className="text-text-muted">{periodLoading ? 'Carico le transazioni…' : 'Nessuna transazione'}</p></div>
          )}
        </div>
      </div>

      {/* ===== CASSAFORTE ===== */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/10 text-accent"><Vault className="w-5 h-5" /></div>
            <div>
              <h3 className="text-base font-display font-semibold text-text-primary flex items-center gap-1.5">Cassaforte <Lock className="w-3.5 h-3.5 text-text-muted" /></h3>
              <p className="text-xs text-text-muted">Contanti versati alle chiusure di cassa — bloccati fino al prelievo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/cassaforte-mobile" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-tertiary border border-border text-sm font-medium text-text-primary hover:bg-bg-hover transition-all" title="Vedi la cassaforte dal cellulare, aggiornata live">
              <Smartphone className="w-4 h-4" /><span className="hidden sm:inline">Versione mobile</span>
            </a>
            <button onClick={() => setShowWithdraw(true)} disabled={safeBalance <= 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-tertiary border border-border text-sm font-medium text-text-primary hover:bg-bg-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <ArrowDownToLine className="w-4 h-4" /> Preleva contanti
            </button>
          </div>
        </div>

        <div className="px-5 py-5 border-b border-border text-center bg-accent/[0.03]">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Contanti in cassaforte</p>
          <p className="text-3xl font-display font-bold text-accent">{formatCurrency(safeBalance)}</p>
        </div>

        <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
          {safeMovements.map(m => (
            <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className={`p-2 rounded-lg ${m.type === 'withdraw' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                {m.type === 'withdraw' ? <ArrowDownToLine className="w-4 h-4" /> : <Vault className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{m.type === 'withdraw' ? 'Prelievo contanti' : 'Chiusura cassa'}</p>
                <p className="text-xs text-text-muted truncate">
                  {m.date.split('-').reverse().join('/')}
                  {m.type === 'deposit' ? ` • ${m.txCount} transazioni` : (m.note ? ` • ${m.note}` : '')}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${m.type === 'withdraw' ? 'text-warning' : 'text-success'}`}>{m.type === 'withdraw' ? '−' : '+'} {formatCurrency(m.cash)}</p>
                {m.type === 'deposit' && <p className="text-[11px] text-text-muted">incasso {formatCurrency(m.total)}</p>}
              </div>
            </div>
          ))}
          {safeMovements.length === 0 && (
            <div className="text-center py-10"><p className="text-text-muted text-sm">Nessun movimento. Chiudi la cassa per versare i contanti qui.</p></div>
          )}
        </div>
      </div>

      {/* MODALS */}
      <AnimatePresence>{showWithdraw && (
        <WithdrawModal balance={safeBalance} onClose={() => setShowWithdraw(false)}
          onDone={async () => { await refreshSafe(); setShowWithdraw(false); }} />
      )}</AnimatePresence>

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

                {/* Anteprima versamento in cassaforte */}
                <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-accent/5 border border-accent/20">
                  <span className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Vault className="w-4 h-4 text-accent" /> Contanti in cassaforte</span>
                  <span className="text-sm font-bold text-accent">+ {formatCurrency(cashCount)}</span>
                </div>

                {(closeState === 'done') && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-success/10 text-success text-sm font-medium">
                    <CheckCircle className="w-4 h-4" /> Cassa chiusa: {formatCurrency(cashCount)} versati in cassaforte.
                  </div>
                )}
                {(closeState === 'already' || (closedToday && closeState === 'idle')) && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-warning/10 text-warning text-sm font-medium">
                    <Lock className="w-4 h-4" /> La cassa di oggi è già stata chiusa. I contanti sono già in cassaforte.
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30">
                {closeState === 'done' ? (
                  <button onClick={() => setShowCloseCassa(false)} className="w-full py-2.5 rounded-xl bg-bg-tertiary text-text-primary text-sm font-medium hover:bg-bg-hover transition-all">
                    Chiudi
                  </button>
                ) : (
                  <button
                    onClick={handleCloseCassa}
                    disabled={closeState === 'saving' || closedToday}
                    className="w-full py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed">
                    {closeState === 'saving' ? 'Chiusura in corso…' : closedToday ? 'Cassa già chiusa oggi' : '✓ Conferma e versa in cassaforte'}
                  </button>
                )}
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
              <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30 flex items-center gap-3">
                {lastTx && (
                  <button
                    onClick={() => printThermalReceipt({
                      lines: (lastTx.items || '').split(', ').filter(Boolean).map(name => ({ name })),
                      total: lastTx.total,
                      method: lastTx.method,
                      client: lastTx.client,
                      operator: lastTx.operator,
                      progressivo: lastTx.c95Progressivo,
                      idtrx: lastTx.c95Idtrx,
                    })}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all"
                  >
                    <Printer className="w-4 h-4" /> Stampa
                  </button>
                )}
                <button onClick={() => setShowLastReceipt(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Chiudi</button>
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
