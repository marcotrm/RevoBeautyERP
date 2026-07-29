'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote, Vault, ArrowDownCircle, ArrowUpCircle, Loader2, X, Trash2,
  Moon, Wallet, Info, AlertTriangle, CheckCircle, Ban, Search,
} from 'lucide-react';
import {
  getCashRegister, addCashMovement, deleteCashMovement, closeDayCash,
  type CashRegisterState, type CashKind,
} from '@/app/actions/cassa';
import { CATEGORY_LABELS } from '@/lib/cashCategories';
import { withdrawCassa } from '@/app/actions/cassaforte';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatCurrency } from '@/lib/helpers';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

const IN_CATS = ['fondo', 'entrata', 'altro'];
const OUT_CATS = ['spesa', 'prelievo', 'altro'];

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all';

export default function CassaContantiPage() {
  const user = useAuthStore(s => s.user);
  const operatorName = user ? `${user.firstName} ${user.lastName}`.trim() : '';

  const [state, setState] = useState<CashRegisterState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [modal, setModal] = useState<null | CashKind | 'close' | 'safe'>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('spesa');
  const [note, setNote] = useState('');
  const [counted, setCounted] = useState('');
  const [keep, setKeep] = useState('');

  // Filtri della cronologia (per controllare chi fa cosa)
  const [fType, setFType] = useState<'all' | 'in' | 'out' | 'vendita' | 'versamento'>('all');
  const [fOperator, setFOperator] = useState('all');
  const [fSearch, setFSearch] = useState('');
  const [fDate, setFDate] = useState('');

  const load = useCallback(async () => {
    try { setState(await getCashRegister()); }
    catch (e) { console.error(e); setMsg({ kind: 'err', text: 'Impossibile caricare la cassa.' }); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Saldo e movimenti sempre aggiornati (anche se incassa un'altra postazione)
  useAutoRefresh(load, 20000);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const openModal = (m: CashKind | 'close' | 'safe') => {
    setAmount(''); setNote(''); setCounted(''); setKeep('');
    setCategory(m === 'in' ? 'entrata' : 'spesa');
    setModal(m);
  };

  const saveMovement = async (kind: CashKind) => {
    setBusy(true);
    try {
      const res = await addCashMovement({ kind, amount: Number(amount), category, note, operator: operatorName });
      if (!res.ok) { flash('err', res.error || 'Errore'); return; }
      setModal(null);
      await load();
      flash('ok', kind === 'in' ? 'Entrata registrata' : 'Uscita registrata');
    } finally { setBusy(false); }
  };

  const doClose = async () => {
    setBusy(true);
    try {
      const res = await closeDayCash({ countedCash: Number(counted), keepInTill: Number(keep || 0), operator: operatorName, note });
      if (!res.ok) { flash('err', res.error || 'Errore'); return; }
      setModal(null);
      await load();
      const diff = res.difference;
      flash('ok', `Chiusura registrata. Versati in cassaforte ${formatCurrency(res.toSafe)}.` +
        (Math.abs(diff) >= 0.01 ? ` Differenza rilevata: ${diff > 0 ? '+' : ''}${formatCurrency(diff)}.` : ' Conteggio perfetto.'));
    } finally { setBusy(false); }
  };

  const doSafeWithdraw = async () => {
    setBusy(true);
    try {
      const res = await withdrawCassa(Number(amount), note);
      if (!res.ok) { flash('err', res.error === 'insufficient' ? 'Importo superiore al saldo in cassaforte.' : 'Importo non valido.'); return; }
      setModal(null);
      await load();
      flash('ok', 'Prelievo dalla cassaforte registrato');
    } finally { setBusy(false); }
  };

  const removeMovement = async (id: string) => {
    if (!confirm('Annullare questo movimento? Resterà visibile nella cronologia, barrato, con il tuo nome.')) return;
    await deleteCashMovement(id, operatorName);
    await load();
  };

  if (!state) {
    return <div className="flex items-center justify-center py-20 text-text-muted"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento cassa...</div>;
  }

  // Operatrici presenti nella cronologia, per il filtro
  const operators = Array.from(new Set(state.ledger.map(r => r.operator).filter(Boolean))).sort();

  // Cronologia filtrata
  const filteredLedger = state.ledger.filter(r => {
    if (fType === 'in' && !(r.source === 'manuale' && r.amount >= 0)) return false;
    if (fType === 'out' && !(r.source === 'manuale' && r.amount < 0)) return false;
    if (fType === 'vendita' && r.source !== 'vendita') return false;
    if (fType === 'versamento' && r.source !== 'cassaforte') return false;
    if (fOperator !== 'all' && r.operator !== fOperator) return false;
    if (fDate && r.date !== fDate) return false;
    if (fSearch.trim()) {
      const q = fSearch.toLowerCase();
      if (!`${r.label} ${r.detail} ${r.operator}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Riepilogo dei movimenti mostrati (per il set filtrato)
  const sumIn = filteredLedger.filter(r => !r.cancelled && r.amount >= 0).reduce((s, r) => s + r.amount, 0);
  const sumOut = filteredLedger.filter(r => !r.cancelled && r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
  const cancelledCount = filteredLedger.filter(r => r.cancelled).length;
  const filtersActive = fType !== 'all' || fOperator !== 'all' || !!fSearch.trim() || !!fDate;

  const cards = [
    { label: 'In cassa adesso', value: state.balance, icon: Wallet, color: '#22C55E', hint: 'Contanti che devono trovarsi nel cassetto in questo momento.' },
    { label: 'Incassi contanti oggi', value: state.todayIncome, icon: Banknote, color: '#3B82F6', hint: 'Vendite in contanti registrate oggi in cassa.' },
    { label: 'Entrate manuali oggi', value: state.todayIn, icon: ArrowDownCircle, color: '#8B5CF6', hint: 'Fondo cassa e altre entrate registrate a mano oggi.' },
    { label: 'Uscite oggi', value: state.todayOut, icon: ArrowUpCircle, color: '#F59E0B', hint: 'Spese e prelievi dal cassetto registrati oggi.' },
    { label: 'In cassaforte', value: state.safeBalance, icon: Vault, color: '#EC4899', hint: 'Contanti custoditi in cassaforte (versamenti meno prelievi).' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Cassa Contanti</h2>
          <p className="text-sm text-text-secondary">Ogni euro che entra o esce dal cassetto, con la cronologia completa.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => openModal('in')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success/10 text-success border border-success/20 text-sm font-medium hover:bg-success/20 transition-colors">
            <ArrowDownCircle className="w-4 h-4" /> Entrata
          </button>
          <button onClick={() => openModal('out')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-error/10 text-error border border-error/20 text-sm font-medium hover:bg-error/20 transition-colors">
            <ArrowUpCircle className="w-4 h-4" /> Uscita
          </button>
          <button onClick={() => openModal('safe')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-text-primary text-sm font-medium hover:bg-bg-hover transition-colors">
            <Vault className="w-4 h-4" /> Preleva da cassaforte
          </button>
          <button onClick={() => openModal('close')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:scale-105 transition-all">
            <Moon className="w-4 h-4" /> Chiusura serale
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm border flex items-center gap-2 ${msg.kind === 'ok' ? 'bg-success/10 border-success/20 text-success' : 'bg-error/10 border-error/20 text-error'}`}>
          {msg.kind === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {msg.text}
        </div>
      )}

      {/* Riepilogo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-bg-secondary border border-border rounded-2xl p-4" title={c.hint}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.color}18`, color: c.color }}>
                  <Icon className="w-4 h-4" />
                </div>
                <Info className="w-3 h-3 text-text-muted ml-auto" />
              </div>
              <p className="text-xl font-display font-bold text-text-primary">{formatCurrency(c.value)}</p>
              <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mt-0.5">{c.label}</p>
            </div>
          );
        })}
      </div>

      {/* Cronologia */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-base font-display font-semibold text-text-primary">Cronologia entrate e uscite</h3>
            <span className="text-xs text-text-muted">
              {filteredLedger.length}{filtersActive ? ` su ${state.ledger.length}` : ''} movimenti
            </span>
          </div>

          {/* Filtri di controllo */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input type="text" value={fSearch} onChange={e => setFSearch(e.target.value)}
                placeholder="Cerca cliente, nota…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
            </div>
            <select value={fOperator} onChange={e => setFOperator(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary focus:outline-none focus:border-accent/50 appearance-none">
              <option value="all">Tutte le operatrici</option>
              {operators.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary focus:outline-none focus:border-accent/50" />
            {filtersActive && (
              <button onClick={() => { setFType('all'); setFOperator('all'); setFSearch(''); setFDate(''); }}
                className="px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover">Azzera</button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {([['all','Tutti'],['vendita','Vendite'],['in','Entrate'],['out','Uscite'],['versamento','Cassaforte']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setFType(val)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${fType === val ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-bg-hover'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Riepilogo del filtro attivo */}
          <div className="flex items-center gap-4 text-xs pt-1">
            <span className="text-success font-semibold">+ {formatCurrency(sumIn)} entrate</span>
            <span className="text-error font-semibold">− {formatCurrency(sumOut)} uscite</span>
            {cancelledCount > 0 && (
              <span className="flex items-center gap-1 text-warning font-semibold">
                <Ban className="w-3 h-3" /> {cancelledCount} annullat{cancelledCount === 1 ? 'o' : 'i'}
              </span>
            )}
          </div>
        </div>

        {filteredLedger.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-muted">
            {state.ledger.length === 0 ? 'Nessun movimento registrato.' : 'Nessun movimento con questi filtri.'}
          </p>
        ) : (
          <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
            {filteredLedger.map(row => (
              <div key={row.id} className={`flex items-center gap-3 px-5 py-3 transition-colors group ${row.cancelled ? 'bg-warning/[0.04]' : 'hover:bg-bg-hover'}`}>
                <div className={`p-2 rounded-lg flex-shrink-0 ${row.cancelled ? 'bg-warning/10 text-warning' : row.amount >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                  {row.cancelled ? <Ban className="w-4 h-4" /> : row.amount >= 0 ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium truncate ${row.cancelled ? 'text-text-muted line-through' : 'text-text-primary'}`}>{row.label}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted flex-shrink-0">{row.source}</span>
                    {row.cancelled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning flex-shrink-0 font-semibold">ANNULLATO</span>}
                  </div>
                  <p className={`text-xs truncate ${row.cancelled ? 'text-text-muted line-through' : 'text-text-muted'}`}>{row.detail || '—'}</p>
                  {row.cancelled && (
                    <p className="text-[10px] text-warning mt-0.5">
                      Annullato da {row.cancelledBy || 'sconosciuto'}{row.cancelledAt ? ` il ${new Date(row.cancelledAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${row.cancelled ? 'text-text-muted line-through' : row.amount >= 0 ? 'text-success' : 'text-error'}`}>
                    {row.amount >= 0 ? '+' : '−'} {formatCurrency(Math.abs(row.amount))}
                  </p>
                  <p className="text-[10px] text-text-muted">{row.date.split('-').reverse().join('/')}</p>
                </div>
                {row.canDelete && !row.cancelled && (
                  <button onClick={() => removeMovement(row.id)} title="Annulla movimento" className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-error/10 text-text-muted hover:text-error transition-all flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== MODALI ===== */}
      <AnimatePresence>
        {modal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="text-lg font-display font-semibold text-text-primary">
                    {modal === 'in' ? 'Registra entrata' : modal === 'out' ? 'Registra uscita' : modal === 'safe' ? 'Preleva dalla cassaforte' : 'Chiusura serale'}
                  </h3>
                  <button onClick={() => setModal(null)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 space-y-4">
                  {modal === 'close' ? (
                    <>
                      <div className="p-3 rounded-xl bg-bg-tertiary/50 border border-border/50 text-sm">
                        <div className="flex justify-between"><span className="text-text-secondary">Saldo atteso in cassa</span><span className="font-bold text-text-primary">{formatCurrency(state.balance)}</span></div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Contanti contati nel cassetto *</label>
                        <input type="number" step="0.01" min="0" value={counted} onChange={e => setCounted(e.target.value)} placeholder="es. 250,00" className={inputCls} autoFocus />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Quanto resta in cassa per domani</label>
                        <input type="number" step="0.01" min="0" value={keep} onChange={e => setKeep(e.target.value)} placeholder="es. 50,00 (fondo cassa)" className={inputCls} />
                      </div>
                      {counted !== '' && (
                        <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 space-y-1 text-sm">
                          <div className="flex justify-between"><span className="text-text-secondary">Va in cassaforte</span><span className="font-bold text-accent">{formatCurrency(Math.max(0, Number(counted) - Number(keep || 0)))}</span></div>
                          {Math.abs(Number(counted) - state.balance) >= 0.01 && (
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Differenza sul conteggio</span>
                              <span className={`font-bold ${Number(counted) - state.balance > 0 ? 'text-success' : 'text-error'}`}>
                                {Number(counted) - state.balance > 0 ? '+' : ''}{formatCurrency(Number(counted) - state.balance)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Nota</label>
                        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Facoltativa" className={inputCls} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Importo *</label>
                        <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className={inputCls} autoFocus />
                      </div>
                      {modal !== 'safe' && (
                        <div>
                          <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Motivo</label>
                          <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                            {(modal === 'in' ? IN_CATS : OUT_CATS).map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Nota</label>
                        <input type="text" value={note} onChange={e => setNote(e.target.value)}
                          placeholder={modal === 'out' ? 'es. acquisto cotone e detergenti' : 'es. fondo cassa iniziale'} className={inputCls} />
                      </div>
                    </>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30">
                  <button
                    onClick={() => modal === 'close' ? doClose() : modal === 'safe' ? doSafeWithdraw() : saveMovement(modal as CashKind)}
                    disabled={busy || (modal === 'close' ? counted === '' : !amount)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:scale-105 transition-all disabled:opacity-60 disabled:hover:scale-100">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Conferma
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
