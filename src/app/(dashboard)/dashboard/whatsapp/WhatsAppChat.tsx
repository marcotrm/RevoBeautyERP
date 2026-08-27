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
import { MessageSquare, Bot as BotOn, Send, Loader2, Trash2, RefreshCw, AlertTriangle, Bot, CalendarPlus, User, Zap, Clock, Check, CheckCheck, Mic, FileText, Video, Image as ImageIcon, MailQuestion, ArrowDown, PenSquare, X, Search, Smile, BotOff } from 'lucide-react';
import { loadConversations, loadConversation, sendManualReply, markConversationUnreadAction, apriConversazione, eliminaConversazione, segnaConversazioneGestita, statoSegretaria, riprendiSegretariaAction, spegniSegretariaAction } from '@/app/actions/whatsapp';
import SegniCliente from '@/components/SegniCliente';
import MandaListino from '@/components/MandaListino';
import {
  listaTemplate, clientiPerCampagna, creaTemplateApertura,
  type TemplateRemoto, type DestinatarioCampagna,
} from '@/app/actions/campagne';
// Le costanti NON possono venire da un file 'use server': lì Next ammette
// solo funzioni asincrone fra gli export.
import { NOME_APERTURA, TESTO_APERTURA } from '@/lib/wa-templates';
import { NO_AUTOFILL } from '@/lib/noAutofill';
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
 * Le faccine, scelte a mano.
 *
 * Non c'è una libreria: mille emoji divise per categorie servono a una chat fra
 * ragazzi, non al bancone di un centro estetico. Qui stanno quelle che si usano
 * davvero rispondendo a una cliente — un saluto, un grazie, un cuore, i giorni
 * e gli orari — così si trovano al primo colpo d'occhio senza cercare.
 */
const EMOJI: { titolo: string; lista: string[] }[] = [
  { titolo: 'Faccine', lista: ['😊', '😄', '🥰', '😍', '😉', '😅', '🙃', '😘', '🤗', '😌', '🥲', '😢', '😔', '🙈'] },
  { titolo: 'Gesti', lista: ['👍', '👌', '🙏', '👏', '💪', '🤝', '👋', '✌️', '🤞', '💅', '💇‍♀️', '💆‍♀️'] },
  { titolo: 'Cuori e stelle', lista: ['❤️', '💜', '💖', '💕', '✨', '⭐', '🌟', '🔥', '🌸', '🌺', '💐', '🎀'] },
  { titolo: 'Appuntamenti', lista: ['📅', '🕐', '⏰', '✅', '❌', '📍', '📲', '💶', '🎁', '🎉', '🥳', '☀️'] },
];

/** Da quanto aspetta, detto come lo direbbe una persona: "40 min", "3 ore", "2 giorni". */
function attesaLeggibile(minuti?: number): string {
  const m = Math.max(0, minuti ?? 0);
  if (m < 60) return `${m} min`;
  const ore = Math.floor(m / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? 'ora' : 'ore'}`;
  const giorni = Math.floor(ore / 24);
  return `${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`;
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

/**
 * Il messaggio di apertura, creato da qui.
 *
 * I template esistenti parlano tutti di un appuntamento o di una promozione:
 * per rispondere a chi ha chiesto "scrivetemi su WhatsApp" non ne serve
 * nessuno di quelli, serve un buongiorno. Si crea una volta e resta.
 */
function CreaApertura({ onFatto }: { onFatto: () => void }) {
  const [creando, setCreando] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; msg: string } | null>(null);

  const crea = async () => {
    setCreando(true); setEsito(null);
    const r = await creaTemplateApertura();
    setCreando(false);
    setEsito(r.ok
      ? { ok: true, msg: `Mandato a Meta per l'approvazione (stato: ${r.status}). Di solito risponde in pochi minuti: torna qui e ricarica.` }
      : { ok: false, msg: r.error || 'Creazione fallita' });
    if (r.ok) onFatto();
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-text-secondary leading-relaxed">
        Non hai ancora un messaggio adatto a scrivere per primo: quelli che ci sono parlano
        di appuntamenti o promozioni. Questo invece è un buongiorno e basta — si crea una
        volta sola e poi resta lì.
      </p>
      <div className="rounded-xl bg-bg-secondary border border-border/60 px-3 py-2">
        <p className="text-[11px] text-text-primary whitespace-pre-wrap leading-relaxed">{TESTO_APERTURA}</p>
      </div>
      {esito && <p className={`text-[11px] leading-relaxed ${esito.ok ? 'text-success' : 'text-error'}`}>{esito.msg}</p>}
      <button onClick={crea} disabled={creando}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-50">
        {creando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        Crea il messaggio di apertura
      </button>
    </div>
  );
}

