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
import { MessageSquare, Send, Loader2, RefreshCw, AlertTriangle, Bot, CalendarPlus, User, Zap, Clock, Check, CheckCheck, Mic, FileText, Video, Image as ImageIcon, MailQuestion, ArrowDown } from 'lucide-react';
import { loadConversations, loadConversation, sendManualReply, markConversationUnreadAction } from '@/app/actions/whatsapp';
import { useWaInboxStore } from '@/stores/useWaInboxStore';
// I tipi arrivano dalla libreria, non dal file di azioni: un 'use server' non
// può ri-esportarli senza rompersi a runtime.
import type { WaConversation, WaMessageRow, WaMedia } from '@/lib/wa-conversations';

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

/** Nome leggibile dell'allegato, per l'alt del file e i messaggi di errore. */
function mediaLabel(media: WaMedia): string {
  switch (media.kind) {
    case 'image': return 'Foto';
    case 'sticker': return 'Sticker';
    case 'audio': return media.voice ? 'Messaggio vocale' : 'Audio';
    case 'video': return 'Video';
    case 'document': return media.filename || 'Documento';
  }
}

/** Icona di ripiego quando l'allegato non è un'immagine (o non si carica più). */
const MEDIA_ICON: Record<WaMedia['kind'], typeof Mic> = {
  image: ImageIcon, sticker: ImageIcon, audio: Mic, video: Video, document: FileText,
};

/**
 * Anteprima in elenco: miniatura vera per foto e sticker, icona per il resto.
 *
 * Vale la pena scaricare il file anche qui — è la differenza tra capire a colpo
 * d'occhio quale cliente ha mandato cosa e leggere tre righe identiche "Foto".
 */
