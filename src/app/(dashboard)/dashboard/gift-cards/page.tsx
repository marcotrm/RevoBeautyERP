'use client';

import React, { useState, useMemo } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift, Plus, Search, X, CheckCircle, Copy, Trash2,
  User, Calendar, CreditCard, Eye, Download,
} from 'lucide-react';
import { formatCurrency, generateId } from '@/lib/helpers';
import { useClientStore } from '@/stores/useClientStore';

interface GiftCard {
  id: string;
  code: string;
  amount: number;
  remainingAmount: number;
  buyerName: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  message: string;
  occasion: string;
  status: 'active' | 'used' | 'expired' | 'partial';
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

const OCCASIONS = [
  { value: 'compleanno', label: '🎂 Compleanno', emoji: '🎂' },
  { value: 'natale', label: '🎄 Natale', emoji: '🎄' },
  { value: 'san_valentino', label: '❤️ San Valentino', emoji: '❤️' },
  { value: 'festa_mamma', label: '💐 Festa della Mamma', emoji: '💐' },
  { value: 'anniversario', label: '💍 Anniversario', emoji: '💍' },
  { value: 'ringraziamento', label: '🙏 Ringraziamento', emoji: '🙏' },
  { value: 'altro', label: '🎁 Altro', emoji: '🎁' },
];

const PRESET_AMOUNTS = [25, 50, 75, 100, 150, 200, 300, 500];

const GIFT_COLORS: Record<string, string> = {
  compleanno: '#EC4899', natale: '#EF4444', san_valentino: '#F43F5E',
  festa_mamma: '#A855F7', anniversario: '#F59E0B', ringraziamento: '#22C55E', altro: '#3B82F6',
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'RB-';
  for (let i = 0; i < 8; i++) { if (i === 4) code += '-'; code += chars[Math.floor(Math.random() * chars.length)]; }
  return code;
}

const defaultGiftCards: GiftCard[] = [
  { id: '1', code: 'RB-ABCD-1234', amount: 100, remainingAmount: 100, buyerName: 'Maria Colombo', recipientName: 'Laura Ferrari', message: 'Buon compleanno! Regalati un momento di bellezza 💖', occasion: 'compleanno', status: 'active', createdAt: '2026-05-20', expiresAt: '2027-05-20' },
  { id: '2', code: 'RB-EFGH-5678', amount: 50, remainingAmount: 0, buyerName: 'Anna Fontana', recipientName: 'Claudia Greco', message: 'Grazie di tutto! ❤️', occasion: 'ringraziamento', status: 'used', createdAt: '2026-04-15', expiresAt: '2027-04-15', usedAt: '2026-05-10' },
  { id: '3', code: 'RB-IJKL-9012', amount: 200, remainingAmount: 120, buyerName: 'Paola Mancini', recipientName: 'Federica Ricci', message: 'Per la festa della mamma! 💐', occasion: 'festa_mamma', status: 'partial', createdAt: '2026-05-01', expiresAt: '2027-05-01' },
  { id: '4', code: 'RB-MNOP-3456', amount: 75, remainingAmount: 75, buyerName: 'Silvia Marino', recipientName: 'Giorgia Costa', message: 'Un pensiero per te!', occasion: 'altro', status: 'active', createdAt: '2026-05-25', expiresAt: '2027-05-25' },
];

function CreateGiftCardModal({ onClose, onSave }: { onClose: () => void; onSave: (g: GiftCard) => void }) {
  const [step, setStep] = useState<'details' | 'personalize' | 'preview'>('details');
  const [buyerSearch, setBuyerSearch] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [customAmount, setCustomAmount] = useState('');
  const [occasion, setOccasion] = useState('compleanno');
  const [message, setMessage] = useState('');
  const [validity, setValidity] = useState('12');
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);

