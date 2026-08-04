'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, ChevronDown, Loader2, CheckCircle2, AlertTriangle, Clock, Heart, Gift, Star, CalendarPlus, Bot } from 'lucide-react';
import {
  loadWaConfig, saveWaConfig, loadWaStatus, previewAutomation, runAutomationNow, checkTemplates, loadWaInbox,
  type WaStatus, type TemplateCheck, type WaInboxMessage,
} from '@/app/actions/whatsapp';
import type { WaAutomationsConfig, RunResult } from '@/lib/wa-automations';
import { GOOGLE_REVIEW_URL } from '@/lib/links';

type Key = 'reminder' | 'recall' | 'birthday' | 'review';

const AUTOMATIONS: { key: Key; icon: typeof Clock; title: string; desc: string; marketing: boolean; when: string }[] = [
  { key: 'reminder', icon: Clock, title: 'Promemoria appuntamento', desc: 'Alle 18:00 avvisa chi ha un appuntamento domani', marketing: false, when: '18:00' },
  { key: 'recall', icon: Heart, title: 'Recall clienti dormienti', desc: 'Alle 11:00 ricontatta chi non torna da un po\'', marketing: true, when: '11:00' },
  { key: 'birthday', icon: Gift, title: 'Auguri compleanno', desc: 'Alle 09:30 manda gli auguri e lo sconto regalo', marketing: true, when: '09:30' },
  { key: 'review', icon: Star, title: 'Richiesta recensione', desc: 'Alle 19:30 la chiede a chi è venuto ieri', marketing: false, when: '19:30' },
];

const TPL_STATUS: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: 'Approvato', cls: 'text-success' },
  PENDING: { label: 'In revisione', cls: 'text-warning' },
  REJECTED: { label: 'Rifiutato', cls: 'text-error' },
  MISSING: { label: 'Da creare', cls: 'text-error' },
};

