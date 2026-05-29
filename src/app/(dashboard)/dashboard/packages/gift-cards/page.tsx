'use client';

import React, { useState, useMemo } from 'react';
import { useGiftCardStore, GiftCard } from '@/stores/useGiftCardStore';
import { useClientStore } from '@/stores/useClientStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift, Plus, X, Search, User, CheckCircle, Trash2,
  CreditCard, Clock, Euro, Eye,
} from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { mockTreatments } from '@/lib/mock-data';

/* ========== CREATE GIFT CARD MODAL ========== */
function CreateGiftCardModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: Parameters<ReturnType<typeof useGiftCardStore.getState>['createGiftCard']>[0]) => void;
}) {
  const [step, setStep] = useState<'info' | 'payment' | 'done'>('info');
  const [purchasedBy, setPurchasedBy] = useState('');
  const [buyerSearch, setBuyerSearch] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [validityMonths, setValidityMonths] = useState('12');
  const [paymentMethod, setPaymentMethod] = useState<'Carta' | 'Contanti' | 'Satispay' | 'Bonifico'>('Carta');
  const [operator, setOperator] = useState('Sara Rossi');
  const [showBuyerDrop, setShowBuyerDrop] = useState(false);
  const [showRecipientDrop, setShowRecipientDrop] = useState(false);
  const [createdCode, setCreatedCode] = useState('');

  const allClients = useClientStore(s => s.clients);
  const operators = ['Sara Rossi', 'Valentina Bianchi', 'Chiara Moretti', 'Francesca Romano', 'Alessia Conti'];

  const filteredBuyers = useMemo(() => {
    if (!buyerSearch.trim()) return allClients.slice(0, 6);
    return allClients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(buyerSearch.toLowerCase())).slice(0, 6);
  }, [buyerSearch, allClients]);

  const filteredRecipients = useMemo(() => {
    if (!recipientSearch.trim()) return allClients.slice(0, 6);
    return allClients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(recipientSearch.toLowerCase())).slice(0, 6);
  }, [recipientSearch, allClients]);

  const presetAmounts = [50, 75, 100, 150, 200, 300];
  const amountNum = Number(amount) || 0;

  const handleConfirm = () => {
    if (!purchasedBy || !recipientName || amountNum <= 0) return;
    const gc = (window as unknown as { __gcCreate: typeof onCreate }).__gcCreate?.({
      purchasedBy, recipientName, amount: amountNum, paymentMethod, operator,
      validityMonths: Number(validityMonths), message: message || undefined,
    });
    // We pass through the parent
    onCreate({
      purchasedBy, recipientName, amount: amountNum, paymentMethod, operator,
      validityMonths: Number(validityMonths), message: message || undefined,
    });
    setStep('done');
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div>
              <h3 className="text-base font-display font-semibold text-text-primary flex items-center gap-2"><Gift className="w-4 h-4 text-accent" /> Crea Buono Regalo</h3>
              <div className="flex gap-1 mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${step === 'info' ? 'bg-accent/15 text-accent' : 'text-text-muted'}`}>1. Info</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${step === 'payment' ? 'bg-accent/15 text-accent' : 'text-text-muted'}`}>2. Pagamento</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {step === 'info' ? (
              <div className="px-6 py-5 space-y-4">
                {/* Buyer */}
                <div className="relative">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Chi compra il buono? *</label>
                  {purchasedBy ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary border border-border">
                      <User className="w-4 h-4 text-accent" /><span className="text-sm font-medium text-text-primary flex-1">{purchasedBy}</span>
                      <button onClick={() => { setPurchasedBy(''); setBuyerSearch(''); }} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input type="text" value={buyerSearch} onChange={e => { setBuyerSearch(e.target.value); setShowBuyerDrop(true); }} onFocus={() => setShowBuyerDrop(true)}
                          placeholder="Cerca o scrivi nome..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                      </div>
                      {showBuyerDrop && (
                        <div className="absolute left-0 right-0 mt-1 bg-bg-tertiary border border-border rounded-xl shadow-xl z-10 max-h-36 overflow-y-auto">
                          {buyerSearch.trim() && !filteredBuyers.some(c => `${c.firstName} ${c.lastName}`.toLowerCase() === buyerSearch.toLowerCase()) && (
                            <button onClick={() => { setPurchasedBy(buyerSearch); setShowBuyerDrop(false); }}
                              className="w-full px-3 py-2 hover:bg-bg-hover text-left text-sm text-accent font-medium">+ Usa &quot;{buyerSearch}&quot;</button>
                          )}
                          {filteredBuyers.map(c => (
                            <button key={c.id} onClick={() => { setPurchasedBy(`${c.firstName} ${c.lastName}`); setShowBuyerDrop(false); setBuyerSearch(''); }}
                              className="w-full px-3 py-2 hover:bg-bg-hover text-left text-sm text-text-primary">{c.firstName} {c.lastName}</button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Recipient */}
                <div className="relative">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Chi riceve il buono? (Festeggiata) *</label>
                  {recipientName ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary border border-border">
                      <Gift className="w-4 h-4 text-pink-400" /><span className="text-sm font-medium text-text-primary flex-1">{recipientName}</span>
                      <button onClick={() => { setRecipientName(''); setRecipientSearch(''); }} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input type="text" value={recipientSearch} onChange={e => { setRecipientSearch(e.target.value); setShowRecipientDrop(true); }} onFocus={() => setShowRecipientDrop(true)}
                          placeholder="Cerca o scrivi nome festeggiata..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                      </div>
                      {showRecipientDrop && (
                        <div className="absolute left-0 right-0 mt-1 bg-bg-tertiary border border-border rounded-xl shadow-xl z-10 max-h-36 overflow-y-auto">
                          {recipientSearch.trim() && !filteredRecipients.some(c => `${c.firstName} ${c.lastName}`.toLowerCase() === recipientSearch.toLowerCase()) && (
                            <button onClick={() => { setRecipientName(recipientSearch); setShowRecipientDrop(false); }}
                              className="w-full px-3 py-2 hover:bg-bg-hover text-left text-sm text-pink-400 font-medium">+ Usa &quot;{recipientSearch}&quot;</button>
                          )}
                          {filteredRecipients.map(c => (
                            <button key={c.id} onClick={() => { setRecipientName(`${c.firstName} ${c.lastName}`); setShowRecipientDrop(false); setRecipientSearch(''); }}
                              className="w-full px-3 py-2 hover:bg-bg-hover text-left text-sm text-text-primary">{c.firstName} {c.lastName}</button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Valore Buono *</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {presetAmounts.map(v => (
                      <button key={v} onClick={() => setAmount(String(v))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${Number(amount) === v ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-bg-tertiary text-text-secondary border border-border hover:border-border-light'}`}>
                        {formatCurrency(v)}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">€</span>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} placeholder="Importo personalizzato"
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Messaggio (opzionale)</label>
                  <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Es. Buon compleanno! ❤️"
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                </div>

                {/* Validity */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Validità</label>
                  <select value={validityMonths} onChange={e => setValidityMonths(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                    <option value="6">6 mesi</option><option value="12">12 mesi</option><option value="18">18 mesi</option><option value="24">24 mesi</option>
                  </select>
                </div>
              </div>
            ) : step === 'payment' ? (
              <div className="px-6 py-5 space-y-4">
                {/* Preview card */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-pink-500/10 border border-accent/20 text-center">
                  <Gift className="w-8 h-8 text-accent mx-auto mb-2" />
                  <p className="text-xl font-display font-bold text-accent">{formatCurrency(amountNum)}</p>
                  <p className="text-xs text-text-muted mt-1">Da: {purchasedBy} → Per: {recipientName}</p>
                  {message && <p className="text-xs text-text-secondary mt-1 italic">&quot;{message}&quot;</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Metodo di Pagamento *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([['Carta', '💳'], ['Contanti', '💵'], ['Satispay', '📱'], ['Bonifico', '🏦']] as const).map(([method, icon]) => (
                      <button key={method} onClick={() => setPaymentMethod(method)}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${paymentMethod === method ? 'border-accent bg-accent/5' : 'border-border hover:border-border-light'}`}>
                        <span className="text-lg">{icon}</span>
                        <span className={`text-sm font-medium ${paymentMethod === method ? 'text-accent' : 'text-text-primary'}`}>{method}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Incassato da *</label>
                  <select value={operator} onChange={e => setOperator(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                    {operators.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15 }}
                  className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-success" />
                </motion.div>
                <h3 className="text-xl font-display font-bold text-text-primary mb-1">Buono Creato! 🎉</h3>
                <p className="text-sm text-text-secondary mb-1">{formatCurrency(amountNum)} • {paymentMethod}</p>
                <p className="text-xs text-text-muted">Da: {purchasedBy} → Per: {recipientName}</p>
                <p className="text-xs text-text-muted mt-1">Registrato da: {operator}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-bg-tertiary/30 flex-shrink-0">
            {step === 'info' ? (
              <>
                <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
                <button onClick={() => { if (purchasedBy && recipientName && amountNum > 0) setStep('payment'); }}
                  disabled={!purchasedBy || !recipientName || amountNum <= 0}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${purchasedBy && recipientName && amountNum > 0 ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
                  Avanti → Pagamento
                </button>
              </>
            ) : step === 'payment' ? (
              <>
                <button onClick={() => setStep('info')} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">← Indietro</button>
                <button onClick={handleConfirm}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium gradient-accent shadow-lg shadow-accent/20 hover:scale-105 transition-all">
                  <CheckCircle className="w-4 h-4" /> Crea Buono • {formatCurrency(amountNum)}
                </button>
              </>
            ) : (
              <button onClick={onClose} className="w-full py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all">✓ Chiudi</button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ========== REDEEM GIFT CARD MODAL ========== */
function RedeemModal({ gc, onClose, onRedeem }: {
  gc: GiftCard; onClose: () => void;
  onRedeem: (amount: number, service: string, operator: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [operator, setOperator] = useState('Sara Rossi');
  const operators = ['Sara Rossi', 'Valentina Bianchi', 'Chiara Moretti', 'Francesca Romano', 'Alessia Conti'];

  const filteredServices = serviceSearch.trim()
    ? mockTreatments.filter(t => t.name.toLowerCase().includes(serviceSearch.toLowerCase()) && t.isActive).slice(0, 6)
    : mockTreatments.filter(t => t.isActive).slice(0, 6);

  const amountNum = Number(amount) || 0;
  const newBalance = Math.max(0, gc.remainingBalance - amountNum);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h3 className="text-base font-display font-semibold text-text-primary">Scala Buono Regalo</h3>
              <p className="text-xs text-text-muted">{gc.recipientName} • {gc.code}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-center">
              <p className="text-xs text-text-muted">Saldo disponibile</p>
              <p className="text-2xl font-display font-bold text-accent">{formatCurrency(gc.remainingBalance)}</p>
            </div>

            {/* Service selection */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Trattamento effettuato *</label>
              {selectedService ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent/10 border border-accent/20">
                  <span className="text-sm font-medium text-accent flex-1">{selectedService}</span>
                  <button onClick={() => { setSelectedService(''); setAmount(''); }} className="text-accent/60 hover:text-accent"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input type="text" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} placeholder="Cerca trattamento..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                  <div className="mt-2 grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto">
                    {filteredServices.map(t => (
                      <button key={t.id} onClick={() => { setSelectedService(t.name); setAmount(String(Math.min(t.price, gc.remainingBalance))); setServiceSearch(''); }}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-tertiary border border-border hover:border-accent/30 text-left transition-all">
                        <span className="text-xs font-medium text-text-primary">{t.name}</span>
                        <span className="text-xs font-bold text-accent">{formatCurrency(t.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Amount */}
            {selectedService && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Importo da scalare</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">€</span>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} max={gc.remainingBalance} min={1}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all" />
                </div>
                {amountNum > 0 && (
                  <div className="mt-2 p-2 rounded-lg bg-bg-tertiary/50">
                    <div className="flex justify-between text-xs"><span className="text-text-muted">Saldo dopo</span><span className={`font-bold ${newBalance <= 0 ? 'text-text-muted' : 'text-accent'}`}>{formatCurrency(newBalance)}</span></div>
                  </div>
                )}
              </div>
            )}

            {/* Operator */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Estetista</label>
              <select value={operator} onChange={e => setOperator(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                {operators.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
            <button onClick={() => { if (amountNum > 0 && selectedService) onRedeem(amountNum, selectedService, operator); }}
              disabled={amountNum <= 0 || !selectedService}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${amountNum > 0 && selectedService ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
              <CheckCircle className="w-4 h-4" /> Scala {formatCurrency(amountNum)}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ========== MAIN PAGE ========== */
export default function GiftCardsPage() {
  const { giftCards, createGiftCard, redeemGiftCard, deleteGiftCard, getTotalActiveBalance } = useGiftCardStore();
  const [showCreate, setShowCreate] = useState(false);
  const [redeemingGc, setRedeemingGc] = useState<GiftCard | null>(null);
  const [viewingGc, setViewingGc] = useState<GiftCard | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'partial' | 'used'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredCards = useMemo(() => {
    let list = [...giftCards];
    if (filter !== 'all') list = list.filter(gc => gc.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(gc =>
        gc.recipientName.toLowerCase().includes(q) ||
        gc.purchasedBy.toLowerCase().includes(q) ||
        gc.code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [giftCards, filter, search]);

  const activeCards = giftCards.filter(gc => gc.status === 'active' || gc.status === 'partial');
  const totalBalance = getTotalActiveBalance();
  const totalSold = giftCards.reduce((s, gc) => s + gc.amount, 0);

  const handleCreate = (data: Parameters<typeof createGiftCard>[0]) => {
    createGiftCard(data);
    setShowCreate(false);
  };

  const handleRedeem = (gcId: string, amount: number, service: string, operator: string) => {
    redeemGiftCard(gcId, amount, service, operator);
    setRedeemingGc(null);
  };

  const statusBadge = (status: GiftCard['status']) => {
    switch (status) {
      case 'active': return <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-success/10 text-success">Attivo</span>;
      case 'partial': return <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">Parziale</span>;
      case 'used': return <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted">Esaurito</span>;
      case 'expired': return <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-error/10 text-error">Scaduto</span>;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h2 className="text-xl font-display font-bold text-text-primary flex items-center gap-2"><Gift className="w-5 h-5 text-accent" /> Buoni Regalo</h2><p className="text-sm text-text-secondary">Vendi e gestisci buoni regalo e gift card</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all hover:scale-105"><Plus className="w-4 h-4" /> Nuovo Buono</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Buoni Attivi</p><p className="text-2xl font-display font-bold text-accent mt-1">{activeCards.length}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Saldo Totale Attivo</p><p className="text-2xl font-display font-bold text-warning mt-1">{formatCurrency(totalBalance)}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Totale Venduto</p><p className="text-2xl font-display font-bold text-success mt-1">{formatCurrency(totalSold)}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Totale Buoni</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{giftCards.length}</p></div>
      </div>

      {/* Filters + Search */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 flex-1 min-w-0">
              {[{ k: 'all', l: 'Tutti' }, { k: 'active', l: 'Attivi' }, { k: 'partial', l: 'Parziali' }, { k: 'used', l: 'Esauriti' }].map(f => (
                <button key={f.k} onClick={() => setFilter(f.k as typeof filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f.k ? 'bg-accent/15 text-accent' : 'text-text-muted hover:bg-bg-hover'}`}>{f.l}</button>
              ))}
            </div>
            <div className="relative w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nome o codice..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
            </div>
          </div>
        </div>

        <div className="divide-y divide-border/30">
          {filteredCards.map(gc => (
            <div key={gc.id} className="flex items-center gap-3 px-5 py-4 hover:bg-bg-hover/50 transition-colors">
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${gc.status === 'used' ? 'bg-bg-tertiary' : 'bg-gradient-to-br from-accent/10 to-pink-500/10'}`}>
                <Gift className={`w-5 h-5 ${gc.status === 'used' ? 'text-text-muted' : 'text-accent'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">{gc.recipientName}</p>
                  {statusBadge(gc.status)}
                </div>
                <p className="text-xs text-text-muted">Codice: <span className="font-mono text-text-secondary">{gc.code}</span> • Da: {gc.purchasedBy}</p>
              </div>
              <div className="text-right min-w-[80px]">
                <p className={`text-sm font-bold ${gc.remainingBalance > 0 ? 'text-accent' : 'text-text-muted'}`}>{formatCurrency(gc.remainingBalance)}</p>
                <p className="text-[10px] text-text-muted">di {formatCurrency(gc.amount)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setViewingGc(gc)} className="p-2 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-all" title="Dettagli">
                  <Eye className="w-4 h-4" />
                </button>
                {(gc.status === 'active' || gc.status === 'partial') && (
                  <button onClick={() => setRedeemingGc(gc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors">
                    <CreditCard className="w-3 h-3" /> Scala
                  </button>
                )}
                {confirmDeleteId === gc.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { deleteGiftCard(gc.id); setConfirmDeleteId(null); }}
                      className="px-2 py-1.5 rounded-lg bg-error text-white text-[10px] font-semibold">Sì</button>
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1.5 rounded-lg bg-bg-tertiary text-text-muted text-[10px] font-semibold">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(gc.id)} className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all" title="Elimina">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {filteredCards.length === 0 && (
            <div className="text-center py-10"><p className="text-text-muted">Nessun buono regalo trovato</p></div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>{showCreate && <CreateGiftCardModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}</AnimatePresence>
      <AnimatePresence>{redeemingGc && <RedeemModal gc={redeemingGc} onClose={() => setRedeemingGc(null)} onRedeem={(a, s, o) => handleRedeem(redeemingGc.id, a, s, o)} />}</AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>{viewingGc && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setViewingGc(null)} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setViewingGc(null)}>
            <div className="w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                <h3 className="text-base font-display font-semibold text-text-primary">Dettaglio Buono</h3>
                <button onClick={() => setViewingGc(null)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {/* Card preview */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-pink-500/10 border border-accent/20 text-center">
                  <Gift className="w-8 h-8 text-accent mx-auto mb-1" />
                  <p className="text-2xl font-display font-bold text-accent">{formatCurrency(viewingGc.remainingBalance)}</p>
                  <p className="text-xs text-text-muted">di {formatCurrency(viewingGc.amount)}</p>
                  <div className="w-full h-2 rounded-full bg-bg-tertiary mt-2 overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(viewingGc.remainingBalance / viewingGc.amount) * 100}%` }} />
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-text-secondary">Codice</span><span className="text-text-primary font-mono font-semibold">{viewingGc.code}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Comprato da</span><span className="text-text-primary font-medium">{viewingGc.purchasedBy}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Per</span><span className="text-text-primary font-medium">{viewingGc.recipientName}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Data acquisto</span><span className="text-text-primary">{new Date(viewingGc.purchaseDate).toLocaleDateString('it-IT')}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Scadenza</span><span className="text-text-primary">{new Date(viewingGc.expiryDate).toLocaleDateString('it-IT')}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Pagamento</span><span className="text-text-primary">{viewingGc.paymentMethod}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Venduto da</span><span className="text-text-primary">{viewingGc.purchaseOperator}</span></div>
                  {viewingGc.message && <div className="flex justify-between"><span className="text-text-secondary">Messaggio</span><span className="text-text-primary italic">&quot;{viewingGc.message}&quot;</span></div>}
                </div>

                {/* Transactions */}
                {viewingGc.transactions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">📋 Utilizzi</p>
                    <div className="space-y-1.5">
                      {viewingGc.transactions.map(t => (
                        <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary border border-border/50">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-text-primary">{t.service}</p>
                            <p className="text-[10px] text-text-muted">{new Date(t.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })} • {t.operator}</p>
                          </div>
                          <span className="text-xs font-bold text-error">-{formatCurrency(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-3 border-t border-border bg-bg-tertiary/30 flex-shrink-0">
                <button onClick={() => setViewingGc(null)} className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Chiudi</button>
              </div>
            </div>
          </motion.div>
        </>
      )}</AnimatePresence>
    </motion.div>
  );
}
