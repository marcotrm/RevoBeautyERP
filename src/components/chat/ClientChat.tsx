'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { getInitials } from '@/lib/helpers';

const WAIT_ALERT_MS = 10 * 60 * 1000; // 10 minuti

type Conversation = { clientId: string; clientName: string; lastBody: string; lastAt: string; lastSender: string; unread: number; oldestUnreadAt: string | null };
type Message = { id: string; clientId: string; clientName: string; sender: string; body: string; operatorName?: string | null; createdAt: string };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return getInitials(parts[0] || '', parts[1] || '');
}

export default function ClientChat() {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [alertConv, setAlertConv] = useState<Conversation | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const user = useAuthStore(s => s.user);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const activeConv = conversations.find(c => c.clientId === activeId);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations');
      const data = await res.json();
      setConversations(data.conversations || []);
      setTotalUnread(data.totalUnread || 0);
    } catch { /* offline: mantieni lo stato */ }
  }, []);

  const loadThread = useCallback(async (clientId: string) => {
    try {
      const res = await fetch(`/api/chat/thread?clientId=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      setThread(data.messages || []);
    } catch { /* noop */ }
  }, []);

  // Badge: aggiorna le conversazioni ogni 8s
  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, 8000);
    return () => clearInterval(t);
  }, [loadConversations]);

  // Polling della conversazione aperta ogni 5s
  useEffect(() => {
    if (!open || !activeId) return;
    loadThread(activeId);
    const t = setInterval(() => loadThread(activeId), 5000);
    return () => clearInterval(t);
  }, [open, activeId, loadThread]);

  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread]);

  // Avviso: cliente in attesa da oltre 10 minuti senza risposta
  useEffect(() => {
    // reset dei "già avvisati" per conversazioni ora risolte
    for (const id of Array.from(dismissedRef.current)) {
      const conv = conversations.find(c => c.clientId === id);
      if (!conv || conv.unread === 0) dismissedRef.current.delete(id);
    }
    // chiudi il popup se la conversazione è stata gestita
    setAlertConv(prev => {
      if (!prev) return prev;
      const still = conversations.find(c => c.clientId === prev.clientId);
      return (!still || still.unread === 0) ? null : prev;
    });
    // cerca una conversazione in ritardo (>10 min) non ancora avvisata né aperta
    const overdue = conversations.find(c =>
      c.unread > 0 && c.oldestUnreadAt &&
      (Date.now() - new Date(c.oldestUnreadAt).getTime()) > WAIT_ALERT_MS &&
      !dismissedRef.current.has(c.clientId) &&
      c.clientId !== activeId
    );
    if (overdue) setAlertConv(prev => prev ?? overdue);
  }, [conversations, activeId]);

  const openConversation = async (clientId: string) => {
    setActiveId(clientId);
    await loadThread(clientId);
    await fetch('/api/chat/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }) }).catch(() => {});
    loadConversations();
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeConv) return;
    setSending(true);
    const clientId = activeConv.clientId;
    try {
      await fetch('/api/chat/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, clientName: activeConv.clientName, sender: 'operator', body: reply.trim(),
          operatorName: user ? `${user.firstName} ${user.lastName}` : 'Operatrice',
        }),
      });
      setReply('');
      await loadThread(clientId);
      loadConversations();
    } finally { setSending(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} title="Chat clienti"
        className={`relative p-2 rounded-xl hover:bg-bg-hover text-text-secondary transition-colors ${totalUnread > 0 ? 'chat-blink' : ''}`}>
        <MessageCircle className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-error text-white text-[10px] font-bold px-1">{totalUnread}</span>
        )}
      </button>

      {mounted && createPortal(
      <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-bg-secondary border-l border-border z-[61] flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {activeId && (
                    <button onClick={() => setActiveId(null)} className="p-1 -ml-1 rounded-lg hover:bg-bg-hover text-text-secondary">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <h3 className="text-base font-display font-semibold text-text-primary truncate">{activeConv ? activeConv.clientName : 'Chat clienti'}</h3>
                </div>
                <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary flex-shrink-0"><X className="w-5 h-5" /></button>
              </div>

              {!activeId ? (
                <div className="flex-1 overflow-y-auto">
                  {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                      <MessageCircle className="w-10 h-10 text-text-muted mb-3" />
                      <p className="text-sm text-text-secondary font-medium">Nessuna conversazione</p>
                      <p className="text-xs text-text-muted mt-1">I messaggi dei clienti dall&apos;app compariranno qui.</p>
                    </div>
                  ) : conversations.map(c => (
                    <button key={c.clientId} onClick={() => openConversation(c.clientId)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-bg-hover transition-colors text-left border-b border-border/40">
                      <div className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{initials(c.clientName)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{c.clientName}</p>
                        <p className="text-xs text-text-muted truncate">{c.lastSender === 'operator' ? 'Tu: ' : ''}{c.lastBody}</p>
                      </div>
                      {c.unread > 0 && <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold px-1 flex-shrink-0">{c.unread}</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                    {thread.map(m => (
                      <div key={m.id} className={`flex ${m.sender === 'operator' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.sender === 'operator' ? 'bg-accent text-white rounded-br-sm' : 'bg-bg-tertiary text-text-primary rounded-bl-sm'}`}>
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <div className={`text-[10px] mt-1 ${m.sender === 'operator' ? 'text-white/70' : 'text-text-muted'}`}>
                            {new Date(m.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={threadEndRef} />
                  </div>
                  <div className="p-3 border-t border-border flex items-center gap-2 flex-shrink-0">
                    <input value={reply} onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      placeholder="Scrivi una risposta..."
                      className="flex-1 px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                    <button onClick={sendReply} disabled={!reply.trim() || sending}
                      className="p-2.5 rounded-xl gradient-accent text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Popup: cliente in attesa da oltre 10 minuti */}
      <AnimatePresence>
        {alertConv && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { dismissedRef.current.add(alertConv.clientId); setAlertConv(null); }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl p-6 z-10">
              <div className="flex items-center gap-3 mb-3 text-warning">
                <div className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-display font-bold text-text-primary">Cliente in attesa</h3>
              </div>
              <p className="text-sm text-text-secondary mb-5">
                <strong className="text-text-primary">{alertConv.clientName}</strong> ha scritto in chat e attende una risposta da <strong className="text-warning">oltre 10 minuti</strong>.
              </p>
              <div className="flex gap-2">
                <button onClick={() => { dismissedRef.current.add(alertConv.clientId); setAlertConv(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                  Più tardi
                </button>
                <button onClick={() => { const id = alertConv.clientId; setAlertConv(null); setOpen(true); openConversation(id); }}
                  className="flex-1 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:opacity-90 transition-opacity">
                  Apri chat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </>,
      document.body
      )}
    </>
  );
}