  const allClients = useClientStore(s => s.clients);
  const filteredClients = useMemo(() => {
    if (!buyerSearch.trim()) return allClients.slice(0, 5);
    const q = buyerSearch.toLowerCase();
    return allClients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)).slice(0, 5);
  }, [buyerSearch, allClients]);

  const finalAmount = amount || Number(customAmount) || 0;
  const canNext = step === 'details' ? buyerName.trim() && recipientName.trim() && finalAmount > 0
    : step === 'personalize' ? true : true;

  const color = GIFT_COLORS[occasion] || '#3B82F6';
  const occasionInfo = OCCASIONS.find(o => o.value === occasion);

  const handleSave = () => {
    const now = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + Number(validity));
    onSave({
      id: generateId(), code: generateCode(), amount: finalAmount, remainingAmount: finalAmount,
      buyerName: buyerName.trim(), recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim() || undefined, message: message.trim(),
      occasion, status: 'active',
      createdAt: now.toISOString().split('T')[0],
      expiresAt: expires.toISOString().split('T')[0],
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
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}15` }}><Gift className="w-5 h-5" style={{ color }} /></div>
              <div>
                <h3 className="text-lg font-display font-semibold text-text-primary">Nuovo Buono Regalo</h3>
                <div className="flex gap-1 mt-1">{(['details','personalize','preview'] as const).map((s, i) => (
                  <div key={s} className={`h-1 rounded-full transition-all ${step === s ? 'bg-accent w-8' : 'bg-bg-tertiary w-4'}`} />
                ))}</div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>

          <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
            {step === 'details' && (
              <>
                {/* Buyer */}
                <div className="relative">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Chi acquista *</label>
                  {buyerName ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary border border-border">
                      <User className="w-4 h-4 text-accent" /><span className="text-sm font-medium text-text-primary flex-1">{buyerName}</span>
                      <button onClick={() => { setBuyerName(''); setBuyerSearch(''); }} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input type="text" value={buyerSearch} onChange={e => { setBuyerSearch(e.target.value); setShowBuyerDropdown(true); }} onFocus={() => setShowBuyerDropdown(true)}
                          placeholder="Cerca cliente acquirente..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                      {showBuyerDropdown && (
                        <div className="absolute left-0 right-0 mt-1 bg-bg-tertiary border border-border rounded-xl shadow-xl z-10 max-h-40 overflow-y-auto">
                          {filteredClients.map(c => (
                            <button key={c.id} onClick={() => { setBuyerName(`${c.firstName} ${c.lastName}`); setShowBuyerDropdown(false); setBuyerSearch(''); }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors text-left text-sm text-text-primary">{c.firstName} {c.lastName}</button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* Recipient */}
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Destinatario (festeggiato) *</label>
                  <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Nome del festeggiato..."
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Telefono destinatario</label>
                  <input type="tel" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} placeholder="Opzionale"
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Importo *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_AMOUNTS.map(a => (
                      <button key={a} onClick={() => { setAmount(a); setCustomAmount(''); }}
                        className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${amount === a ? 'gradient-accent text-white shadow-lg shadow-accent/20' : 'bg-bg-tertiary border border-border text-text-primary hover:border-border-light'}`}>
                        {formatCurrency(a)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2"><input type="number" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setAmount(''); }}
                    placeholder="Importo personalizzato..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                </div>
              </>
            )}

            {step === 'personalize' && (
              <>
                <div><label className="block text-sm font-medium text-text-secondary mb-2">Occasione</label>
                  <div className="grid grid-cols-2 gap-2">
                    {OCCASIONS.map(o => (
                      <button key={o.value} onClick={() => setOccasion(o.value)}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${occasion === o.value ? 'border-accent bg-accent/5' : 'border-border hover:border-border-light'}`}>
                        <span className="text-lg">{o.emoji}</span>
                        <span className={`text-sm font-medium ${occasion === o.value ? 'text-accent' : 'text-text-primary'}`}>{o.label.split(' ').slice(1).join(' ')}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Messaggio personalizzato</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                    placeholder="Es. Buon compleanno! Regalati un momento di bellezza..."
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all resize-none" /></div>
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Validità</label>
                  <select value={validity} onChange={e => setValidity(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                    <option value="3">3 mesi</option><option value="6">6 mesi</option><option value="12">12 mesi</option><option value="24">24 mesi</option>
                  </select></div>
              </>
            )}

            {step === 'preview' && (
              <div className="space-y-4">
                {/* Card Preview */}
                <div className="relative overflow-hidden rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}>
                  <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10" />
                  <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Buono Regalo</span>
                      <span className="text-2xl">{occasionInfo?.emoji}</span>
                    </div>
                    <p className="text-3xl font-display font-bold">{formatCurrency(finalAmount)}</p>
                    <p className="text-sm opacity-80 mt-1">Per: {recipientName}</p>
                    {message && <p className="text-xs opacity-70 mt-3 italic">&quot;{message}&quot;</p>}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/20">
                      <span className="text-[10px] opacity-60">Da: {buyerName}</span>
                      <span className="text-xs font-mono font-semibold tracking-wider opacity-90">RB-XXXX-XXXX</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-xl bg-bg-tertiary"><p className="text-text-muted text-xs">Acquirente</p><p className="font-medium text-text-primary">{buyerName}</p></div>
                  <div className="p-3 rounded-xl bg-bg-tertiary"><p className="text-text-muted text-xs">Destinatario</p><p className="font-medium text-text-primary">{recipientName}</p></div>
                  <div className="p-3 rounded-xl bg-bg-tertiary"><p className="text-text-muted text-xs">Importo</p><p className="font-medium text-text-primary">{formatCurrency(finalAmount)}</p></div>
                  <div className="p-3 rounded-xl bg-bg-tertiary"><p className="text-text-muted text-xs">Validità</p><p className="font-medium text-text-primary">{validity} mesi</p></div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-bg-tertiary/30">
            {step === 'details' ? (
              <><button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
              <button onClick={() => setStep('personalize')} disabled={!canNext}
                className={`px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canNext ? 'gradient-accent hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>Avanti →</button></>
            ) : step === 'personalize' ? (
              <><button onClick={() => setStep('details')} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">← Indietro</button>
              <button onClick={() => setStep('preview')} className="px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:scale-105 transition-all">Anteprima →</button></>
            ) : (
              <><button onClick={() => setStep('personalize')} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">← Indietro</button>
              <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all">
                <Gift className="w-4 h-4" /> Crea Buono Regalo
              </button></>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

export default function GiftCardsPage() {
  const [giftCards, setGiftCards] = usePersistedState<GiftCard[]>('revo_gift_cards', defaultGiftCards);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'partial' | 'used' | 'expired'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...giftCards];
    if (filter !== 'all') list = list.filter(g => g.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(g => g.recipientName.toLowerCase().includes(q) || g.buyerName.toLowerCase().includes(q) || g.code.toLowerCase().includes(q));
    }
    return list;
  }, [giftCards, filter, search]);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteCard = (id: string) => setGiftCards(prev => prev.filter(g => g.id !== id));

  const totalActive = giftCards.filter(g => g.status === 'active' || g.status === 'partial').reduce((s, g) => s + g.remainingAmount, 0);
  const totalSold = giftCards.reduce((s, g) => s + g.amount, 0);

  const statusConfig: Record<string, { label: string; class: string }> = {
    active: { label: 'Attivo', class: 'bg-success/10 text-success' },
    partial: { label: 'Parziale', class: 'bg-warning/10 text-warning' },
    used: { label: 'Utilizzato', class: 'bg-bg-tertiary text-text-muted' },
    expired: { label: 'Scaduto', class: 'bg-error/10 text-error' },
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Buoni Regalo</h2>
          <p className="text-sm text-text-secondary">Crea e gestisci coupon regalo per i clienti</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all hover:scale-105">
          <Plus className="w-4 h-4" /> Nuovo Buono Regalo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Buoni Emessi</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{giftCards.length}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Valore Totale</p><p className="text-2xl font-display font-bold text-accent mt-1">{formatCurrency(totalSold)}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Saldo Attivo</p><p className="text-2xl font-display font-bold text-success mt-1">{formatCurrency(totalActive)}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Ancora Attivi</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{giftCards.filter(g => g.status === 'active' || g.status === 'partial').length}</p></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nome, codice..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
        </div>
        <div className="flex gap-1">
          {([['all','Tutti'],['active','Attivi'],['partial','Parziali'],['used','Usati'],['expired','Scaduti']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filter === val ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-transparent'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(gc => {
          const color = GIFT_COLORS[gc.occasion] || '#3B82F6';
          const pct = gc.amount > 0 ? Math.round((gc.remainingAmount / gc.amount) * 100) : 0;
          const occasionInfo = OCCASIONS.find(o => o.value === gc.occasion);
          const sc = statusConfig[gc.status];
          return (
            <div key={gc.id} className="bg-bg-secondary border border-border rounded-2xl overflow-hidden hover:border-border-light transition-all group">
              {/* Color bar */}
              <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{occasionInfo?.emoji || '🎁'}</div>
                    <div>
                      <p className="text-base font-display font-bold text-text-primary">{formatCurrency(gc.amount)}</p>
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.class}`}>{sc.label}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteCard(gc.id)} className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm"><span className="text-text-muted w-8">Da:</span><span className="text-text-primary font-medium">{gc.buyerName}</span></div>
                  <div className="flex items-center gap-2 text-sm"><span className="text-text-muted w-8">Per:</span><span className="text-text-primary font-medium">{gc.recipientName}</span></div>
                </div>

                {gc.message && <p className="text-xs text-text-secondary italic mb-3 line-clamp-2">&quot;{gc.message}&quot;</p>}

                {/* Progress */}
                {(gc.status === 'active' || gc.status === 'partial') && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-muted">Saldo rimanente</span>
                      <span className="font-semibold text-text-primary">{formatCurrency(gc.remainingAmount)}</span>
                    </div>
                    <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                )}

                {/* Code + Meta */}
                <div className="flex items-center justify-between pt-3 border-t border-border/30">
                  <button onClick={() => copyCode(gc.code, gc.id)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-bg-tertiary hover:bg-bg-hover text-xs font-mono font-semibold text-text-primary transition-colors">
                    {copiedId === gc.id ? <><CheckCircle className="w-3 h-3 text-success" /> Copiato!</> : <><Copy className="w-3 h-3 text-text-muted" /> {gc.code}</>}
                  </button>
                  <span className="text-[10px] text-text-muted flex items-center gap-1"><Calendar className="w-3 h-3" /> Scade {gc.expiresAt}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add card */}
        <button onClick={() => setShowModal(true)} className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-border hover:border-accent/30 transition-all cursor-pointer min-h-[200px] group">
          <div className="p-4 rounded-2xl bg-bg-tertiary group-hover:bg-accent/10 transition-colors"><Gift className="w-8 h-8 text-text-muted group-hover:text-accent transition-colors" /></div>
          <span className="text-sm font-medium text-text-muted group-hover:text-text-primary transition-colors">Crea Buono Regalo</span>
        </button>
      </div>

      {filtered.length === 0 && !showModal && (
        <div className="text-center py-12 bg-bg-secondary border border-border rounded-2xl">
          <Gift className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary font-medium">Nessun buono regalo trovato</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-sm text-accent font-medium hover:underline">Crea il primo buono</button>
        </div>
      )}

      <AnimatePresence>{showModal && <CreateGiftCardModal onClose={() => setShowModal(false)} onSave={g => { setGiftCards(prev => [g, ...prev]); setShowModal(false); }} />}</AnimatePresence>
    </motion.div>
  );
}