export default function WhatsAppAutomationsConfig() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<WaAutomationsConfig | null>(null);
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [checks, setChecks] = useState<TemplateCheck[] | null>(null);
  const [inbox, setInbox] = useState<WaInboxMessage[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadWaConfig().then(setCfg).catch(() => undefined);
    loadWaStatus().then(setStatus).catch(() => undefined);
  }, []);

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const save = async (patch: Partial<WaAutomationsConfig>) => {
    if (!cfg) return;
    const next = { ...cfg, ...patch };
    setCfg(next);
    setSaving(true);
    await saveWaConfig(next);
    setSaving(false);
  };

  const doPreview = async (key: Key) => {
    setBusy(`preview:${key}`);
    setResult(null);
    const r = await previewAutomation(key);
    setBusy(null);
    if (!r) return flash(false, 'Nessun risultato');
    if (r.skipped) return flash(false, r.skipped);
    setResult(r);
  };

  const doSend = async (key: Key, title: string) => {
    setBusy(`send:${key}`);
    const r = await runAutomationNow(key);
    setBusy(null);
    if (!r) return flash(false, 'Nessun risultato');
    if (r.skipped) return flash(false, r.skipped);
    setResult(r);
    flash(r.failed === 0, `${title}: ${r.sent} inviati, ${r.failed} falliti su ${r.candidates} candidati`);
  };

  const doLoadInbox = async () => {
    setBusy('inbox');
    const r = await loadWaInbox().catch(() => []);
    setBusy(null);
    setInbox(r);
  };

  const doCheckTemplates = async () => {
    setBusy('templates');
    const r = await checkTemplates();
    setBusy(null);
    if (!r.ok) return flash(false, r.error || 'Verifica fallita');
    setChecks(r.checks || []);
  };

  const configured = status?.provider === '360dialog';
  const anyOn = cfg ? AUTOMATIONS.some(a => cfg[a.key]) || cfg.confirm : false;
  // La simulazione riguarda solo le automazioni a orario: il bot di prenotazione
  // risponde davvero anche a simulazione accesa, e l'etichetta non deve mentire.
  const headStatus = !configured
    ? { label: 'Da configurare', cls: 'bg-warning/10 text-warning' }
    : cfg?.dryRun
      ? cfg.booking
        ? { label: 'Simulazione · bot attivo', cls: 'bg-warning/10 text-warning' }
        : { label: 'Simulazione', cls: 'bg-warning/10 text-warning' }
      : anyOn || cfg?.booking
        ? { label: 'Attivo', cls: 'bg-success/10 text-success' }
        : { label: 'Spento', cls: 'bg-bg-tertiary text-text-muted' };

  return (
    <div className="rounded-xl bg-bg-tertiary/50 border border-border/30 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 p-4 text-left">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#25D36615' }}>
          <MessageSquare className="w-5 h-5" style={{ color: '#25D366' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-text-primary">Messaggi WhatsApp automatici</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${headStatus.cls}`}>{headStatus.label}</span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">Promemoria, recall, auguri e recensioni sul numero ufficiale RevoBeauty.</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && cfg && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          {/* Stato collegamento */}
          {!configured && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-text-secondary leading-relaxed">
                {status?.provider === 'evolution'
                  ? <>Stai ancora usando <b>Evolution</b> (non ufficiale). Aggiungi <code className="text-warning">D360_API_KEY</code> su Railway per passare a 360dialog.</>
                  : <>WhatsApp non collegato: manca <code className="text-warning">{status?.missing.join(', ') || 'D360_API_KEY'}</code> nelle variabili d&apos;ambiente su Railway.</>}
              </div>
            </div>
          )}

          {/* Modalità simulazione */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-bg-secondary border border-border/50">
            <div className="min-w-0">
              <span className="text-sm font-medium text-text-primary">Modalità simulazione</span>
              <p className="text-[11px] text-text-muted">Le automazioni girano ma non mandano niente. Spegnila quando sei pronta a partire davvero.</p>
            </div>
            <button onClick={() => save({ dryRun: !cfg.dryRun })} disabled={saving}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${cfg.dryRun ? 'bg-warning' : 'bg-bg-hover'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${cfg.dryRun ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {/* Conferma alla prenotazione: non è a orario, scatta appena
              l'appuntamento entra in agenda. Sta prima delle altre perché è il
              primo messaggio che il cliente riceve. */}
          <div className="p-3 rounded-xl bg-bg-secondary border border-border/50">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-text-primary">Conferma appuntamento</span>
                  <p className="text-[11px] text-text-muted">
                    Appena l&apos;appuntamento entra in agenda, il cliente riceve la conferma con trattamento, giorno e ora.
                  </p>
                </div>
              </div>
              <button onClick={() => save({ confirm: !cfg.confirm })} disabled={saving}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${cfg.confirm ? 'bg-success' : 'bg-bg-hover'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${cfg.confirm ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <p className="text-[10px] text-text-muted/70 mt-2 leading-relaxed">
              Vale per tutti i canali: gestionale, prenotazione online, bot WhatsApp e assistente vocale.
              Richiede il template <code className="text-warning">conferma_appuntamento</code> approvato da Meta.
              La modalità simulazione qui sopra la blocca come le altre.
            </p>
          </div>

          {/* Le quattro automazioni */}
          <div className="p-3 rounded-xl bg-bg-secondary border border-border/50 space-y-3">
            {AUTOMATIONS.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={a.key} className={`flex items-center justify-between gap-2 ${i > 0 ? 'border-t border-border/40 pt-3' : ''}`}>
                  <div className="min-w-0 flex items-start gap-2">
                    <Icon className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-text-primary">{a.title}</span>
                      {a.marketing && <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent align-middle">MARKETING</span>}
                      <p className="text-[11px] text-text-muted">{a.desc}</p>
                      {a.marketing && <p className="text-[10px] text-text-muted/70">Solo ai clienti con consenso marketing.</p>}
                      {/* Il link non viaggia nel testo del messaggio: sta nel bottone
                          URL del template, che si configura a mano su 360dialog. Averlo
                          qui evita di andarlo a ricostruire ogni volta. */}
                      {a.key === 'review' && (
                        <p className="text-[10px] text-text-muted/70 mt-1 leading-relaxed">
                          Bottone del template → <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline">link recensione</a> (scheda di Maddaloni).
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => doPreview(a.key)} disabled={busy !== null}
                      className="text-[11px] px-2 py-1 rounded-lg bg-bg-tertiary border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-50">
                      {busy === `preview:${a.key}` ? '...' : 'Anteprima'}
                    </button>
                    <button onClick={() => doSend(a.key, a.title)} disabled={busy !== null || !configured}
                      className="text-[11px] px-2 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40">
                      {busy === `send:${a.key}` ? '...' : 'Invia ora'}
                    </button>
                    <button onClick={() => save({ [a.key]: !cfg[a.key] } as Partial<WaAutomationsConfig>)} disabled={saving}
                      className={`relative w-11 h-6 rounded-full transition-colors ${cfg[a.key] ? 'bg-success' : 'bg-bg-hover'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${cfg[a.key] ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Le conversazioni vivono nella loro schermata: qui basta il collegamento
              e l'ultimo messaggio, come prova che il webhook stia consegnando. */}
          <div className="p-3 rounded-xl bg-bg-secondary border border-border/50 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-secondary">Conversazioni con i clienti</p>
                <p className="text-[10px] text-text-muted/70">
                  Leggi le chat, vedi cosa ha risposto l&apos;assistente e rispondi a mano.
                </p>
              </div>
              <Link href="/dashboard/whatsapp"
                className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 flex-shrink-0 whitespace-nowrap">
                Apri le chat
              </Link>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
              <p className="text-[10px] text-text-muted/70 min-w-0">
                Se dopo aver scritto al numero del centro non arriva nulla, il webhook non sta consegnando.
              </p>
              <button onClick={doLoadInbox} disabled={busy !== null}
                className="text-[11px] px-2 py-1 rounded-lg bg-bg-tertiary border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-50 flex-shrink-0">
                {busy === 'inbox' ? '...' : 'Verifica'}
              </button>
            </div>
            {inbox !== null && (
              inbox.length === 0
                ? <p className="text-[11px] text-warning">Nessun messaggio ricevuto finora.</p>
                : <p className="text-[11px] text-success">
                    Ultimo messaggio da {inbox[0].name || inbox[0].phone} il{' '}
                    {new Date(inbox[0].receivedAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.
                  </p>
            )}
          </div>

          {/* Prenotazione da WhatsApp: non è un'automazione a orario, reagisce ai
              messaggi in arrivo. Scrive in agenda, quindi ha un avviso dedicato. */}
          <div className="p-3 rounded-xl bg-bg-secondary border border-border/50">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-start gap-2">
                <CalendarPlus className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-text-primary">Prenotazione da WhatsApp</span>
                  <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-warning/15 text-warning align-middle">RISPONDE DA SOLO</span>
                  <p className="text-[11px] text-text-muted">
                    Chi scrive &quot;prenota&quot; viene guidato con menù numerati: trattamento, giorno, orario, conferma.
                  </p>
                </div>
              </div>
              <button onClick={() => save({ booking: !cfg.booking })} disabled={saving}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${cfg.booking ? 'bg-success' : 'bg-bg-hover'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${cfg.booking ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {cfg.booking ? (
              <p className="text-[10px] text-warning mt-2 leading-relaxed">
                Attivo: gli appuntamenti entrano in agenda da soli, con le stesse regole di disponibilità
                della pagina di prenotazione online. Ogni prenotazione ti arriva su Telegram.
              </p>
            ) : (
              <p className="text-[10px] text-text-muted/70 mt-2 leading-relaxed">
                Spento: i messaggi dei clienti restano in archivio e risponde una persona.
              </p>
            )}
            <p className="text-[10px] text-text-muted/70 mt-1 leading-relaxed">
              Richiede il webhook 360dialog configurato. La simulazione qui sopra non lo riguarda: se lo accendi, risponde davvero.
            </p>
          </div>

          {/* Assistente AI */}
          <div className="p-3 rounded-xl bg-bg-secondary border border-border/50">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-start gap-2">
                <Bot className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-text-primary">Assistente AI</span>
                  <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-warning/15 text-warning align-middle">RISPONDE DA SOLO</span>
                  <p className="text-[11px] text-text-muted">
                    Risponde alle domande dei clienti su trattamenti, prezzi e durate, leggendo il listino reale del gestionale.
                  </p>
                </div>
              </div>
              <button onClick={() => save({ assistant: !cfg.assistant })} disabled={saving}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${cfg.assistant ? 'bg-success' : 'bg-bg-hover'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${cfg.assistant ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <p className="text-[10px] text-text-muted/70 mt-2 leading-relaxed">
              Non dà indicazioni mediche e non inventa prezzi: sulle domande cliniche rimanda alla valutazione in sede.
              Chi vuole prenotare viene indirizzato alla prenotazione guidata. Massimo 20 risposte al giorno per numero.
              Ogni risposta ha un costo: richiede <code className="text-warning">ANTHROPIC_API_KEY</code> tra le variabili d&apos;ambiente.
            </p>
          </div>

          {/* Parametri */}
          <div className="p-3 rounded-xl bg-bg-secondary border border-border/50 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Dormiente dopo (giorni)</label>
              <input type="number" min={15} value={cfg.recallDays}
                onChange={e => save({ recallDays: Number(e.target.value) || 60 })}
                className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Non ricontattare per (giorni)</label>
              <input type="number" min={30} value={cfg.recallCooldownDays}
                onChange={e => save({ recallCooldownDays: Number(e.target.value) || 90 })}
                className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Regalo compleanno</label>
              <input type="text" value={cfg.birthdayDiscount}
                onChange={e => save({ birthdayDiscount: e.target.value })} placeholder="il 20%"
                className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Validità regalo (giorni)</label>
              <input type="number" min={7} value={cfg.birthdayValidDays}
                onChange={e => save({ birthdayValidDays: Number(e.target.value) || 30 })}
                className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
            </div>
          </div>

          {/* Template */}
          <div className="p-3 rounded-xl bg-bg-secondary border border-border/50 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-text-secondary">Template approvati da Meta</p>
              <button onClick={doCheckTemplates} disabled={busy !== null || !configured}
                className="text-[11px] px-2 py-1 rounded-lg bg-bg-tertiary border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-50">
                {busy === 'templates' ? '...' : 'Verifica'}
              </button>
            </div>
            {checks ? checks.map(c => {
              const st = TPL_STATUS[c.status] || { label: c.status, cls: 'text-text-muted' };
              return (
                <div key={c.key} className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-text-muted truncate">{c.name}</span>
                  <span className={`font-semibold flex-shrink-0 ml-2 ${st.cls}`}>{st.label}</span>
                </div>
              );
            }) : (
              <p className="text-[11px] text-text-muted">Un&apos;automazione parte solo se il suo template è <b>Approvato</b> su 360dialog.</p>
            )}
          </div>

          {/* Esito anteprima / invio */}
          {result && (
            <div className="p-3 rounded-xl bg-bg-secondary border border-border/50 space-y-2 max-h-72 overflow-y-auto">
              <p className="text-xs font-semibold text-text-secondary">
                {result.dryRun ? 'Simulazione' : 'Invio'} · {result.candidates} destinatari
                {!result.dryRun && ` · ${result.sent} ok, ${result.failed} falliti`}
              </p>
              {result.candidates === 0 && <p className="text-[11px] text-text-muted">Nessun destinatario per oggi.</p>}
              {result.details.slice(0, 20).map((d, i) => (
                <div key={i} className="text-[11px] border-t border-border/40 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{d.name}</span>
                    <span className="text-text-muted font-mono">{d.to}</span>
                    {!d.ok && <span className="text-error">{d.error}</span>}
                  </div>
                  <p className="text-text-muted whitespace-pre-line mt-0.5">{d.preview}</p>
                </div>
              ))}
              {result.details.length > 20 && <p className="text-[11px] text-text-muted">…e altri {result.details.length - 20}.</p>}
            </div>
          )}

          {msg && (
            <p className={`text-xs font-medium flex items-center gap-1.5 ${msg.ok ? 'text-success' : 'text-error'}`}>
              {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{msg.text}
            </p>
          )}
          {saving && <p className="text-[11px] text-text-muted flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> salvo…</p>}
        </div>
      )}
    </div>
  );
}