/** Chi contattare: si cerca in anagrafica, o si scrive il numero a mano. */
function ScegliDestinatario({ onScelto, onChiudi }: {
  onScelto: (phone: string) => void;
  onChiudi: () => void;
}) {
  const [clienti, setClienti] = useState<DestinatarioCampagna[] | null>(null);
  const [cerca, setCerca] = useState('');

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const c = await clientiPerCampagna();
      if (vivo) setClienti(c);
    })();
    return () => { vivo = false; };
  }, []);

  const q = cerca.trim().toLowerCase();
  const soloCifre = q.replace(/\D/g, '');
  const trovati = (clienti || [])
    .filter(c => !q || c.nome.toLowerCase().includes(q) || (soloCifre && c.phone.includes(soloCifre)))
    .slice(0, 30);

  // Numero scritto a mano: utile per chi non è ancora in anagrafica.
  const numeroLibero = soloCifre.length >= 9 && !trovati.some(c => c.phone.endsWith(soloCifre.slice(-9)))
    ? soloCifre : null;

  return (
    <div className="px-3 py-3 border-b border-border/40 bg-bg-tertiary/30 flex-shrink-0 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Scrivi a un cliente</p>
        <button onClick={onChiudi} className="text-text-muted hover:text-text-primary"><X className="w-3.5 h-3.5" /></button>
      </div>
      <input autoFocus value={cerca} onChange={e => setCerca(e.target.value)} {...NO_AUTOFILL}
        placeholder="Nome o numero…"
        className="w-full px-3 py-2 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary" />

      <div className="max-h-56 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/30">
        {clienti === null && <p className="px-3 py-3 text-[11px] text-text-muted">carico l&apos;anagrafica…</p>}
        {numeroLibero && (
          <button onClick={() => onScelto(numeroLibero)}
            className="w-full text-left px-3 py-2 hover:bg-bg-hover">
            <p className="text-sm text-text-primary">Scrivi a +{numeroLibero}</p>
            <p className="text-[10px] text-text-muted">numero non in anagrafica</p>
          </button>
        )}
        {trovati.map(c => (
          <button key={c.id} onClick={() => onScelto(c.phone)}
            className="w-full text-left px-3 py-2 hover:bg-bg-hover flex items-center gap-2.5">
            <Faccia nome={c.nome} phone={c.phone} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-text-primary truncate">{c.nome}</span>
              <span className="block text-[10px] text-text-muted font-mono">+{c.phone}</span>
            </span>
          </button>
        ))}
        {clienti !== null && trovati.length === 0 && !numeroLibero && (
          <p className="px-3 py-3 text-[11px] text-text-muted">Nessun cliente trovato.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Cosa si può fare quando la finestra è chiusa.
 *
 * Meta lascia scrivere liberamente solo nelle 24 ore dopo un messaggio del
 * cliente. Fuori da lì — e prima del suo primo messaggio in assoluto — l'unica
 * strada è un messaggio già approvato. Prima qui c'era solo l'avviso, e per
 * contattare una cliente che aveva detto "scrivetemi su WhatsApp" bisognava
 * uscire dal gestionale.
 */
function FinestraChiusa({ phone, nome, mai, onInviato }: {
  phone: string;
  nome?: string;
  /** Vero se con questo numero non c'è mai stato uno scambio. */
  mai: boolean;
  onInviato: () => void;
}) {
  const [templates, setTemplates] = useState<TemplateRemoto[] | null>(null);
  const [scelto, setScelto] = useState<TemplateRemoto | null>(null);
  const [valori, setValori] = useState<Record<number, string>>({});
  const [inviando, setInviando] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; msg: string } | null>(null);
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    if (!aperto || templates) return;
    let vivo = true;
    void (async () => {
      const r = await listaTemplate();
      if (vivo) setTemplates(r.templates.filter(t => t.status.toUpperCase() === 'APPROVED'));
    })();
    return () => { vivo = false; };
  }, [aperto, templates]);

  /** Il primo segnaposto è il nome: lo riempie il gestionale, non l'operatrice. */
  const nomeBreve = (nome || '').trim().split(/\s+/)[0] || 'ciao';
  const segnaposto = scelto?.body
    ? [...new Set([...scelto.body.matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1])))].sort((a, b) => a - b)
    : [];
  const daRiempire = segnaposto.filter(n => n > 1);
  const mancanti = daRiempire.filter(n => !valori[n]?.trim());

  const testoFinale = (scelto?.body || '').replace(/\{\{(\d+)\}\}/g, (_, n) =>
    Number(n) === 1 ? nomeBreve : (valori[Number(n)]?.trim() || `{{${n}}}`));

  const manda = async () => {
    if (!scelto || mancanti.length > 0) return;
    setInviando(true); setEsito(null);
    const res = await apriConversazione({
      phone,
      templateName: scelto.name,
      language: scelto.language,
      // In ordine: prima il nome, poi gli altri segnaposto.
      bodyParams: segnaposto.map(n => (n === 1 ? nomeBreve : valori[n].trim())),
      anteprima: testoFinale,
    });
    setInviando(false);
    setEsito(res.ok
      ? { ok: true, msg: 'Messaggio partito. Ora tocca al cliente: appena risponde puoi scrivergli liberamente.' }
      : { ok: false, msg: res.error || 'Invio fallito' });
    if (res.ok) { setScelto(null); setValori({}); onInviato(); }
  };

  return (
    <div className="rounded-xl bg-warning/10 border border-warning/30 p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <Clock className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-text-secondary leading-relaxed flex-1">
          {mai
            ? 'Con questo numero non c\'è ancora nessuna conversazione. Meta lascia scrivere per primi solo con un messaggio già approvato: dopo che il cliente risponde, si può parlare liberamente per 24 ore.'
            : 'Sono passate più di 24 ore dall\'ultimo messaggio del cliente: Meta non permette più il testo libero. Puoi mandargli un messaggio approvato, oppure aspettare che riscriva.'}
        </p>
      </div>

      {!aperto ? (
        <button onClick={() => setAperto(true)}
          className="w-full py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90">
          Manda un messaggio approvato
        </button>
      ) : (
        <>
          {templates === null ? (
            <p className="flex items-center gap-2 text-[11px] text-text-muted"><Loader2 className="w-3 h-3 animate-spin" /> carico i messaggi approvati…</p>
          ) : templates.length === 0 ? (
            <CreaApertura onFatto={() => setTemplates(null)} />
          ) : (
            <>
              <select value={scelto?.name || ''}
                onChange={e => {
                  setScelto(templates.find(t => t.name === e.target.value) || null);
                  setValori({}); setEsito(null);
                }}
                className="w-full px-2.5 py-2 rounded-xl bg-bg-tertiary border border-border text-xs text-text-primary">
                <option value="">Scegli il messaggio…</option>
                {templates.map(t => (
                  <option key={`${t.name}-${t.language}`} value={t.name}>
                    {t.name} {t.category === 'MARKETING' ? '(promozionale)' : '(di servizio)'}
                  </option>
                ))}
              </select>

              {/* Se il buongiorno neutro non c'è ancora, si può crearlo da qui
                  invece di andarlo a cercare in Marketing. */}
              {!templates.some(t => t.name === NOME_APERTURA) && <CreaApertura onFatto={() => setTemplates(null)} />}

              {daRiempire.map(n => (
                <input key={n} value={valori[n] || ''} {...NO_AUTOFILL}
                  onChange={e => setValori(v => ({ ...v, [n]: e.target.value }))}
                  placeholder={`Cosa scrivere al posto di {{${n}}}`}
                  className="w-full px-2.5 py-2 rounded-xl bg-bg-tertiary border border-border text-xs text-text-primary" />
              ))}

              {scelto && (
                <div className="rounded-xl bg-bg-secondary border border-border/60 px-3 py-2">
                  <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-1">Riceverà questo</p>
                  <p className="text-[11px] text-text-primary whitespace-pre-wrap leading-relaxed">
                    {scelto.body ? testoFinale : 'Meta non ha restituito il testo di questo messaggio.'}
                  </p>
                </div>
              )}

              {esito && (
                <p className={`text-[11px] leading-relaxed ${esito.ok ? 'text-success' : 'text-error'}`}>{esito.msg}</p>
              )}

              <div className="flex items-center gap-2">
                <button onClick={() => { setAperto(false); setScelto(null); setEsito(null); }}
                  className="px-3 py-2 rounded-xl border border-border text-[11px] text-text-secondary hover:bg-bg-hover">
                  Annulla
                </button>
                <button onClick={manda} disabled={!scelto || inviando || mancanti.length > 0}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-40">
                  {inviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Manda a {nome || `+${phone}`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function WhatsAppChat() {
  const [conversations, setConversations] = useState<WaConversation[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [thread, setThread] = useState<WaMessageRow[]>([]);
  const [windowOpen, setWindowOpen] = useState(false);
  const [windowExpiresAt, setWindowExpiresAt] = useState<string | undefined>();
  /*
    Se la segretaria tace su questa conversazione, e perché.

    Senza questo il passaggio a una persona è invisibile: la cliente scrive,
    non le risponde più nessuno, e da qui la chat sembra identica a una in cui
    il bot semplicemente non ha niente da dire. Questo è il posto dove si vede,
    ed è anche l'unico posto da cui si può disfare.
  */
  const [muta, setMuta] = useState<{ muta: boolean; spenta: boolean; fino?: string; motivo?: string }>({ muta: false, spenta: false });
  const [riprendendo, setRiprendendo] = useState(false);
  const [clientName, setClientName] = useState<string | undefined>();
  const [clientAvatar, setClientAvatar] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiAperto, setEmojiAperto] = useState(false);
  const rispostaRef = useRef<HTMLTextAreaElement>(null);
  /** Dove rimettere il cursore dopo che React ha riscritto la casella. */
  const caretRef = useRef<number | null>(null);

  /**
   * Mette la faccina dove sta il cursore, non in fondo.
   *
   * Chi scrive "grazie mille" e poi vuole il cuore dopo "grazie" deve poterlo
   * fare: appiccicarla sempre alla fine costringerebbe a riscrivere la frase.
   * Il pannello resta aperto — di solito se ne mettono due o tre di fila.
   */
  const inserisciEmoji = (e: string) => {
    const box = rispostaRef.current;
    const da = box?.selectionStart ?? draft.length;
    const a = box?.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, da) + e + draft.slice(a));
    // Il cursore va DOPO la faccina. Non si può spostare qui: React deve prima
    // riscrivere la casella col testo nuovo, e ogni tentativo fatto adesso
    // verrebbe cancellato — il cursore finirebbe in fondo, e la parola scritta
    // subito dopo si troverebbe in coda alla frase invece che dove serve.
    caretRef.current = da + e.length;
  };

  useEffect(() => {
    const pos = caretRef.current;
    if (pos == null || !rispostaRef.current) return;
    caretRef.current = null;
    rispostaRef.current.focus();
    rispostaRef.current.setSelectionRange(pos, pos);
  }, [draft]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  /** Se si sta guardando la coda: solo allora il polling può scorrere in fondo. */
  const inFondoRef = useRef(true);
  const [lontanoDalFondo, setLontanoDalFondo] = useState(false);
  const [scegliCliente, setScegliCliente] = useState(false);
  /**
   * Vero finché i messaggi della chat appena aperta non sono arrivati. Senza,
   * per un istante si legge "nessuna conversazione, finestra chiusa" anche su
   * una chat viva: è lo stato iniziale, non la verità.
   */
  const [caricandoThread, setCaricandoThread] = useState(false);

  /**
   * Ricerca nell'elenco: prima fra le chat che ci sono già, poi — se il nome
   * non compare — fra le clienti in anagrafica, per aprire una chat che non
   * è mai iniziata. Con qualche centinaio di conversazioni scorrere a mano
   * per trovare una persona non è un modo di lavorare.
   */
  const [cerca, setCerca] = useState('');
  const [rubrica, setRubrica] = useState<DestinatarioCampagna[] | null>(null);
  useEffect(() => {
    // L'anagrafica si legge solo quando serve davvero, cioè quando si cerca.
    if (cerca.trim().length < 2 || rubrica !== null) return;
    let vivo = true;
    void (async () => {
      const c = await clientiPerCampagna();
      if (vivo) setRubrica(c);
    })();
    return () => { vivo = false; };
  }, [cerca, rubrica]);

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
      setCaricandoThread(false);
      void statoSegretaria(phone).then(setMuta).catch(() => {});
      // Aprire la chat la segna letta: spegne subito il pallino sul menu,
      // senza aspettare il giro di polling dell'avviso globale.
      void useWaInboxStore.getState().fetchUnread();
    } catch {
      setCaricandoThread(false);
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
    setCaricandoThread(true);
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

  const [eliminando, setEliminando] = useState(false);
  const [segnando, setSegnando] = useState(false);


  const riprendi = async (phone: string) => {
    setRiprendendo(true);
    try {
      await riprendiSegretariaAction(phone);
      setMuta({ muta: false, spenta: false });
    } finally {
      setRiprendendo(false);
    }
  };

  const spegni = async (phone: string) => {
    setRiprendendo(true);
    try {
      await spegniSegretariaAction(phone);
      setMuta({ muta: true, spenta: true });
    } finally {
      setRiprendendo(false);
    }
  };

  /** "L'ho gestita io": via il segno DA RISPONDERE, finché non riscrivono. */
  const segnaLetta = async (phone: string) => {
    setSegnando(true);
    try {
      await segnaConversazioneGestita(phone);
      await refreshList();
      await loadThread(phone);
    } finally {
      setSegnando(false);
    }
  };

  /**
   * Toglie la conversazione dall'archivio del gestionale.
   *
   * Si chiede conferma perché non si torna indietro, e nella domanda si dice
   * cosa NON succede: la chat sul telefono della persona resta, e la sua
   * scheda cliente pure. Qui sparisce solo quello che vediamo noi.
   */
  const eliminaChat = async (phone: string) => {
    const chi = clientName || conversations?.find(c => c.phone === phone)?.name || `+${phone}`;
    if (!window.confirm(
      `Eliminare la conversazione con ${chi}?\n\n` +
      'Spariscono i messaggi archiviati qui dentro. La chat sul telefono della persona e la sua ' +
      'scheda cliente restano come sono.\n\nNon si torna indietro.'
    )) return;

    setEliminando(true);
    try {
      // Prima si chiude la chat, poi si cancella: restando aperta, il
      // ricaricamento automatico ogni 20 secondi la segnerebbe di nuovo come
      // letta e lascerebbe dietro una riga orfana.
      setActive(null);
      setThread([]);
      await eliminaConversazione(phone);
      await refreshList();
    } finally {
      setEliminando(false);
    }
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

  // Cosa mostrare nell'elenco: le chat che corrispondono, e sotto le clienti
  // in anagrafica con cui una chat non c'è ancora.
  const q = cerca.trim().toLowerCase();
  const soloCifre = q.replace(/\D/g, '');
  const combacia = (testo: string) => testo.toLowerCase().includes(q);
  const chatMostrate = !q ? (conversations || []) : (conversations || []).filter(c =>
    combacia(c.name || '') || (soloCifre.length >= 3 && c.phone.includes(soloCifre))
  );
  const numeriInChat = new Set((conversations || []).map(c => c.phone.slice(-9)));
  const clientiSenzaChat = q.length < 2 ? [] : (rubrica || [])
    .filter(c => (combacia(c.nome) || (soloCifre.length >= 3 && c.phone.includes(soloCifre)))
      && !numeriInChat.has(c.phone.slice(-9)))
    .slice(0, 15);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-13rem)] min-h-[28rem]">
      {/* Elenco conversazioni */}
      <div className={`rounded-2xl bg-bg-secondary border border-border/50 flex flex-col overflow-hidden ${active ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
          <p className="text-sm font-semibold text-text-primary">Conversazioni</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setScegliCliente(v => !v)}
              className={`p-1.5 rounded-lg transition-colors ${scegliCliente ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-hover'}`}
              title="Scrivi a un cliente">
              <PenSquare className="w-3.5 h-3.5" />
            </button>
            {/* Il listino a chi lo chiede e in rubrica non c'è: si scrive solo
                il numero. È la richiesta più frequente al banco. */}
            <MandaListino soloIcona chiediNumero />
            <button onClick={manualRefresh} disabled={loadingList}
              className="p-1.5 rounded-lg text-text-muted hover:bg-bg-hover disabled:opacity-50" title="Aggiorna">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Ricerca: il modo normale di trovare una persona quando le chat
            sono centinaia. Cerca per nome o per numero. */}
        <div className="px-3 py-2 border-b border-border/40 flex-shrink-0">
          <div className="flex items-center gap-2 px-2.5 h-9 rounded-xl bg-bg-tertiary border border-border
            focus-within:border-accent/50 transition-colors">
            <Search className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            <input value={cerca} onChange={e => setCerca(e.target.value)} {...NO_AUTOFILL}
              placeholder="Cerca chat o cliente…"
              className="w-full min-w-0 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none" />
            {!!cerca && (
              <button onClick={() => setCerca('')} className="text-text-muted hover:text-text-primary flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrivere per primi: la conversazione non esiste ancora, quindi il
            numero non può che arrivare dall'anagrafica (o scritto a mano). */}
        {scegliCliente && (
          <ScegliDestinatario
            onScelto={phone => { setScegliCliente(false); openThread(phone); }}
            onChiudi={() => setScegliCliente(false)}
          />
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations === null ? (
            <p className="p-4 text-xs text-text-muted flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> carico…</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-xs text-text-muted leading-relaxed">
              Nessuna conversazione. Appena un cliente scrive al numero del centro comparirà qui.
            </p>
          ) : chatMostrate.map(c => (
            <button key={c.phone} onClick={() => openThread(c.phone)}
              className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-bg-hover transition-colors flex gap-3 ${active === c.phone ? 'bg-bg-hover' : ''}`}>
              <Faccia nome={c.name} phone={c.phone} avatar={c.avatar} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary truncate flex-1">{c.name || c.phone}</span>
                  {/* Qui la cliente si riconosce dal nome dell'anagrafica: i
                      segni servono prima di rispondere, non dopo. */}
                  <SegniCliente nome={c.name} />
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
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-text-muted/70">{timeLabel(c.lastAt)}</span>
                  {/* Col nome dall'anagrafica il numero sparirebbe dalla riga: lo teniamo qui */}
                  {c.name && <span className="text-[10px] text-text-muted/60 font-mono truncate">+{c.phone}</span>}
                  {!c.windowOpen && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted">CHIUSA</span>
                  )}
                  {/* Ha parlato per ultima lei e nessuno le ha risposto: è
                      l'unica etichetta che non se ne va aprendo la chat. */}
                  {c.daRispondere && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-error text-white flex-shrink-0">
                      DA RISPONDERE · {attesaLeggibile(c.attesaMinuti)}
                    </span>
                  )}
                  {/* Rimasta senza risposta troppo a lungo: la finestra è
                      chiusa e a testo libero non si può più scrivere. Si vede,
                      ma in grigio: è una cosa da sapere, non da fare adesso. */}
                  {c.rispostaScaduta && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-warning/15 text-warning flex-shrink-0">
                      MAI RISPOSTO · {attesaLeggibile(c.attesaMinuti)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {/* Cercata e non trovata fra le chat: forse non le ha mai scritto
              nessuno. Si apre da qui, senza passare da un'altra schermata. */}
          {q.length >= 2 && (
            <>
              {chatMostrate.length === 0 && clientiSenzaChat.length === 0 && rubrica !== null && (
                <p className="p-4 text-xs text-text-muted leading-relaxed">
                  Nessuna chat e nessuna cliente con questo nome.
                </p>
              )}
              {clientiSenzaChat.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                    In anagrafica, chat mai iniziata
                  </p>
                  {clientiSenzaChat.map(c => (
                    <button key={c.id} onClick={() => { setCerca(''); openThread(c.phone); }}
                      className="w-full text-left px-4 py-2.5 border-b border-border/30 hover:bg-bg-hover transition-colors flex items-center gap-3">
                      <Faccia nome={c.nome} phone={c.phone} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-text-primary truncate">{c.nome}</span>
                        <span className="block text-[10px] text-text-muted font-mono">+{c.phone}</span>
                      </span>
                      <PenSquare className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    </button>
                  ))}
                </>
              )}
            </>
          )}
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
                <p className="text-sm font-medium text-text-primary truncate flex items-center gap-1.5">
                  {clientName || conversations?.find(c => c.phone === active)?.name || active}
                  <SegniCliente nome={clientName || conversations?.find(c => c.phone === active)?.name} taglia="md" conMotivo />
                </p>
                <p className="text-[11px] text-text-muted font-mono">+{active}</p>
              </div>
              {/* "Quanto viene?" è la domanda più frequente in chat: la
                  risposta è un link, e parte da qui senza scriverla a mano. */}
              <MandaListino phone={active} nome={clientName || undefined} className="flex-shrink-0 py-1.5" />

              {/* Rimette la chat fra le non lette: chiude il thread, altrimenti
                  restando aperta verrebbe subito risegnata come letta. */}
              <button onClick={() => segnaDaLeggere(active)} title="Rimetti fra i messaggi da leggere"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-medium text-text-secondary hover:bg-bg-hover hover:text-accent transition-colors flex-shrink-0">
                <MailQuestion className="w-3.5 h-3.5" /> Da leggere
              </button>
              {/* Chiude il "da rispondere" senza scrivere: la cliente è stata
                  richiamata al telefono, o il messaggio non chiedeva niente.
                  Vale fino a adesso — se lei riscrive, torna in lista. */}
              <button onClick={() => segnaLetta(active)} disabled={segnando}
                title="Tolgo il segno DA RISPONDERE: l'ho gestita io"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-medium text-text-secondary hover:bg-success/10 hover:text-success hover:border-success/30 transition-colors flex-shrink-0 disabled:opacity-50">
                {segnando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Ho letto
              </button>
              {/* Numeri sbagliati, spam, prove: restavano in elenco marchiati
                  DA RISPONDERE e sporcavano l'unica lista che deve stare
                  pulita. Sta accanto al "Da leggere" perché è il gesto
                  gemello: uno la rimette in lista, l'altro la toglie. */}
              <button onClick={() => eliminaChat(active)} disabled={eliminando}
                title="Elimina questa conversazione dall'archivio"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-medium text-text-secondary hover:bg-error/10 hover:text-error hover:border-error/30 transition-colors flex-shrink-0 disabled:opacity-50">
                {eliminando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Elimina
              </button>
            </div>

            {/* Sta aspettando adesso, mentre guardi la chat: va detto qui, non
                solo nell'elenco che in questo momento non stai guardando. */}
            {(() => {
              const c = conversations?.find(x => x.phone === active);
              if (!c?.daRispondere) return null;
              return (
                <div className="px-4 py-2 bg-error/10 border-b border-error/20 flex items-center gap-2">
                  <MailQuestion className="w-3.5 h-3.5 text-error flex-shrink-0" />
                  <p className="text-[11px] text-error leading-tight">
                    Aspetta una risposta da <b>{attesaLeggibile(c.attesaMinuti)}</b>. Resta segnata finché non le
                    scrivi: anche solo &quot;a presto&quot; chiude la conversazione.
                  </p>
                </div>
              );
            })()}

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
              {/* Chi risponde a questo numero. Si vede qui, sopra la casella,
                  perché è qui che si sta per scrivere a mano — ed è qui che
                  serve sapere se il bot risponderà da solo o no. */}
              {muta.muta ? (
                <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 flex items-start gap-2">
                  <BotOff className="w-4 h-4 text-warning flex-shrink-0 mt-px" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-text-primary font-medium">
                      {muta.spenta
                        ? 'Segretaria spenta su questa conversazione.'
                        : `La segretaria non risponde a questo numero${muta.fino ? ` fino alle ${timeLabel(muta.fino)}` : ''}.`}
                    </p>
                    {!muta.spenta && muta.motivo && (
                      <p className="text-[10px] text-text-secondary mt-0.5 break-words">{muta.motivo}</p>
                    )}
                    <p className="text-[10px] text-text-muted/80 mt-0.5">
                      {muta.spenta
                        ? 'Vale solo per questo numero: alle altre clienti risponde come sempre. Finché è spenta, qui rispondi tu.'
                        : 'Ha passato la palla a una persona: finché dura, chi scrive resta senza risposta se non rispondi tu.'}
                    </p>
                  </div>
                  <button
                    onClick={() => void riprendi(active)}
                    disabled={riprendendo}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg border border-warning/40 bg-bg-tertiary
                      text-text-primary hover:border-warning disabled:opacity-40 flex-shrink-0">
                    {riprendendo ? <Loader2 className="w-3 h-3 animate-spin" /> : (muta.spenta ? 'Riaccendi' : 'Falla riprendere')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[10px] text-text-muted/80">
                  <BotOn className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span className="flex-1">A questo numero risponde la segretaria.</span>
                  <button
                    onClick={() => void spegni(active)}
                    disabled={riprendendo}
                    className="px-2 py-1 rounded-lg border border-border bg-bg-tertiary text-text-secondary
                      hover:text-warning hover:border-warning/40 disabled:opacity-40 flex-shrink-0">
                    {riprendendo ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Spegnila qui'}
                  </button>
                </div>
              )}
              {caricandoThread ? (
                <p className="flex items-center gap-2 text-[11px] text-text-muted py-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> apro la conversazione…
                </p>
              ) : !windowOpen ? (
                <FinestraChiusa
                  phone={active}
                  nome={clientName || conversations?.find(c => c.phone === active)?.name}
                  mai={thread.length === 0}
                  onInviato={() => { void loadThread(active); void refreshList(); }}
                />
              ) : (
                <>
                  <div className="flex items-end gap-2 relative">
                    {/* Le faccine: si aprono sopra alla casella, non sotto, o
                        finirebbero fuori dallo schermo sui portatili bassi. */}
                    {emojiAperto && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setEmojiAperto(false)} />
                        <div className="absolute bottom-full left-0 mb-2 z-20 w-72 max-h-64 overflow-y-auto
                          rounded-2xl border border-border bg-bg-secondary shadow-2xl p-3 space-y-2">
                          {EMOJI.map(gruppo => (
                            <div key={gruppo.titolo}>
                              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">{gruppo.titolo}</p>
                              <div className="flex flex-wrap gap-0.5">
                                {gruppo.lista.map(e => (
                                  <button key={e} onClick={() => inserisciEmoji(e)} title={e}
                                    className="w-8 h-8 rounded-lg text-lg leading-none hover:bg-bg-hover transition-colors">
                                    {e}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <button onClick={() => setEmojiAperto(v => !v)} title="Faccine"
                      className={`p-2.5 rounded-xl border transition-colors flex-shrink-0 ${
                        emojiAperto ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border bg-bg-tertiary text-text-secondary hover:text-accent'
                      }`}>
                      <Smile className="w-4 h-4" />
                    </button>
                    <textarea
                      ref={rispostaRef}
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
