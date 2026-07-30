'use client';

/**
 * Chat WhatsApp dentro il gestionale.
 *
 * Dopo la migrazione del numero su WABA le conversazioni non sono più apribili
 * dall'app WhatsApp: questa schermata è l'unico modo per leggere cosa scrivono i
 * clienti, cosa ha risposto l'assistente o il bot, e per intervenire a mano.
 *
 * Il polling è volutamente semplice (ricarica ogni 20s): il volume di un centro
 * estetico non giustifica una connessione in tempo reale.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Loader2, RefreshCw, AlertTriangle, Bot, CalendarPlus, User, Zap, Clock, Check, CheckCheck } from 'lucide-react';
import { loadConversations, loadConversation, sendManualReply } from '@/app/actions/whatsapp';
import { useWaInboxStore } from '@/stores/useWaInboxStore';
// I tipi arrivano dalla libreria, non dal file di azioni: un 'use server' non
// può ri-esportarli senza rompersi a runtime.
import type { WaConversation, WaMessageRow } from '@/lib/wa-conversations';

const POLL_MS = 20_000;

/** Etichetta e icona per capire a colpo d'occhio chi ha scritto una risposta. */
const SOURCE_META: Record<string, { label: string; icon: typeof Bot; cls: string }> = {
  assistant: { label: 'Assistente AI', icon: Bot, cls: 'text-accent' },
  booking: { label: 'Bot prenotazione', icon: CalendarPlus, cls: 'text-accent' },
  automation: { label: 'Automatico', icon: Zap, cls: 'text-text-muted' },
  manual: { label: 'Tu', icon: User, cls: 'text-success' },
  system: { label: 'Sistema', icon: Zap, cls: 'text-text-muted' },
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Le spunte dei messaggi che mandiamo noi, come su WhatsApp: una spunta se è
 * partito, due se è arrivato sul telefono, due azzurre quando la cliente l'ha
 * aperto. Lo stato arriva dal webhook di WhatsApp, non lo decidiamo noi: se
 * manca ancora (o la cliente ha spento le conferme di lettura) non si mostra nulla.
 */
function DeliveryMark({ status, direction }: { status?: WaMessageRow['deliveryStatus']; direction: 'in' | 'out' }) {
  if (direction !== 'out' || !status) return null;
  if (status === 'failed') return <span className="text-[10px] text-error">non consegnato</span>;
  if (status === 'read') {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-sky-500 font-medium" title="La cliente ha letto il messaggio">
        <CheckCheck className="w-3.5 h-3.5" /> visualizzato
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-text-muted" title="Arrivato sul telefono della cliente">
        <CheckCheck className="w-3.5 h-3.5" /> consegnato
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-text-muted/70" title="Partito, non ancora consegnato">
      <Check className="w-3.5 h-3.5" /> inviato
    </span>
  );
}

export default function WhatsAppChat() {
  const [conversations, setConversations] = useState<WaConversation[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [thread, setThread] = useState<WaMessageRow[]>([]);
  const [windowOpen, setWindowOpen] = useState(false);
  const [windowExpiresAt, setWindowExpiresAt] = useState<string | undefined>();
  const [clientName, setClientName] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /**
   * Niente `setState` sincrono qui dentro: viene chiamata anche dagli effect, e
   * impostare lo stato prima del primo `await` innescherebbe render a cascata.
   * L'indicatore di caricamento sta in `manualRefresh`, che parte da un click.
   */
  const refreshList = useCallback(async () => {
    try {
      setConversations(await loadConversations());
    } catch {
      setError('Impossibile caricare le conversazioni.');
    }
  }, []);

  const manualRefresh = useCallback(async () => {
    setLoadingList(true);
    await refreshList();
    setLoadingList(false);
  }, [refreshList]);

  /** Ricarica il thread già aperto. Non tocca `active`: la usa anche il polling. */
  const loadThread = useCallback(async (phone: string) => {
    try {
      const res = await loadConversation(phone);
      setThread(res.messages);
      setWindowOpen(res.windowOpen);
      setWindowExpiresAt(res.windowExpiresAt);
      setClientName(res.clientName);
      // Aprire la chat la segna letta: spegne subito il pallino sul menu,
      // senza aspettare il giro di polling dell'avviso globale.
      void useWaInboxStore.getState().fetchUnread();
    } catch {
      setError('Impossibile aprire la conversazione.');
    }
  }, []);

  const openThread = useCallback((phone: string) => {
    setActive(phone);
    setThread([]); // il caricamento lo fa l'effect qui sotto, che riparte al cambio di `active`
  }, []);

  /**
   * Unico punto di caricamento: primo giro subito, poi ogni POLL_MS. I fetch
   * stanno nei callback del timer, non nel corpo dell'effect, così lo stato non
   * viene toccato durante il render.
   */
  useEffect(() => {
    const tick = () => {
      void refreshList();
      if (active) void loadThread(active);
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, POLL_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [active, loadThread, refreshList]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread]);

  const send = async () => {
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const res = await sendManualReply(active, draft);
    setSending(false);
    if (!res.ok) return setError(res.error || 'Invio fallito');
    setDraft('');
    await loadThread(active);
    await refreshList();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-13rem)] min-h-[28rem]">
      {/* Elenco conversazioni */}
      <div className={`rounded-2xl bg-bg-secondary border border-border/50 flex flex-col overflow-hidden ${active ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
          <p className="text-sm font-semibold text-text-primary">Conversazioni</p>
          <button onClick={manualRefresh} disabled={loadingList}
            className="p-1.5 rounded-lg text-text-muted hover:bg-bg-hover disabled:opacity-50" title="Aggiorna">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations === null ? (
            <p className="p-4 text-xs text-text-muted flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> carico…</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-xs text-text-muted leading-relaxed">
              Nessuna conversazione. Appena un cliente scrive al numero del centro comparirà qui.
            </p>
          ) : conversations.map(c => (
            <button key={c.phone} onClick={() => openThread(c.phone)}
              className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-bg-hover transition-colors ${active === c.phone ? 'bg-bg-hover' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary truncate flex-1">{c.name || c.phone}</span>
                {c.unread > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-success text-white flex-shrink-0">{c.unread}</span>
                )}
              </div>
              <p className="text-[11px] text-text-muted truncate mt-0.5">
                {c.lastDirection === 'out' && <span className="text-text-muted/70">Tu: </span>}{c.lastText}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-text-muted/70">{timeLabel(c.lastAt)}</span>
                {/* Col nome dall'anagrafica il numero sparirebbe dalla riga: lo teniamo qui */}
                {c.name && <span className="text-[10px] text-text-muted/60 font-mono truncate">+{c.phone}</span>}
                {!c.windowOpen && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted">CHIUSA</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className={`rounded-2xl bg-bg-secondary border border-border/50 flex flex-col overflow-hidden ${active ? 'flex' : 'hidden md:flex'}`}>
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <MessageSquare className="w-8 h-8 text-text-muted/40 mb-2" />
            <p className="text-sm text-text-muted">Scegli una conversazione per leggerla.</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3 flex-shrink-0">
              <button onClick={() => setActive(null)} className="md:hidden text-xs text-text-muted">←</button>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{clientName || conversations?.find(c => c.phone === active)?.name || active}</p>
                <p className="text-[11px] text-text-muted font-mono">+{active}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {thread.map((m, i) => {
                const meta = m.direction === 'out' ? SOURCE_META[m.source || 'system'] : null;
                const Icon = meta?.icon;
                return (
                  <div key={`${m.at}-${i}`} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      m.direction === 'out'
                        ? m.ok === false ? 'bg-error/10 border border-error/30' : 'bg-accent/10'
                        : 'bg-bg-tertiary'
                    }`}>
                      {meta && Icon && (
                        <div className={`flex items-center gap-1 text-[10px] font-semibold mb-0.5 ${meta.cls}`}>
                          <Icon className="w-3 h-3" />{meta.label}
                        </div>
                      )}
                      <p className="text-sm text-text-primary whitespace-pre-line break-words">{m.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-text-muted/70">{timeLabel(m.at)}</span>
                        {m.ok === false ? (
                          <span className="text-[10px] text-error" title={m.error}>non consegnato</span>
                        ) : (
                          <DeliveryMark status={m.deliveryStatus} direction={m.direction} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Casella di risposta. Fuori dalla finestra 24h Meta rifiuta il testo
                libero: meglio bloccare qui che far scrivere invano. */}
            <div className="border-t border-border/40 p-3 flex-shrink-0 space-y-2">
              {!windowOpen ? (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-warning/10 border border-warning/30">
                  <Clock className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Sono passate più di 24 ore dall&apos;ultimo messaggio del cliente. Meta non permette
                    più di scrivergli liberamente: deve essere lui a riscrivere, oppure serve un template approvato.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft} onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                      rows={2} placeholder="Scrivi la tua risposta…"
                      className="flex-1 px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50" />
                    <button onClick={send} disabled={sending || !draft.trim()}
                      className="p-2.5 rounded-xl bg-accent text-white hover:opacity-90 disabled:opacity-40 flex-shrink-0">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  {windowExpiresAt && (
                    <p className="text-[10px] text-text-muted/70">
                      Puoi rispondere liberamente fino alle {timeLabel(windowExpiresAt)}.
                    </p>
                  )}
                </>
              )}
              {error && (
                <p className="text-[11px] text-error flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />{error}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