function MediaThumb({ media }: { media: WaMedia }) {
  const [failed, setFailed] = useState(false);
  const Icon = MEDIA_ICON[media.kind];
  const isImage = media.kind === 'image' || media.kind === 'sticker';

  if (!isImage || failed) {
    return <Icon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/whatsapp/media/${encodeURIComponent(media.id)}`} alt="" onError={() => setFailed(true)}
      className="w-7 h-7 rounded object-cover flex-shrink-0 bg-bg-tertiary"
    />
  );
}

/**
 * Allegato dentro la bolla.
 *
 * La sorgente non è un URL di Meta ma la rotta del gestionale: il file viene
 * scaricato dal server, che è l'unico ad avere la chiave del canale. Gli
 * allegati più vecchi di un mese Meta li cancella, per questo ogni tipo ha un
 * messaggio di ripiego invece di restare muto.
 */
function MediaBubble({ media }: { media: WaMedia }) {
  const src = `/api/whatsapp/media/${encodeURIComponent(media.id)}`;
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <p className="text-[11px] text-text-muted italic flex items-center gap-1.5 py-1">
        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
        {mediaLabel(media)} non più disponibile
      </p>
    );
  }

  switch (media.kind) {
    case 'audio':
      return (
        <div className="py-1">
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted mb-1">
            <Mic className="w-3 h-3" />{mediaLabel(media)}
          </div>
          {/* Il player nativo basta: ha play, barra di avanzamento e velocità dal menu contestuale. */}
          <audio controls preload="metadata" src={src} onError={() => setFailed(true)} className="w-56 max-w-full h-9" />
        </div>
      );
    case 'image':
    case 'sticker':
      return (
        <a href={src} target="_blank" rel="noreferrer" className="block py-1">
          {/* Binario servito dalla nostra rotta proxy: next/image non può ottimizzarlo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src} alt={mediaLabel(media)} onError={() => setFailed(true)}
            className={media.kind === 'sticker' ? 'w-24 h-24 object-contain' : 'rounded-xl max-h-64 max-w-full object-cover'}
          />
        </a>
      );
    case 'video':
      return <video controls preload="metadata" src={src} onError={() => setFailed(true)} className="rounded-xl max-h-64 max-w-full my-1" />;
    case 'document':
      return (
        <a href={src} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 py-1 text-sm text-accent hover:underline break-all">
          <FileText className="w-4 h-4 flex-shrink-0" />{mediaLabel(media)}
        </a>
      );
  }
}

/**
 * Il cerchio accanto al nome.
 *
 * NON è la foto del profilo WhatsApp: la Cloud API di Meta, quella che usa
 * 360dialog, non dà la foto di chi ci scrive — l'unica foto che l'API espone è
 * la nostra, quella del centro. Qui si mostra la foto della SCHEDA CLIENTE, e
 * quando manca le iniziali su un colore ricavato dal numero, così ogni
 * conversazione ha comunque il suo colore riconoscibile.
 */
const COLORI_FACCIA = ['#A855F7', '#EC4899', '#F59E0B', '#22C55E', '#3B82F6', '#14B8A6', '#6366F1', '#F97316'];

function Faccia({ nome, phone, avatar, size = 40 }: {
  nome?: string; phone: string; avatar?: string; size?: number;
}) {
  const iniziali = (nome || '')
    .split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const cifre = phone.replace(/\D/g, '');
  const colore = COLORI_FACCIA[Number(cifre.slice(-2) || 0) % COLORI_FACCIA.length];

  return (
    <span className="rounded-full overflow-hidden flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ backgroundColor: colore, width: size, height: size, fontSize: size / 2.8 }}>
      {avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={avatar} alt="" className="w-full h-full object-cover" />
        : iniziali || <User className="w-1/2 h-1/2" />}
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
  const [clientAvatar, setClientAvatar] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  /** Se si sta guardando la coda: solo allora il polling può scorrere in fondo. */
  const inFondoRef = useRef(true);
  const [lontanoDalFondo, setLontanoDalFondo] = useState(false);

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
      setClientAvatar(res.clientAvatar);
      // Aprire la chat la segna letta: spegne subito il pallino sul menu,
      // senza aspettare il giro di polling dell'avviso globale.
      void useWaInboxStore.getState().fetchUnread();
    } catch {
      setError('Impossibile aprire la conversazione.');
    }
  }, []);

  /**
   * Rimette la conversazione fra quelle da leggere e la chiude: tornano il
   * pallino sul menu e, se resta senza risposta, l'avviso a schermo.
   */
  const segnaDaLeggere = useCallback(async (phone: string) => {
    setActive(null);
    setThread([]);
    await markConversationUnreadAction(phone);
    await refreshList();
    void useWaInboxStore.getState().fetchUnread();
  }, [refreshList]);

  const openThread = useCallback((phone: string) => {
    setActive(phone);
    setThread([]); // il caricamento lo fa l'effect qui sotto, che riparte al cambio di `active`
    // Una conversazione appena aperta si guarda dalla fine, come su WhatsApp.
    inFondoRef.current = true;
    setLontanoDalFondo(false);
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

  /**
   * Si sposta il contenitore, non si usa scrollIntoView su un segnaposto: quello
   * cerca l'antenato scorrevole e con le colonne annidate della pagina a volte
   * sceglie quello sbagliato, lasciando la chat ferma.
   */
  const inFondo = () => {
    const el = boxRef.current;
    // Salto secco, non animato: lo scorrimento morbido qui viene annullato dal
    // render successivo e la chat resta dov'era.
    if (el) el.scrollTop = el.scrollHeight;
  };

  /**
   * Lo scorrimento in fondo si fa SOLO se ci si era già.
   *
   * Prima si faceva a ogni cambio di `thread`, e siccome il polling riscrive
   * l'elenco ogni venti secondi, chi stava rileggendo i messaggi di due giorni
   * fa veniva sbalzato in fondo senza aver toccato niente.
   */
  useEffect(() => {
    if (inFondoRef.current) inFondo();
  }, [thread]);

  /** Vero finché si sta guardando la coda della conversazione. */
  const segnaPosizione = () => {
    const el = boxRef.current;
    if (!el) return;
    const distanza = el.scrollHeight - el.scrollTop - el.clientHeight;
    inFondoRef.current = distanza < 120;
    setLontanoDalFondo(!inFondoRef.current);
  };

  const tornaInFondo = () => {
    inFondoRef.current = true;
    setLontanoDalFondo(false);
    inFondo();
  };

  const send = async () => {
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const res = await sendManualReply(active, draft);
    setSending(false);
    if (!res.ok) return setError(res.error || 'Invio fallito');
    setDraft('');
    // Dopo aver risposto si vuole vedere la propria risposta, ovunque si fosse.
    inFondoRef.current = true;
    setLontanoDalFondo(false);
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
              className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-bg-hover transition-colors flex gap-3 ${active === c.phone ? 'bg-bg-hover' : ''}`}>
              <Faccia nome={c.name} phone={c.phone} avatar={c.avatar} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary truncate flex-1">{c.name || c.phone}</span>
                  {c.unread > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-success text-white flex-shrink-0">{c.unread}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {c.lastMedia && <MediaThumb media={c.lastMedia} />}
                  <p className="text-[11px] text-text-muted truncate">
                    {c.lastDirection === 'out' && <span className="text-text-muted/70">Tu: </span>}{c.lastText}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-text-muted/70">{timeLabel(c.lastAt)}</span>
                  {/* Col nome dall'anagrafica il numero sparirebbe dalla riga: lo teniamo qui */}
                  {c.name && <span className="text-[10px] text-text-muted/60 font-mono truncate">+{c.phone}</span>}
                  {!c.windowOpen && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted">CHIUSA</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className={`relative rounded-2xl bg-bg-secondary border border-border/50 flex flex-col overflow-hidden ${active ? 'flex' : 'hidden md:flex'}`}>
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <MessageSquare className="w-8 h-8 text-text-muted/40 mb-2" />
            <p className="text-sm text-text-muted">Scegli una conversazione per leggerla.</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3 flex-shrink-0">
              <button onClick={() => setActive(null)} className="md:hidden text-xs text-text-muted">←</button>
              <Faccia nome={clientName || conversations?.find(c => c.phone === active)?.name}
                phone={active} avatar={clientAvatar} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{clientName || conversations?.find(c => c.phone === active)?.name || active}</p>
                <p className="text-[11px] text-text-muted font-mono">+{active}</p>
              </div>
              {/* Rimette la chat fra le non lette: chiude il thread, altrimenti
                  restando aperta verrebbe subito risegnata come letta. */}
              <button onClick={() => segnaDaLeggere(active)} title="Rimetti fra i messaggi da leggere"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-medium text-text-secondary hover:bg-bg-hover hover:text-accent transition-colors flex-shrink-0">
                <MailQuestion className="w-3.5 h-3.5" /> Da leggere
              </button>
            </div>

            <div ref={boxRef} onScroll={segnaPosizione} className="flex-1 overflow-y-auto p-4 space-y-3 relative">
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
                      {m.media && <MediaBubble media={m.media} />}
                      {/* Con un allegato si mostra solo la didascalia: il tipo
                          ("📷 Foto") si vede già dal file stesso. */}
                      {(m.media ? m.media.caption : m.text) && (
                        <p className="text-sm text-text-primary whitespace-pre-line break-words">
                          {m.media ? m.media.caption : m.text}
                        </p>
                      )}
                      {/* I bottoni di un template non stanno nel testo: senza
                          questo blocco la richiesta recensione si leggeva qui
                          come un invito senza link, mentre sul telefono della
                          cliente il bottone c'era. */}
                      {m.template?.buttons?.length ? (
                        <div className="mt-1.5 space-y-1">
                          {m.template.buttons.map((b, k) => (
                            <div key={k} className="text-[11px] text-accent border border-accent/25 rounded-lg px-2 py-1 text-center break-all">
                              {b}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {m.template && (
                        <p className="text-[9px] text-text-muted/50 mt-1 font-mono truncate">template: {m.template.name}</p>
                      )}
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
            </div>

            {/* Chi è risalito nella conversazione non viene più trascinato in
                fondo dal polling: se nel frattempo arriva qualcosa, ci torna da qui. */}
            {lontanoDalFondo && (
              <button onClick={tornaInFondo}
                className="absolute bottom-24 right-6 z-10 flex items-center gap-1.5 px-3 py-2 rounded-full
                  bg-bg-secondary border border-border shadow-lg text-xs font-medium text-text-secondary
                  hover:text-accent hover:border-accent/40 transition-colors">
                <ArrowDown className="w-3.5 h-3.5" /> Vai in fondo
              </button>
            )}

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
