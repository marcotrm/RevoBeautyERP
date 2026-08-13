'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, CheckCircle, X, Search, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { useAccountsStore, GestionaleAccount } from '@/stores/useAccountsStore';
import { useRolesStore } from '@/stores/useRolesStore';
import { getInitials } from '@/lib/helpers';
import { NO_AUTOFILL } from '@/lib/noAutofill';
import { maiuscoleNome } from '@/lib/nomiPropri';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
  active: boolean;
};

const emptyForm = (defaultRoleId: string): FormState => ({
  firstName: '', lastName: '', email: '', password: '', roleId: defaultRoleId, active: true,
});

export function AccountsSection() {
  const { accounts, loaded, isLoading, fetchAccounts, addAccount, updateAccount, deleteAccount, toggleActive } = useAccountsStore();
  const { roles, loaded: rolesLoaded, fetchRoles } = useRolesStore();
  const [search, setSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GestionaleAccount | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm(roles[0]?.id ?? ''));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loaded) fetchAccounts();
    if (!rolesLoaded) fetchRoles();
  }, [loaded, rolesLoaded, fetchAccounts, fetchRoles]);

  const filtered = accounts.filter(a =>
    `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const roleFor = (roleId: string) => roles.find(r => r.id === roleId);

  const handleOpenModal = (account?: GestionaleAccount) => {
    setError('');
    setShowPassword(false);
    if (account) {
      setEditingAccount(account);
      setFormData({
        firstName: account.firstName, lastName: account.lastName, email: account.email,
        password: account.password, roleId: account.roleId, active: account.active,
      });
    } else {
      setEditingAccount(null);
      setFormData(emptyForm(roles[0]?.id ?? ''));
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.email.trim() || !formData.password.trim() || !formData.roleId) {
      setError('Compila nome, email, password e permesso.');
      return;
    }
    const duplicate = accounts.find(a =>
      a.email.toLowerCase() === formData.email.toLowerCase() && a.id !== editingAccount?.id
    );
    if (duplicate) {
      setError('Esiste già un account con questa email.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, { ...formData });
      } else {
        await addAccount({ ...formData });
      }
      setShowModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account: GestionaleAccount) => {
    if (!confirm(`Eliminare l'account di ${account.firstName}?`)) return;
    try {
      await deleteAccount(account.id);
    } catch {
      alert('Errore durante l\'eliminazione.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            {...NO_AUTOFILL} placeholder="Cerca account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:shadow-lg hover:shadow-accent/20 hover:scale-105 transition-all"
        >
          <Plus className="w-4 h-4" /> Nuovo Account
        </button>
      </div>

      {/* List */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden divide-y divide-border/30">
        {isLoading && !loaded && (
          <div className="px-6 py-10 flex items-center justify-center gap-2 text-sm text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Caricamento account...
          </div>
        )}
        {loaded && filtered.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-text-muted">Nessun account trovato.</div>
        )}
        {filtered.map(account => {
          const role = roleFor(account.roleId);
          return (
            <div key={account.id} className="flex items-center gap-4 px-6 py-4 hover:bg-bg-hover transition-colors">
              <div className="w-9 h-9 rounded-full gradient-accent flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">{getInitials(account.firstName, account.lastName)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {account.firstName} {account.lastName}
                  </p>
                  {!account.active && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted">DISATTIVATO</span>
                  )}
                </div>
                <p className="text-xs text-text-secondary truncate">{account.email}</p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: `${role?.color ?? '#888'}15` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: role?.color ?? '#888' }} />
                <span className="text-xs font-medium" style={{ color: role?.color ?? '#888' }}>{role?.name ?? 'Ruolo eliminato'}</span>
              </div>
              {/* Active toggle */}
              <button
                onClick={() => toggleActive(account.id)}
                title={account.active ? 'Disattiva accesso' : 'Attiva accesso'}
                className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${account.active ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${account.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <button onClick={() => handleOpenModal(account)} className="p-2 rounded-lg bg-bg-tertiary text-text-muted hover:text-accent hover:bg-accent/10 transition-colors flex-shrink-0">
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(account)}
                className="p-2 rounded-lg bg-bg-tertiary text-text-muted hover:text-error hover:bg-error/10 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-[61] flex items-center justify-center sm:p-4 pointer-events-none">
              <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-md bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                  <h3 className="text-lg font-display font-semibold text-text-primary">{editingAccount ? 'Modifica Account' : 'Nuovo Account'}</h3>
                  <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary transition-colors"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                  {error && (
                    <div className="px-3 py-2 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-medium">{error}</div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Nome</label>
                      <input type="text" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: maiuscoleNome(e.target.value) })} placeholder="Nome"
                        className="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Cognome</label>
                      <input type="text" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: maiuscoleNome(e.target.value) })} placeholder="Cognome"
                        className="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="nome@revobeauty.it"
                      className="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••"
                        className="w-full px-4 pr-11 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors" />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Tipo di permesso</label>
                    <select value={formData.roleId} onChange={e => setFormData({ ...formData, roleId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors">
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <p className="text-[11px] text-text-muted mt-1.5 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Gestisci i permessi di ogni ruolo in &quot;Ruoli e Permessi&quot;
                    </p>
                  </div>

                  <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-tertiary/50 border border-border/30 cursor-pointer">
                    <button type="button" onClick={() => setFormData({ ...formData, active: !formData.active })}
                      className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${formData.active ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${formData.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-sm text-text-secondary">Accesso al gestionale attivo</span>
                  </label>
                </div>

                <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30 flex-shrink-0">
                  <button onClick={handleSave} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all disabled:opacity-60 disabled:hover:scale-100">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {editingAccount ? 'Salva Modifiche' : 'Crea Account'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
