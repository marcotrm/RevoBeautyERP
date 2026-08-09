'use client';

/**
 * Campagne WhatsApp dal gestionale.
 *
 * Due cose che prima si potevano fare solo su 360dialog:
 *  1. scrivere un messaggio e mandarlo in approvazione a Meta (template);
 *  2. spedirlo ai clienti scelti a mano.
 *
 * Il vincolo di Meta resta e non si aggira: a chi non ci ha scritto nelle
 * ultime 24 ore si può mandare solo un template approvato. Per questo la
 * schermata è in due passi e mostra sempre lo stato dell'approvazione.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MessageSquare, Plus, Send, RefreshCw, Loader2, CheckCircle, AlertTriangle,
  Search, Users, X, Clock,
} from 'lucide-react';
import {
  listaTemplate, creaTemplate, clientiPerCampagna, inviaCampagna,
  type TemplateRemoto, type DestinatarioCampagna, type EsitoCampagna,
} from '@/app/actions/campagne';
import { NO_AUTOFILL } from '@/lib/noAutofill';

function StatoTemplate({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === 'APPROVED') return <span className="px-2 py-0.5 rounded-md bg-success/15 text-success text-[10px] font-bold uppercase">Approvato</span>;
  if (s === 'REJECTED') return <span className="px-2 py-0.5 rounded-md bg-error/15 text-error text-[10px] font-bold uppercase">Rifiutato</span>;
  return <span className="px-2 py-0.5 rounded-md bg-warning/15 text-warning text-[10px] font-bold uppercase">In attesa</span>;
}

export default function CampagneWhatsApp() {
  const [templates, setTemplates] = useState<TemplateRemoto[] | null>(null);
  const [erroreTpl, setErroreTpl] = useState<string | null>(null);
  const [caricando, setCaricando] = useState(false);

  // --- creazione template ---
  const [apriNuovo, setApriNuovo] = useState(false);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [testo, setTesto] = useState('Ciao {{1}}, ');
  const [creando, setCreando] = useState(false);
  const [esitoCrea, setEsitoCrea] = useState<{ ok: boolean; msg: string } | null>(null);

  // --- invio ---
  const [scelto, setScelto] = useState<TemplateRemoto | null>(null);
  const [clienti, setClienti] = useState<DestinatarioCampagna[] | null>(null);
  const [selezionati, setSelezionati] = useState<Set<string>>(new Set());
  const [cerca, setCerca] = useState('');
  // Chi far vedere nell'elenco: una campagna per sole donne non deve costringere
  // a spuntare 120 caselle stando attenti a non prendere un uomo per sbaglio.
  const [sesso, setSesso] = useState<'tutti' | 'F' | 'M' | 'ND'>('tutti');
  const [soloConsenso, setSoloConsenso] = useState(false);
  // Spento di proposito: chi non ha dato il consenso viene saltato, a meno che
  // non si scelga qui di mandarglielo lo stesso.
  const [forzaSenzaConsenso, setForzaSenzaConsenso] = useState(false);
  const [inviando, setInviando] = useState(false);
  const [esitoInvio, setEsitoInvio] = useState<EsitoCampagna | null>(null);

  const caricaTemplate = useCallback(async () => {
    setCaricando(true);
    try {
      const r = await listaTemplate();
      setTemplates(r.templates);
      setErroreTpl(r.ok ? null : r.error || 'Errore');
    } finally { setCaricando(false); }
  }, []);

  useEffect(() => { caricaTemplate(); }, [caricaTemplate]);
  useEffect(() => { clientiPerCampagna().then(setClienti).catch(() => setClienti([])); }, []);

  const salvaTemplate = async () => {
    setCreando(true);
    setEsitoCrea(null);
    try {
      const r = await creaTemplate({ nome, categoria, testo });
      if (r.ok) {
        setEsitoCrea({ ok: true, msg: `Template "${r.nome}" inviato a Meta per approvazione (stato: ${r.status}). Di solito risponde in pochi minuti.` });
        setNome(''); setTesto('Ciao {{1}}, ');
        await caricaTemplate();
      } else {
        setEsitoCrea({ ok: false, msg: r.error || 'Errore' });
      }
    } finally { setCreando(false); }
  };

  const filtrati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    let list = clienti ?? [];
    if (sesso === 'ND') list = list.filter(c => c.sesso === null || c.discordante);
    else if (sesso !== 'tutti') list = list.filter(c => c.sesso === sesso && !c.discordante);
    if (soloConsenso) list = list.filter(c => c.marketingConsent);
    return q ? list.filter(c => c.nome.toLowerCase().includes(q) || c.phone.includes(q)) : list;
  }, [clienti, cerca, sesso, soloConsenso]);

  // Quanti sono in ogni gruppo: serve per scegliere il filtro con cognizione
  const conteggi = useMemo(() => {
    const l = clienti ?? [];
    const c = (f: (x: DestinatarioCampagna) => boolean) => l.filter(f).length;
    return {
      tutti: l.length,
      F: c(x => x.sesso === 'F' && !x.discordante),
      M: c(x => x.sesso === 'M' && !x.discordante),
      ND: c(x => x.sesso === null || x.discordante),
      dedotti: c(x => x.dedotto),
      discordanti: c(x => x.discordante),
    };
  }, [clienti]);

  const FILTRI = [
    { key: 'tutti' as const, label: 'Tutti', n: conteggi.tutti },
    { key: 'F' as const, label: 'Solo donne', n: conteggi.F },
    { key: 'M' as const, label: 'Solo uomini', n: conteggi.M },
    { key: 'ND' as const, label: 'Da controllare', n: conteggi.ND },
  ];

  const marketing = (scelto?.category || '').toUpperCase() === 'MARKETING';
  // Con un template promozionale chi ha revocato il consenso viene saltato:
  // meglio dirlo prima che scoprirlo dal conteggio finale.
  const senzaConsenso = useMemo(
    () => (clienti ?? []).filter(c => selezionati.has(c.id) && !c.marketingConsent).length,
    [clienti, selezionati]
  );

  const toggle = (id: string) => {
    setSelezionati(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setEsitoInvio(null);
  };

  const invia = async () => {
    if (!scelto) return;
    const quanti = selezionati.size;
    const forzati = marketing && forzaSenzaConsenso ? senzaConsenso : 0;
    if (!window.confirm(
      `Mandare "${scelto.name}" a ${quanti} client${quanti === 1 ? 'e' : 'i'}?\n\n` +
      (forzati > 0
        ? `Di questi, ${forzati} non risultano aver dato il consenso al marketing e lo riceveranno lo stesso.\n\n`
        : '') +
      'I messaggi partono davvero e non si possono richiamare.'
    )) return;
    setInviando(true);
    try {
      setEsitoInvio(await inviaCampagna({
        templateName: scelto.name,
        categoria: scelto.category,
        clientIds: [...selezionati],
        anteprima: testoAnteprima,
        includiSenzaConsenso: forzaSenzaConsenso,
      }));
    } finally { setInviando(false); }
  };

  // Del template remoto Meta non ci ridà il corpo: si mostra quello scritto
  // adesso solo se combacia il nome, altrimenti un testo generico.
  const testoAnteprima = scelto && nome && scelto.name === nome ? testo : `[${scelto?.name ?? ''}]`;

  const approvati = (templates ?? []).filter(t => t.status.toUpperCase() === 'APPROVED');

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-success/10 text-success"><MessageSquare className="w-5 h-5" /></div>
          <div>
            <h3 className="text-base font-display font-semibold text-text-primary">Campagne WhatsApp</h3>
            <p className="text-xs text-text-muted">Scrivi il messaggio, fallo approvare e mandalo ai clienti che scegli</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={caricaTemplate} disabled={caricando}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${caricando ? 'animate-spin' : ''}`} /> Aggiorna
          </button>
          <button onClick={() => { setApriNuovo(v => !v); setEsitoCrea(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 text-accent border border-accent/20 text-xs font-semibold hover:bg-accent/20">
            <Plus className="w-3.5 h-3.5" /> Nuovo messaggio
          </button>
        </div>
      </div>

      {/* 1. Creazione template */}
      {apriNuovo && (
        <div className="px-5 py-4 border-b border-border bg-bg-tertiary/30 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Nome (solo per te)</label>
              <input value={nome} onChange={e => setNome(e.target.value)} {...NO_AUTOFILL} placeholder="es. promo agosto"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Tipo</label>
              <div className="flex rounded-xl border border-border overflow-hidden">
                {(['MARKETING', 'UTILITY'] as const).map(c => (
                  <button key={c} onClick={() => setCategoria(c)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors ${categoria === c ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'}`}>
                    {c === 'MARKETING' ? 'Promozionale' : 'Di servizio'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Messaggio — scrivi <code className="text-accent">{'{{1}}'}</code> dove vuoi il nome della cliente
            </label>
            <textarea value={testo} onChange={e => setTesto(e.target.value)} rows={4}
              placeholder="Ciao {{1}}, ad agosto abbiamo il 20% su tutti i massaggi. Ti va di fissare un appuntamento?"
              className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary resize-none" />
            <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
              Niente link accorciati, niente parole tipo &quot;gratis&quot; ripetute e nessun riferimento a
              procedure mediche: Meta rifiuta. I promozionali vanno solo a chi ha dato il consenso marketing.
            </p>
          </div>

          {esitoCrea && (
            <p className={`flex items-start gap-2 text-xs p-3 rounded-xl ${esitoCrea.ok ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
              {esitoCrea.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              {esitoCrea.msg}
            </p>
          )}

          <button onClick={salvaTemplate} disabled={creando || !nome.trim() || !testo.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold disabled:opacity-50">
            {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Manda in approvazione
          </button>
        </div>
      )}

      {/* 2. Elenco template */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">I tuoi messaggi</p>
        {erroreTpl && <p className="text-xs text-error mb-2">{erroreTpl}</p>}
        {templates === null && <p className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /> carico…</p>}
        <div className="space-y-1.5">
          {(templates ?? []).map(t => {
            const usabile = t.status.toUpperCase() === 'APPROVED';
            const attivo = scelto?.name === t.name;
            return (
              <button key={`${t.name}-${t.language}`} disabled={!usabile}
                onClick={() => { setScelto(t); setEsitoInvio(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  attivo ? 'border-accent bg-accent/10' : 'border-border bg-bg-tertiary/30'
                } ${usabile ? 'hover:bg-bg-hover cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{t.name}</p>
                  <p className="text-[11px] text-text-muted">{t.category === 'MARKETING' ? 'Promozionale' : 'Di servizio'} · {t.language}</p>
                </div>
                <StatoTemplate status={t.status} />
              </button>
            );
          })}
          {templates?.length === 0 && (
            <p className="text-sm text-text-muted py-3">Nessun messaggio ancora. Creane uno con &quot;Nuovo messaggio&quot;.</p>
          )}
        </div>
        {approvati.length === 0 && templates && templates.length > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-warning mt-2">
            <Clock className="w-3.5 h-3.5" /> Nessun messaggio ancora approvato: finché Meta non risponde non si può inviare.
          </p>
        )}
      </div>

      {/* 3. Destinatari e invio */}
      {scelto && (
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-text-primary">
              Invio di <strong>{scelto.name}</strong> a <strong>{selezionati.size}</strong> client{selezionati.size === 1 ? 'e' : 'i'}
            </p>
            <button onClick={() => { setScelto(null); setSelezionati(new Set()); }}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"><X className="w-3.5 h-3.5" /> annulla</button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTRI.map(f => (
              <button key={f.key} onClick={() => { setSesso(f.key); setSelezionati(new Set()); setEsitoInvio(null); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  sesso === f.key ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                }`}>
                {f.label} <span className="opacity-70">{f.n}</span>
              </button>
            ))}
            <button onClick={() => { setSoloConsenso(v => !v); setSelezionati(new Set()); setEsitoInvio(null); }}
              title="Con un messaggio promozionale chi non ha dato il consenso viene saltato comunque"
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                soloConsenso ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
              }`}>
              Solo con consenso
            </button>
          </div>

          {(conteggi.dedotti > 0 || conteggi.discordanti > 0) && (
            <p className="text-[11px] text-text-muted leading-relaxed">
              {conteggi.dedotti > 0 && <>In {conteggi.dedotti} schede il sesso non è indicato: è stato dedotto dal nome (segnate con <b>?</b>). </>}
              {conteggi.discordanti > 0 && <><b className="text-warning">{conteggi.discordanti}</b> schede dicono il contrario del nome (es. un nome da uomo salvato come donna): stanno in &quot;Da controllare&quot;, non fra le donne.</>}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={cerca} onChange={e => setCerca(e.target.value)} {...NO_AUTOFILL} placeholder="Cerca cliente o numero…"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
            </div>
            <button onClick={() => { setSelezionati(new Set(filtrati.map(c => c.id))); setEsitoInvio(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
              <Users className="w-3.5 h-3.5" /> Seleziona tutti ({filtrati.length})
            </button>
            {selezionati.size > 0 && (
              <button onClick={() => { setSelezionati(new Set()); setEsitoInvio(null); }}
                className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
                Deseleziona
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border/30">
            {filtrati.map(c => (
              <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-bg-hover cursor-pointer">
                <input type="checkbox" checked={selezionati.has(c.id)} onChange={() => toggle(c.id)} className="accent-current w-4 h-4" />
                <span className="text-sm text-text-primary flex-1 truncate">
                  {c.nome}
                  <span className={`text-[10px] ml-1.5 ${c.discordante ? 'text-warning' : 'text-text-muted'}`}
                    title={c.discordante ? 'La scheda e il nome non concordano: controlla prima di mandare'
                      : c.dedotto ? 'Sesso dedotto dal nome: in scheda non è indicato' : undefined}>
                    {c.sesso === 'F' ? '♀' : c.sesso === 'M' ? '♂' : '—'}
                    {c.discordante ? ' ⚠' : c.dedotto ? '?' : ''}
                  </span>
                </span>
                {marketing && !c.marketingConsent && (
                  <span className="text-[10px] text-warning flex-shrink-0">no consenso</span>
                )}
                <span className="text-[11px] text-text-muted font-mono flex-shrink-0">+{c.phone}</span>
              </label>
            ))}
            {clienti === null && <p className="px-3 py-6 text-center text-sm text-text-muted">carico i clienti…</p>}
            {clienti?.length === 0 && <p className="px-3 py-6 text-center text-sm text-text-muted">Nessun cliente con un numero valido</p>}
          </div>

          {marketing && senzaConsenso > 0 && (
            <div className={`p-3 rounded-xl border ${forzaSenzaConsenso ? 'bg-warning/10 border-warning/30' : 'border-border'}`}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={forzaSenzaConsenso} onChange={e => setForzaSenzaConsenso(e.target.checked)}
                  className="accent-current w-4 h-4 mt-px flex-shrink-0" />
                <span className="text-[11px] leading-relaxed">
                  <b className="text-text-primary">
                    Manda anche a {senzaConsenso} selezionat{senzaConsenso === 1 ? 'a' : 'e'} senza consenso marketing in scheda.
                  </b>
                  <span className="text-text-secondary">
                    {' '}Senza la spunta vengono saltate. Mettila solo se il consenso ce l&apos;hai davvero
                    (modulo privacy firmato in negozio) e in anagrafica non è mai stato registrato: chi riceve
                    un promozionale che non si aspetta può bloccare il numero, e troppi blocchi fanno scendere
                    la qualità del numero WhatsApp del centro.
                  </span>
                </span>
              </label>
            </div>
          )}

          {esitoInvio && (
            <div className={`p-3 rounded-xl ${esitoInvio.falliti > 0 ? 'bg-warning/10 border border-warning/30' : 'bg-success/10 border border-success/30'}`}>
              <p className="text-sm font-semibold text-text-primary">
                Inviati {esitoInvio.inviati}
                {esitoInvio.saltati > 0 && ` · saltati ${esitoInvio.saltati}`}
                {esitoInvio.falliti > 0 && ` · non partiti ${esitoInvio.falliti}`}
              </p>
              {esitoInvio.errori.map((e, i) => <p key={i} className="text-xs text-text-secondary mt-1">{e}</p>)}
            </div>
          )}

          <button onClick={invia} disabled={inviando || selezionati.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold disabled:opacity-50">
            {inviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Invia a {selezionati.size}
          </button>
        </div>
      )}
    </div>
  );
}
