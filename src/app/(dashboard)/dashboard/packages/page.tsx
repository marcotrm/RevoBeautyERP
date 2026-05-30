'use client';

import React, { useState, useMemo } from 'react';
import { usePackageStore, PackageItem, ClientPackage } from '@/stores/usePackageStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, CheckCircle, AlertCircle,
  X, Trash2, Minus, Search, User, Calendar, Clock, History, Euro,
} from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { useClientStore } from '@/stores/useClientStore';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { TreatmentsSection } from './TreatmentsSection';
const PKG_COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6'];

/* ========== USE SESSION MODAL ========== */
function UseSessionModal({ cp, onClose, onConfirm }: {
  cp: ClientPackage; onClose: () => void; onConfirm: (operator: string, note: string) => void;
}) {
  const [operator, setOperator] = useState('Sara Rossi');
  const [note, setNote] = useState('');
  const remaining = cp.totalSessions - cp.usedSessions;
  const operators = ['Sara Rossi', 'Valentina Bianchi', 'Chiara Moretti', 'Francesca Romano', 'Alessia Conti'];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h3 className="text-base font-display font-semibold text-text-primary">Scala Seduta</h3>
              <p className="text-xs text-text-muted">{cp.clientName} • {cp.packageName}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4">
            {/* Progress preview */}
            <div className="text-center p-4 rounded-xl border border-border bg-bg-tertiary/50">
              <div className="flex items-center justify-center gap-1.5 mb-3">
                {Array.from({ length: cp.totalSessions }, (_, i) => (
                  <div key={i} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all ${
                    i < cp.usedSessions ? 'border-success/30 bg-success/20 text-success'
                    : i === cp.usedSessions ? 'border-accent bg-accent/20 text-accent scale-125 ring-2 ring-accent/20'
                    : 'border-border bg-bg-tertiary text-text-muted'
                  }`}>
                    {i < cp.usedSessions ? '✓' : i + 1}
                  </div>
                ))}
              </div>
              <p className="text-sm font-semibold text-text-primary">
                Seduta <span className="text-accent">{cp.usedSessions + 1}</span> di {cp.totalSessions}
              </p>
              <p className="text-xs text-text-muted mt-0.5">Dopo questa ne restano {remaining - 1}</p>
            </div>
            {/* Operator */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Eseguita da</label>
              <select value={operator} onChange={e => setOperator(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                {operators.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Note (opzionale)</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Es. Zona braccia..."
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
            <button onClick={() => onConfirm(operator, note)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all">
              <Minus className="w-4 h-4" /> Conferma Seduta
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ========== HISTORY MODAL ========== */
function HistoryModal({ cp, onClose, onAddPayment }: { cp: ClientPackage; onClose: () => void; onAddPayment?: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h3 className="text-base font-display font-semibold text-text-primary">Storico Sedute</h3>
              <p className="text-xs text-text-muted">{cp.clientName} • {cp.packageName}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {/* Progress bar */}
            <div className="flex items-center gap-1.5 mb-4">
              {Array.from({ length: cp.totalSessions }, (_, i) => (
                <div key={i} className={`flex-1 h-2 rounded-full ${i < cp.usedSessions ? 'bg-success' : 'bg-bg-tertiary'}`} />
              ))}
            </div>
            <p className="text-xs text-text-muted mb-4">{cp.usedSessions}/{cp.totalSessions} sedute completate • Costo pacchetto {formatCurrency(cp.pricePaid)} • Costo/seduta {formatCurrency(Math.round(cp.pricePaid / cp.totalSessions))}</p>

            {/* Payment Summary */}
            <div className="p-3 rounded-xl bg-bg-tertiary/50 border border-border/50 mb-4 space-y-2">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">💰 Situazione Pagamento</p>
              <div className="flex justify-between text-sm"><span className="text-text-secondary">Prezzo pacchetto</span><span className="text-text-primary font-medium">{formatCurrency(cp.pricePaid)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-text-secondary">Totale pagato</span><span className="text-success font-bold">{formatCurrency(cp.totalPaid || cp.pricePaid)}</span></div>
              {(cp.remainingBalance || 0) > 0 && (
                <div className="flex justify-between text-sm"><span className="text-text-secondary">Ancora da pagare</span><span className="text-error font-bold">{formatCurrency(cp.remainingBalance)}</span></div>
              )}
              <div className="w-full h-2 rounded-full bg-bg-tertiary overflow-hidden">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${((cp.totalPaid || cp.pricePaid) / cp.pricePaid) * 100}%` }} />
              </div>
              <p className="text-[10px] text-text-muted text-center">{Math.round(((cp.totalPaid || cp.pricePaid) / cp.pricePaid) * 100)}% pagato</p>
            </div>

            {/* Payment History */}
            {cp.payments && cp.payments.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">📋 Storico Pagamenti</p>
                <div className="space-y-1.5">
                  {cp.payments.map((p, i) => (
                    <div key={p.id || i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/10">
                      <span className="text-sm">{p.method === 'Carta' ? '💳' : p.method === 'Contanti' ? '💵' : p.method === 'Satispay' ? '📱' : '🏦'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary">{formatCurrency(p.amount)} • {p.method}</p>
                        <p className="text-[10px] text-text-muted">{new Date(p.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })} • {p.operator}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">📅 Storico Sedute</p>
            {/* Timeline */}
            <div className="space-y-0">
              {cp.history.map((h, i) => (
                <div key={i} className="flex items-start gap-3 relative">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-success/15 flex items-center justify-center text-success text-[10px] font-bold flex-shrink-0">{i + 1}</div>
                    {i < cp.history.length - 1 && <div className="w-0.5 h-8 bg-border/50" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-text-primary">{new Date(h.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <p className="text-xs text-text-muted">{h.operator}{h.note ? ` • ${h.note}` : ''}</p>
                  </div>
                </div>
              ))}
              {cp.usedSessions < cp.totalSessions && (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-bg-tertiary border-2 border-dashed border-border flex items-center justify-center text-text-muted text-[10px] font-bold flex-shrink-0">{cp.usedSessions + 1}</div>
                  <p className="text-xs text-text-muted pt-1">Prossima seduta</p>
                </div>
              )}
            </div>
          </div>
          <div className="px-6 py-3 border-t border-border bg-bg-tertiary/30 space-y-2">
            {(cp.remainingBalance || 0) > 0 && onAddPayment && (
              <button onClick={onAddPayment}
                className="w-full py-2.5 rounded-xl gradient-accent text-white text-sm font-semibold shadow-lg shadow-accent/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                <Euro className="w-4 h-4" /> Aggiungi Pagamento • {formatCurrency(cp.remainingBalance)} da saldare
              </button>
            )}
            <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Chiudi</button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ========== ACTIVATE PACKAGE MODAL ========== */
function ActivatePackageModal({ pkg, onClose, onActivate }: {
  pkg: PackageItem; onClose: () => void;
  onActivate: (clientName: string, validityMonths: number, firstPayment: number, method: 'Carta' | 'Contanti' | 'Satispay' | 'Bonifico', operator: string, plan: 'full' | 'installments') => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [validityMonths, setValidityMonths] = useState('12');
  const [showDropdown, setShowDropdown] = useState(false);
  const [step, setStep] = useState<'client' | 'payment' | 'done'>('client');
  const [paymentPlan, setPaymentPlan] = useState<'full' | 'installments'>('full');
  const [firstPayment, setFirstPayment] = useState(String(pkg.price));
  const [paymentMethod, setPaymentMethod] = useState<'Carta' | 'Contanti' | 'Satispay' | 'Bonifico'>('Carta');
  const [operator, setOperator] = useState('Sara Rossi');
  const operators = ['Sara Rossi', 'Valentina Bianchi', 'Chiara Moretti', 'Francesca Romano', 'Alessia Conti'];

  const allClients = useClientStore(s => s.clients);
  const filtered = useMemo(() => {
    if (!search.trim()) return allClients.slice(0, 8);
    const q = search.toLowerCase();
    return allClients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)).slice(0, 8);
  }, [search, allClients]);

  const payAmount = Number(firstPayment) || 0;
  const remaining = pkg.price - payAmount;

  const handleConfirm = () => {
    if (!selectedClient || payAmount <= 0) return;
    onActivate(selectedClient, Number(validityMonths), payAmount, paymentMethod, operator, paymentPlan);
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
              <h3 className="text-base font-display font-semibold text-text-primary">Attiva Pacchetto</h3>
              <div className="flex gap-1 mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${step === 'client' ? 'bg-accent/15 text-accent' : 'text-text-muted'}`}>1. Cliente</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${step === 'payment' ? 'bg-accent/15 text-accent' : 'text-text-muted'}`}>2. Pagamento</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {step === 'client' ? (
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary border border-border/50">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${pkg.color}15`, color: pkg.color }}><Package className="w-4 h-4" /></div>
                  <div><p className="text-sm font-semibold text-text-primary">{pkg.name}</p><p className="text-xs text-text-muted">{pkg.totalSessions} sedute • {formatCurrency(pkg.price)}</p></div>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Cliente *</label>
                  {selectedClient ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary border border-border">
                      <User className="w-4 h-4 text-accent" /><span className="text-sm font-medium text-text-primary flex-1">{selectedClient}</span>
                      <button onClick={() => { setSelectedClient(''); setSearch(''); }} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)}
                          placeholder="Cerca cliente..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                      {showDropdown && (
                        <div className="absolute left-0 right-0 mt-1 bg-bg-tertiary border border-border rounded-xl shadow-xl z-10 max-h-40 overflow-y-auto">
                          {filtered.map(c => (
                            <button key={c.id} onClick={() => { setSelectedClient(`${c.firstName} ${c.lastName}`); setShowDropdown(false); setSearch(''); }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors text-left text-sm text-text-primary">{c.firstName} {c.lastName}</button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
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
                <div className="p-3 rounded-xl bg-bg-tertiary border border-border/50">
                  <p className="text-xs text-text-muted">Cliente: <span className="text-text-primary font-medium">{selectedClient}</span></p>
                  <p className="text-xs text-text-muted">Pacchetto: <span className="text-text-primary font-medium">{pkg.name}</span></p>
                  <p className="text-xs text-text-muted">Totale: <span className="text-accent font-bold">{formatCurrency(pkg.price)}</span></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Modalità di Pagamento</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setPaymentPlan('full'); setFirstPayment(String(pkg.price)); }}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${paymentPlan === 'full' ? 'border-success bg-success/5' : 'border-border hover:border-border-light'}`}>
                      <p className={`text-sm font-semibold ${paymentPlan === 'full' ? 'text-success' : 'text-text-primary'}`}>💰 Saldo Totale</p>
                      <p className="text-[10px] text-text-muted mt-0.5">Paga tutto subito</p>
                    </button>
                    <button onClick={() => { setPaymentPlan('installments'); setFirstPayment(''); }}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${paymentPlan === 'installments' ? 'border-warning bg-warning/5' : 'border-border hover:border-border-light'}`}>
                      <p className={`text-sm font-semibold ${paymentPlan === 'installments' ? 'text-warning' : 'text-text-primary'}`}>📋 Rate / Acconto</p>
                      <p className="text-[10px] text-text-muted mt-0.5">Paga in più volte</p>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">{paymentPlan === 'full' ? 'Importo' : 'Acconto / Prima Rata'} *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">€</span>
                    <input type="number" value={firstPayment} onChange={e => setFirstPayment(e.target.value)} max={pkg.price} min={1} placeholder={String(pkg.price)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                  </div>
                  {paymentPlan === 'installments' && remaining > 0 && payAmount > 0 && (
                    <div className="mt-2 p-3 rounded-xl bg-warning/5 border border-warning/20">
                      <div className="flex justify-between text-sm"><span className="text-text-secondary">Acconto oggi</span><span className="text-success font-bold">{formatCurrency(payAmount)}</span></div>
                      <div className="flex justify-between text-sm mt-1"><span className="text-text-secondary">Restante da pagare</span><span className="text-error font-bold">{formatCurrency(remaining)}</span></div>
                      <div className="w-full h-2 rounded-full bg-bg-tertiary mt-2 overflow-hidden">
                        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(payAmount / pkg.price) * 100}%` }} />
                      </div>
                      <p className="text-[10px] text-text-muted mt-1 text-center">{Math.round((payAmount / pkg.price) * 100)}% pagato</p>
                    </div>
                  )}
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
                <h3 className="text-xl font-display font-bold text-text-primary mb-1">Pacchetto Attivato!</h3>
                <p className="text-sm text-text-secondary mb-2">{selectedClient} • {pkg.name}</p>
                <div className="space-y-1 text-sm">
                  <p className="text-success font-semibold">Pagato: {formatCurrency(payAmount)} ({paymentMethod})</p>
                  {remaining > 0 && <p className="text-error font-semibold">Restante: {formatCurrency(remaining)}</p>}
                  <p className="text-text-muted text-xs">Registrato da: {operator}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-bg-tertiary/30 flex-shrink-0">
            {step === 'client' ? (
              <>
                <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
                <button onClick={() => { if (selectedClient) setStep('payment'); }} disabled={!selectedClient}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${selectedClient ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
                  Avanti → Pagamento
                </button>
              </>
            ) : step === 'payment' ? (
              <>
                <button onClick={() => setStep('client')} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">← Indietro</button>
                <button onClick={handleConfirm} disabled={payAmount <= 0 || payAmount > pkg.price}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${payAmount > 0 && payAmount <= pkg.price ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
                  <CheckCircle className="w-4 h-4" /> Conferma • {formatCurrency(payAmount)}
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



/* ========== ADD PACKAGE MODAL ========== */
function AddPackageModal({ onClose, onSave }: { onClose: () => void; onSave: (p: PackageItem) => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [totalSessions, setTotalSessions] = useState('10');
  const [treatmentName, setTreatmentName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#8B5CF6');
  const canSave = name.trim() && price && totalSessions;
  const pricePerSession = Number(price) && Number(totalSessions) ? Number(price) / Number(totalSessions) : 0;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-lg bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-lg font-display font-semibold text-text-primary">Nuovo Pacchetto</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Nome pacchetto *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Es. Pacchetto Anti-Age 10 Sedute"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Trattamento associato</label>
              <input type="text" value={treatmentName} onChange={e => setTreatmentName(e.target.value)} placeholder="Es. Trattamento Anti-Age Premium"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Prezzo totale (€) *</label>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Numero sedute *</label>
                <input type="number" value={totalSessions} onChange={e => setTotalSessions(e.target.value)} placeholder="10" min="1"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            {pricePerSession > 0 && (
              <div className="p-3 rounded-xl bg-success/5 border border-success/20 text-center">
                <p className="text-sm font-semibold text-success">{formatCurrency(Math.round(pricePerSession))} / seduta</p>
              </div>
            )}
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Descrizione</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Cosa include..."
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all resize-none" /></div>
            <div><label className="block text-sm font-medium text-text-secondary mb-2">Colore</label>
              <div className="flex gap-2">{PKG_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-bg-secondary ring-accent scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />
              ))}</div></div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
            <button onClick={() => { if (!canSave) return; onSave({ id: `pkg-${Date.now()}`, name: name.trim(), type: 'Sessioni', price: Number(price), totalSessions: Number(totalSessions), sold: 0, color, description, treatmentName: treatmentName.trim() || undefined }); onClose(); }}
              disabled={!canSave} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canSave ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
              <CheckCircle className="w-4 h-4" /> Crea Pacchetto
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
/* ========== ADD PAYMENT INNER ========== */
function AddPaymentInner({ cp, onClose, onPay }: {
  cp: ClientPackage; onClose: () => void;
  onPay: (amount: number, method: 'Carta' | 'Contanti' | 'Satispay' | 'Bonifico', operator: string) => void;
}) {
  const [amount, setAmount] = useState(String(cp.remainingBalance || 0));
  const [method, setMethod] = useState<'Carta' | 'Contanti' | 'Satispay' | 'Bonifico'>('Carta');
  const [operator, setOperator] = useState('Sara Rossi');
  const operators = ['Sara Rossi', 'Valentina Bianchi', 'Chiara Moretti', 'Francesca Romano', 'Alessia Conti'];
  const payAmount = Number(amount) || 0;
  const newRemaining = Math.max(0, (cp.remainingBalance || 0) - payAmount);

  return (
    <div className="w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-base font-display font-semibold text-text-primary">Aggiungi Pagamento</h3>
          <p className="text-xs text-text-muted">{cp.clientName} • {cp.packageName}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="p-3 rounded-xl bg-error/5 border border-error/20">
          <div className="flex justify-between text-sm"><span className="text-text-secondary">Da incassare</span><span className="text-error font-bold">{formatCurrency(cp.remainingBalance || 0)}</span></div>
          <div className="flex justify-between text-sm mt-1"><span className="text-text-secondary">Già pagato</span><span className="text-success font-medium">{formatCurrency(cp.totalPaid || 0)}</span></div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Importo pagamento *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">€</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} max={cp.remainingBalance || 0} min={1}
              className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
          </div>
          {payAmount > 0 && payAmount < (cp.remainingBalance || 0) && (
            <p className="text-[10px] text-warning mt-1">Rimarranno {formatCurrency(newRemaining)} da incassare</p>
          )}
          {payAmount >= (cp.remainingBalance || 0) && payAmount > 0 && (
            <p className="text-[10px] text-success mt-1">✓ Il pacchetto verrà saldato completamente</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Metodo di Pagamento</label>
          <div className="grid grid-cols-2 gap-2">
            {([['Carta', '💳'], ['Contanti', '💵'], ['Satispay', '📱'], ['Bonifico', '🏦']] as const).map(([m, icon]) => (
              <button key={m} onClick={() => setMethod(m)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all ${method === m ? 'border-accent bg-accent/5' : 'border-border hover:border-border-light'}`}>
                <span className="text-base">{icon}</span>
                <span className={`text-xs font-medium ${method === m ? 'text-accent' : 'text-text-primary'}`}>{m}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Incassato da</label>
          <select value={operator} onChange={e => setOperator(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
            {operators.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30">
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
        <button onClick={() => { if (payAmount > 0) onPay(payAmount, method, operator); }} disabled={payAmount <= 0}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${payAmount > 0 ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
          <Euro className="w-4 h-4" /> Incassa {formatCurrency(payAmount)}
        </button>
      </div>
    </div>
  );
}

/* ========== ADD LISTINO MODAL ========== */
function AddListinoModal({ onClose, onSave }: { onClose: () => void; onSave: (p: PackageItem) => void }) {
  const treatments = useTreatmentStore(s => s.treatments);
  const [name, setName] = useState('');
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [discount, setDiscount] = useState('10');
  const [color, setColor] = useState(PKG_COLORS[0]);

  const basePrice = selectedTreatments.reduce((sum, tId) => {
    const t = treatments.find(x => x.id === tId);
    return sum + (t ? t.price : 0);
  }, 0);

  const discountVal = Number(discount) || 0;
  const discountedPrice = basePrice * (1 - discountVal / 100);
  const finalPrice = Math.ceil(discountedPrice * 2) / 2;

  const handleSave = () => {
    if (!name || selectedTreatments.length === 0) return;
    const treatmentNames = selectedTreatments.map(id => treatments.find(t => t.id === id)?.name).filter(Boolean).join(', ');
    
    onSave({
      id: `listino-${Date.now()}`,
      name,
      type: 'Listino',
      price: finalPrice,
      totalSessions: selectedTreatments.length,
      sold: 0,
      color,
      treatmentName: treatmentNames,
    });
  };

  const toggleTreatment = (id: string) => {
    setSelectedTreatments(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <h3 className="text-lg font-display font-semibold text-text-primary">Nuovo Trattamento / Listino</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          
          <div className="px-6 py-5 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Nome *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="es. Listino VIP Viso"
                className="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Seleziona Base *</label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-bg-tertiary divide-y divide-border/50">
                {treatments.map(t => (
                  <label key={t.id} className="flex items-center gap-3 p-3 hover:bg-bg-hover cursor-pointer transition-colors">
                    <input type="checkbox" checked={selectedTreatments.includes(t.id)} onChange={() => toggleTreatment(t.id)} className="w-4 h-4 rounded border-border text-accent focus:ring-accent" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{t.name}</p>
                      <p className="text-xs text-text-muted">{formatCurrency(t.price)}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Sconto (%)</label>
                <div className="relative">
                  <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} min={0} max={100}
                    className="w-full pl-4 pr-8 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">%</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 flex flex-col justify-center">
                <p className="text-[10px] text-text-secondary uppercase font-semibold">Prezzo Finale</p>
                <p className="text-lg font-bold text-accent">{formatCurrency(finalPrice)}</p>
                <p className="text-[10px] text-text-muted line-through">{formatCurrency(basePrice)}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Colore Riferimento</label>
              <div className="flex gap-2">
                {PKG_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-bg-secondary ring-accent scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          
          <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30">
            <button onClick={handleSave} disabled={!name || selectedTreatments.length === 0}
              className="w-full py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              Salva
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ========== MAIN PAGE ========== */
export default function PackagesPage() {
  const { packages, clientPackages: clientPkgs, addPackage, deletePackage, activatePackage, useSession, deleteClientPackage, addPayment } = usePackageStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showListinoModal, setShowListinoModal] = useState(false);
  const [activatingPkg, setActivatingPkg] = useState<PackageItem | null>(null);
  const [usingSession, setUsingSession] = useState<ClientPackage | null>(null);
  const [viewingHistory, setViewingHistory] = useState<ClientPackage | null>(null);
  const [addingPayment, setAddingPayment] = useState<ClientPackage | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [confirmDeleteCpId, setConfirmDeleteCpId] = useState<string | null>(null);

  const filteredClientPkgs = useMemo(() => {
    let list = [...clientPkgs];
    if (filter !== 'all') list = list.filter(cp => cp.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(cp => cp.clientName.toLowerCase().includes(q) || cp.packageName.toLowerCase().includes(q));
    }
    return list;
  }, [clientPkgs, filter, search]);

  const handleActivate = (pkg: PackageItem, clientName: string, validityMonths: number, firstPayment: number, method: 'Carta' | 'Contanti' | 'Satispay' | 'Bonifico', operator: string, plan: 'full' | 'installments') => {
    activatePackage(pkg, clientName, validityMonths, firstPayment, method, operator, plan);
    setActivatingPkg(null);
  };

  const handleUseSession = (cpId: string, operator: string, note: string) => {
    useSession(cpId, operator, note);
    setUsingSession(null);
  };

  const activeCount = clientPkgs.filter(cp => cp.status === 'active' || cp.status === 'expiring').length;
  const totalRemaining = clientPkgs.filter(cp => cp.status === 'active' || cp.status === 'expiring').reduce((s, cp) => s + (cp.totalSessions - cp.usedSessions), 0);
  const totalDebt = clientPkgs.filter(cp => cp.status === 'active' || cp.status === 'expiring').reduce((s, cp) => s + (cp.remainingBalance || 0), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h2 className="text-xl font-display font-bold text-text-primary">Trattamenti e Pacchetti</h2><p className="text-sm text-text-secondary">Gestisci pacchetti a sedute e scala le visite</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all hover:scale-105"><Plus className="w-4 h-4" /> Nuovo Pacchetto</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Pacchetti Catalogo</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{packages.length}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Clienti con Pacchetto</p><p className="text-2xl font-display font-bold text-accent mt-1">{activeCount}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Sedute Rimanenti</p><p className="text-2xl font-display font-bold text-warning mt-1">{totalRemaining}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Incassato</p><p className="text-2xl font-display font-bold text-success mt-1">{formatCurrency(clientPkgs.reduce((s, cp) => s + (cp.totalPaid || cp.pricePaid), 0))}</p></div>
        <div className={`bg-bg-secondary border rounded-2xl p-5 ${totalDebt > 0 ? 'border-error/30 bg-error/[0.02]' : 'border-border'}`}><p className="text-sm text-text-secondary">Crediti da Incassare</p><p className={`text-2xl font-display font-bold mt-1 ${totalDebt > 0 ? 'text-error' : 'text-text-muted'}`}>{formatCurrency(totalDebt)}</p></div>
      </div>

      {/* Packages Grid */}
      <div>
        <h3 className="text-base font-display font-semibold text-text-primary mb-3">Catalogo Pacchetti</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {packages.map(pkg => (
            <div key={pkg.id} className="bg-bg-secondary border border-border rounded-2xl p-5 hover:border-border-light transition-all group relative">
              <button onClick={() => deletePackage(pkg.id)} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
              <div className="p-2.5 rounded-xl w-fit mb-3" style={{ backgroundColor: `${pkg.color}15`, color: pkg.color }}><Package className="w-5 h-5" /></div>
              <h4 className="text-sm font-semibold text-text-primary mb-1 line-clamp-2">{pkg.name}</h4>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-lg font-display font-bold text-text-primary">{formatCurrency(pkg.price)}</span>
              </div>
              <p className="text-xs text-text-muted mb-3">{pkg.totalSessions} sedute • {formatCurrency(Math.round(pkg.price / pkg.totalSessions))}/sed.</p>
              <button onClick={() => setActivatingPkg(pkg)}
                className="w-full py-2 rounded-xl bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors">
                Vendi a Cliente
              </button>
            </div>
          ))}
          <button onClick={() => setShowAddModal(true)} className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-border hover:border-accent/30 transition-all cursor-pointer min-h-[180px] group">
            <div className="p-3 rounded-xl bg-bg-tertiary group-hover:bg-accent/10 transition-colors"><Plus className="w-6 h-6 text-text-muted group-hover:text-accent transition-colors" /></div>
            <span className="text-sm font-medium text-text-muted group-hover:text-text-primary transition-colors">Nuovo Pacchetto</span>
          </button>
        </div>
      </div>

      {/* Client Packages */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-display font-semibold text-text-primary">Pacchetti Clienti</h3>
          <div className="flex items-center gap-2">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all w-40" /></div>
            <div className="flex gap-1">
              {([['all','Tutti'],['active','Attivi'],['expiring','In Scad.'],['completed','Finiti']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setFilter(val)} className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${filter === val ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-secondary'}`}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="divide-y divide-border/30">
          {filteredClientPkgs.map(cp => {
            const sessionsLeft = cp.totalSessions - cp.usedSessions;
            const isCompleted = cp.status === 'completed';
            return (
              <div key={cp.id} className="flex items-center gap-3 px-5 py-4 hover:bg-bg-hover/50 transition-colors group">
                <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: cp.packageColor }} />
                <button onClick={() => setViewingHistory(cp)} className="flex-1 min-w-0 text-left cursor-pointer hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary hover:text-accent transition-colors">{cp.clientName}</p>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                      isCompleted ? 'bg-bg-tertiary text-text-muted' : cp.status === 'expiring' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                    }`}>{isCompleted ? 'Completato' : cp.status === 'expiring' ? 'Ultime sedute' : 'Attivo'}</span>
                  </div>
                  <p className="text-xs text-text-muted">{cp.packageName} <span className="text-accent/60 ml-1">— Clicca per storico sedute</span></p>
                </button>
                <div className="hidden sm:flex items-center gap-1.5 w-32">
                  {Array.from({ length: Math.min(cp.totalSessions, 12) }, (_, i) => (
                    <div key={i} className={`flex-1 h-2 rounded-full ${i < cp.usedSessions ? 'bg-success' : 'bg-bg-tertiary'}`} />
                  ))}
                  {cp.totalSessions > 12 && <span className="text-[9px] text-text-muted">...</span>}
                </div>
                <div className="text-right min-w-[90px]">
                  <p className={`text-sm font-bold ${isCompleted ? 'text-text-muted' : sessionsLeft <= 2 ? 'text-warning' : 'text-text-primary'}`}>
                    {sessionsLeft}/{cp.totalSessions}
                  </p>
                  <p className="text-[10px] text-text-muted">rimanenti</p>
                </div>
                <div className="text-right min-w-[80px]">
                  {(cp.remainingBalance || 0) > 0 ? (
                    <>
                      <p className="text-xs font-bold text-error">⚠ {formatCurrency(cp.remainingBalance)}</p>
                      <p className="text-[10px] text-text-muted">da incassare</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-success">✓ Saldato</p>
                      <p className="text-[10px] text-text-muted">{formatCurrency(cp.totalPaid || cp.pricePaid)}</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setViewingHistory(cp)} className="p-2 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-all" title="Storico">
                    <History className="w-4 h-4" />
                  </button>
                  {!isCompleted && (cp.remainingBalance || 0) > 0 && (
                    <button onClick={() => setAddingPayment(cp)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition-colors">
                      <Euro className="w-3 h-3" /> Paga Rata
                    </button>
                  )}
                  {!isCompleted && (
                    <button onClick={() => setUsingSession(cp)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors">
                      <Minus className="w-3 h-3" /> Scala
                    </button>
                  )}
                  {confirmDeleteCpId === cp.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { deleteClientPackage(cp.id); setConfirmDeleteCpId(null); }}
                        className="px-2 py-1.5 rounded-lg bg-error text-white text-[10px] font-semibold hover:bg-error/90 transition-colors">Conferma</button>
                      <button onClick={() => setConfirmDeleteCpId(null)}
                        className="px-2 py-1.5 rounded-lg bg-bg-tertiary text-text-muted text-[10px] font-semibold hover:bg-bg-hover transition-colors">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteCpId(cp.id)} className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all" title="Elimina">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filteredClientPkgs.length === 0 && (
            <div className="text-center py-10"><p className="text-text-muted">Nessun pacchetto cliente trovato</p></div>
          )}
        </div>
      </div>

      {/* Treatments Section */}
      <TreatmentsSection />

      {/* Modals */}
      <AnimatePresence>{showAddModal && <AddPackageModal onClose={() => setShowAddModal(false)} onSave={p => { addPackage(p); setShowAddModal(false); }} />}</AnimatePresence>
      <AnimatePresence>{showListinoModal && <AddListinoModal onClose={() => setShowListinoModal(false)} onSave={p => { addPackage(p); setShowListinoModal(false); }} />}</AnimatePresence>
      <AnimatePresence>{activatingPkg && <ActivatePackageModal pkg={activatingPkg} onClose={() => setActivatingPkg(null)} onActivate={(cn, vm, fp, pm, op, pl) => handleActivate(activatingPkg, cn, vm, fp, pm, op, pl)} />}</AnimatePresence>
      <AnimatePresence>{usingSession && <UseSessionModal cp={usingSession} onClose={() => setUsingSession(null)} onConfirm={(op, note) => handleUseSession(usingSession.id, op, note)} />}</AnimatePresence>
      <AnimatePresence>{viewingHistory && <HistoryModal cp={viewingHistory} onClose={() => setViewingHistory(null)} onAddPayment={(viewingHistory.remainingBalance || 0) > 0 ? () => { setAddingPayment(viewingHistory); setViewingHistory(null); } : undefined} />}</AnimatePresence>

      {/* Add Payment Modal */}
      <AnimatePresence>{addingPayment && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setAddingPayment(null)} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setAddingPayment(null)}>
            <AddPaymentInner cp={addingPayment} onClose={() => setAddingPayment(null)} onPay={(amount, method, operator) => { addPayment(addingPayment.id, amount, method, operator); setAddingPayment(null); }} />
          </motion.div>
        </>
      )}</AnimatePresence>
    </motion.div>
  );
}

