'use client';

/**
 * Affiliazione — pannello di gestione.
 *
 * Tre schede: gli affiliati (le attività partner con la loro commissione e il
 * link del portale), i loro QR code (creazione, sospensione, sostituzione,
 * download e locandina) e le registrazioni arrivate dalle landing (con
 * verifica manuale e spunta "omaggio usato").
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  QrCode, Users, Plus, Copy, Download, Printer, ExternalLink,
  RefreshCw, Pause, Play, Ban, Check, Gift, ShieldAlert, MessageSquare, X,
} from 'lucide-react';
import {
  listaAffiliati, creaAffiliato, aggiornaAffiliato,
  listaQr, creaQr, cambiaStatoQr, sostituisciQr,
  listaRegistrazioni, segnaOmaggioUsato, verificaManualmente,
  statoOtpWhatsApp, creaTemplateOtp,
  type AffiliatoRiga, type QrRiga, type LeadRiga,
} from '@/app/actions/affiliazione';

const eur = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const dataIt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

const STATO_QR: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Bozza', cls: 'bg-bg-tertiary text-text-secondary' },
  active: { label: 'Attivo', cls: 'bg-success/15 text-success' },
  suspended: { label: 'Sospeso', cls: 'bg-warning/15 text-warning' },
  expired: { label: 'Scaduto', cls: 'bg-warning/15 text-warning' },
  disabled: { label: 'Disattivato', cls: 'bg-bg-tertiary text-text-muted' },
  blocked: { label: 'Bloccato', cls: 'bg-error/15 text-error' },
};

const MOTIVO_BLOCCO: Record<string, string> = {
  gia_cliente: 'già cliente',
  doppione: 'doppione',
  auto_registrazione: 'auto-registrazione',
};

type Tab = 'affiliati' | 'qr' | 'registrazioni';

export default function AffiliatiPage() {
  const [tab, setTab] = useState<Tab>('affiliati');
  const [affiliati, setAffiliati] = useState<AffiliatoRiga[]>([]);
  const [qrs, setQrs] = useState<QrRiga[]>([]);
  const [leads, setLeads] = useState<LeadRiga[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [otpStato, setOtpStato] = useState<{ stato: string; dettaglio?: string } | null>(null);
  const [otpLavoro, setOtpLavoro] = useState(false);
  const [copiato, setCopiato] = useState('');

  const ricarica = useCallback(async () => {
    const [a, q, l] = await Promise.all([listaAffiliati(), listaQr(), listaRegistrazioni()]);
    setAffiliati(a); setQrs(q); setLeads(l);
    setCaricamento(false);
  }, []);

  useEffect(() => {
    // Il primo caricamento passa dal .then: gli stati si toccano solo a dati arrivati.
    Promise.resolve().then(ricarica).catch(() => {});
    statoOtpWhatsApp().then(setOtpStato).catch(() => {});
  }, [ricarica]);

  const copia = async (testo: string, chiave: string) => {
    try { await navigator.clipboard.writeText(testo); setCopiato(chiave); setTimeout(() => setCopiato(''), 2000); } catch {}
  };

  const preparaOtp = async () => {
    setOtpLavoro(true);
    const res = await creaTemplateOtp();
    if (res.ok) setOtpStato({ stato: 'pending' });
    else alert(res.error || 'Creazione non riuscita');
    setOtpLavoro(false);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary flex items-center gap-2">
            <QrCode className="w-6 h-6 text-accent" /> Affiliazione
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            QR code per le attività partner: ogni cliente che portano resta legato a loro e matura la commissione.
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-bg-tertiary/60">
          {([['affiliati', 'Affiliati', Users], ['qr', 'QR code', QrCode], ['registrazioni', 'Registrazioni', Check]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors ${tab === id ? 'bg-bg-secondary text-accent shadow' : 'text-text-secondary hover:text-text-primary'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Il codice OTP viaggia su WhatsApp: senza template approvato non parte niente. */}
      {otpStato && otpStato.stato !== 'approvato' && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 flex items-center gap-3 flex-wrap">
          <MessageSquare className="w-5 h-5 text-warning flex-shrink-0" />
          <div className="flex-1 min-w-[240px] text-sm text-text-primary">
            {otpStato.stato === 'manca' && <>Manca il template WhatsApp per il codice di verifica: <b>senza, le registrazioni dai QR non possono completarsi</b>. Crealo con un clic, Meta di solito approva in pochi minuti.</>}
            {otpStato.stato === 'pending' && <>Il template del codice di verifica è <b>in approvazione da Meta</b>: appena approvato le registrazioni funzioneranno da sole. Di solito è questione di minuti.</>}
            {otpStato.stato === 'rifiutato' && <>Il template del codice di verifica è stato <b>rifiutato da Meta</b>: contattare l&apos;assistenza 360dialog.</>}
            {otpStato.stato === 'ignoto' && <>Non riesco a leggere lo stato del template OTP{otpStato.dettaglio ? ` (${otpStato.dettaglio})` : ''}.</>}
          </div>
          {otpStato.stato === 'manca' && (
            <button onClick={preparaOtp} disabled={otpLavoro}
              className="px-4 py-2 rounded-lg gradient-accent text-white text-sm font-bold disabled:opacity-50">
              {otpLavoro ? 'Creazione…' : 'Crea il template OTP'}
            </button>
          )}
        </div>
      )}

      {caricamento ? (
        <p className="text-sm text-text-secondary">Carico i dati…</p>
      ) : tab === 'affiliati' ? (
        <TabAffiliati affiliati={affiliati} ricarica={ricarica} copia={copia} copiato={copiato} />
      ) : tab === 'qr' ? (
        <TabQr qrs={qrs} affiliati={affiliati} ricarica={ricarica} copia={copia} copiato={copiato} />
      ) : (
        <TabRegistrazioni leads={leads} ricarica={ricarica} />
      )}
    </div>
  );
}

// ============================================================
// Scheda Affiliati
// ============================================================

function TabAffiliati({ affiliati, ricarica, copia, copiato }: {
  affiliati: AffiliatoRiga[];
  ricarica: () => Promise<void>;
  copia: (t: string, k: string) => void;
  copiato: string;
}) {
  const [nuovo, setNuovo] = useState(false);
  const [form, setForm] = useState({ businessName: '', contactName: '', phone: '', email: '', commissionPercent: '10', notes: '' });
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const salva = async () => {
    setSalvo(true); setErrore(null);
    const res = await creaAffiliato({
      businessName: form.businessName,
      contactName: form.contactName || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      commissionPercent: Number(form.commissionPercent.replace(',', '.')) || 10,
      notes: form.notes || undefined,
    });
    if (!res.ok) setErrore(res.error || 'Errore');
    else {
      setForm({ businessName: '', contactName: '', phone: '', email: '', commissionPercent: '10', notes: '' });
      setNuovo(false);
      await ricarica();
    }
    setSalvo(false);
  };

  return (
    <div className="space-y-4">
      {!nuovo ? (
        <button onClick={() => setNuovo(true)} className="px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nuovo affiliato
        </button>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-secondary p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-text-primary">Nuovo affiliato</h3>
            <button onClick={() => setNuovo(false)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo label="Nome attività *" value={form.businessName} onChange={v => setForm(f => ({ ...f, businessName: v }))} placeholder="Es. Bar Centrale" />
            <Campo label="Referente" value={form.contactName} onChange={v => setForm(f => ({ ...f, contactName: v }))} placeholder="Nome e cognome" />
            <Campo label="Telefono" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="Cellulare del referente" />
            <Campo label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="email@esempio.it" />
            <Campo label="Commissione %" value={form.commissionPercent} onChange={v => setForm(f => ({ ...f, commissionPercent: v }))} placeholder="10" />
            <Campo label="Note" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Accordi particolari…" />
          </div>
          {errore && <p className="text-sm text-error">{errore}</p>}
          <button onClick={salva} disabled={salvo || !form.businessName.trim()}
            className="px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold disabled:opacity-50">
            {salvo ? 'Salvataggio…' : 'Salva affiliato'}
          </button>
        </div>
      )}

      {affiliati.length === 0 && <p className="text-sm text-text-secondary">Ancora nessun affiliato: crea il primo e poi il suo QR nella scheda accanto.</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        {affiliati.map(a => (
          <motion.div key={a.id} layout className={`rounded-2xl border border-border bg-bg-secondary p-4 space-y-3 ${!a.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-text-primary">{a.businessName}</h3>
                <p className="text-xs text-text-secondary">
                  {a.code} · commissione {a.commissionPercent}% · {a.numQr} QR
                  {a.contactName ? ` · ${a.contactName}` : ''}{a.phone ? ` · ${a.phone}` : ''}
                </p>
              </div>
              <button
                onClick={async () => { await aggiornaAffiliato(a.id, { isActive: !a.isActive }); await ricarica(); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${a.isActive ? 'bg-success/15 text-success' : 'bg-bg-tertiary text-text-muted'}`}>
                {a.isActive ? 'Attivo' : 'Spento'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Scansioni" value={String(a.stats.scansioni)} />
              <MiniStat label="Registrati" value={String(a.stats.verificati)} />
              <MiniStat label="Omaggi usati" value={String(a.stats.omaggiUsati)} />
              <MiniStat label="Paganti" value={String(a.stats.clientiPaganti)} />
              <MiniStat label="Fatturato" value={eur(a.stats.fatturato)} />
              <MiniStat label="Commissioni" value={eur(a.stats.commissioni)} accent />
            </div>

            <div className="flex gap-2 flex-wrap">
              <button onClick={() => copia(a.portalUrl, `portale-${a.id}`)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover flex items-center gap-1">
                <Copy className="w-3.5 h-3.5" /> {copiato === `portale-${a.id}` ? 'Copiato ✓' : 'Copia link portale'}
              </button>
              <a href={a.portalUrl} target="_blank"
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" /> Apri portale
              </a>
            </div>
            <p className="text-[11px] text-text-muted">
              Il link del portale è la chiave d&apos;accesso dell&apos;affiliato: mandaglielo su WhatsApp e da lì scarica il QR e vede i suoi numeri.
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Scheda QR code
// ============================================================

function TabQr({ qrs, affiliati, ricarica, copia, copiato }: {
  qrs: QrRiga[];
  affiliati: AffiliatoRiga[];
  ricarica: () => Promise<void>;
  copia: (t: string, k: string) => void;
  copiato: string;
}) {
  const [nuovo, setNuovo] = useState(false);
  const [form, setForm] = useState({ affiliateId: '', name: '', channel: '', treatment: '', message: '', conditions: '', expiresAt: '', maxUses: '', bozza: false });
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [lavoro, setLavoro] = useState('');

  const attivi = useMemo(() => affiliati.filter(a => a.isActive), [affiliati]);

  const salva = async () => {
    setSalvo(true); setErrore(null);
    const res = await creaQr({
      affiliateId: form.affiliateId,
      name: form.name,
      channel: form.channel || undefined,
      treatment: form.treatment,
      message: form.message || undefined,
      conditions: form.conditions || undefined,
      expiresAt: form.expiresAt || undefined,
      maxUses: form.maxUses ? Number(form.maxUses) : undefined,
      bozza: form.bozza,
    });
    if (!res.ok) setErrore(res.error || 'Errore');
    else {
      setForm({ affiliateId: '', name: '', channel: '', treatment: '', message: '', conditions: '', expiresAt: '', maxUses: '', bozza: false });
      setNuovo(false);
      await ricarica();
    }
    setSalvo(false);
  };

  const azione = async (id: string, fn: () => Promise<unknown>) => {
    setLavoro(id);
    await fn();
    await ricarica();
    setLavoro('');
  };

  return (
    <div className="space-y-4">
      {!nuovo ? (
        <button onClick={() => setNuovo(true)} className="px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nuovo QR code
        </button>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-secondary p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-text-primary">Nuovo QR code</h3>
            <button onClick={() => setNuovo(false)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">Affiliato *</label>
              <select value={form.affiliateId} onChange={e => setForm(f => ({ ...f, affiliateId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary">
                <option value="">Scegli…</option>
                {attivi.map(a => <option key={a.id} value={a.id}>{a.businessName}</option>)}
              </select>
            </div>
            <Campo label="Nome interno *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder='Es. "Espositore banco", "Volantino"' />
            <Campo label="Canale / campagna" value={form.channel} onChange={v => setForm(f => ({ ...f, channel: v }))} placeholder="Instagram, volantino, dipendente Anna…" />
            <Campo label="Trattamento gratuito *" value={form.treatment} onChange={v => setForm(f => ({ ...f, treatment: v }))} placeholder="Es. Pressoterapia" />
            <Campo label="Messaggio della pagina" value={form.message} onChange={v => setForm(f => ({ ...f, message: v }))} placeholder="Vuoto = testo standard" />
            <Campo label="Condizioni" value={form.conditions} onChange={v => setForm(f => ({ ...f, conditions: v }))} placeholder="Es. Solo nuovi clienti, su appuntamento" />
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">Scadenza (facoltativa)</label>
              <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
            </div>
            <Campo label="Limite utilizzi (facoltativo)" value={form.maxUses} onChange={v => setForm(f => ({ ...f, maxUses: v.replace(/\D/g, '') }))} placeholder="Es. 50 registrazioni" />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={form.bozza} onChange={e => setForm(f => ({ ...f, bozza: e.target.checked }))} />
            Salva come bozza (il QR non funziona finché non lo attivi)
          </label>
          {errore && <p className="text-sm text-error">{errore}</p>}
          <button onClick={salva} disabled={salvo}
            className="px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold disabled:opacity-50">
            {salvo ? 'Creazione…' : 'Crea QR code'}
          </button>
        </div>
      )}

      {qrs.length === 0 && <p className="text-sm text-text-secondary">Nessun QR ancora. Creane uno per un affiliato: la pagina, l&apos;immagine e la locandina nascono da sole.</p>}

      <div className="space-y-3">
        {qrs.map(qr => {
          const st = STATO_QR[qr.statoEffettivo] || STATO_QR.active;
          return (
            <div key={qr.id} className="rounded-2xl border border-border bg-bg-secondary p-4">
              <div className="flex flex-wrap items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/affiliazione/qr/${qr.slug}`} alt="QR" className="w-24 h-24 rounded-xl border border-border bg-white p-1 flex-shrink-0" />
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-text-primary">{qr.affiliato}</h3>
                    <span className="text-text-muted text-sm">· {qr.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                    {qr.replacesId && <span className="text-[11px] text-text-muted">(sostituisce un QR precedente)</span>}
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Omaggio: <b>{qr.treatment}</b>
                    {qr.channel ? ` · ${qr.channel}` : ''}
                    {qr.expiresAt ? ` · scade il ${dataIt(qr.expiresAt)}` : ''}
                    {qr.maxUses ? ` · max ${qr.maxUses} usi` : ''}
                  </p>
                  <p className="text-xs text-text-secondary mt-1.5">
                    {qr.stats.scansioni} scansioni ({qr.stats.scansioniUniche} uniche) · {qr.stats.verificati} registrati ({qr.stats.conversione}%) ·
                    {' '}{qr.stats.appuntamenti} prenotazioni · {qr.stats.omaggiUsati} omaggi usati · {qr.stats.clientiPaganti} paganti ·
                    {' '}{eur(qr.stats.fatturato)} fatturato · <b className="text-accent">{eur(qr.stats.commissioni)} commissioni</b>
                    {qr.stats.bloccati > 0 && <span className="text-error"> · {qr.stats.bloccati} bloccati antifrode</span>}
                  </p>

                  <div className="flex gap-1.5 flex-wrap mt-2.5">
                    <BtnMini onClick={() => copia(qr.url, `qr-${qr.id}`)} icon={Copy} label={copiato === `qr-${qr.id}` ? 'Copiato ✓' : 'Copia link'} />
                    <BtnMini href={`/api/affiliazione/qr/${qr.slug}?dl=1`} icon={Download} label="PNG" />
                    <BtnMini href={`/api/affiliazione/qr/${qr.slug}?f=svg&dl=1`} icon={Download} label="SVG" />
                    <BtnMini href={`/q/${qr.slug}/locandina`} target icon={Printer} label="Locandina" />
                    <BtnMini href={qr.url} target icon={ExternalLink} label="Apri pagina" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  {(qr.status === 'draft' || qr.status === 'suspended') && (
                    <BtnStato onClick={() => azione(qr.id, () => cambiaStatoQr(qr.id, 'active'))} lavoro={lavoro === qr.id} icon={Play} label="Attiva" cls="bg-success/15 text-success" />
                  )}
                  {qr.status === 'active' && (
                    <BtnStato onClick={() => azione(qr.id, () => cambiaStatoQr(qr.id, 'suspended'))} lavoro={lavoro === qr.id} icon={Pause} label="Sospendi" cls="bg-warning/15 text-warning" />
                  )}
                  {qr.status !== 'disabled' && qr.status !== 'blocked' && (
                    <BtnStato onClick={() => azione(qr.id, () => cambiaStatoQr(qr.id, 'disabled'))} lavoro={lavoro === qr.id} icon={Ban} label="Disattiva" cls="bg-bg-tertiary text-text-secondary" />
                  )}
                  {(qr.status === 'disabled' || qr.status === 'blocked') && (
                    <BtnStato onClick={() => azione(qr.id, () => cambiaStatoQr(qr.id, 'active'))} lavoro={lavoro === qr.id} icon={Play} label="Riattiva" cls="bg-success/15 text-success" />
                  )}
                  <BtnStato onClick={() => azione(qr.id, () => sostituisciQr(qr.id))} lavoro={lavoro === qr.id} icon={RefreshCw} label="Sostituisci" cls="bg-accent/10 text-accent" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Scheda Registrazioni
// ============================================================

function TabRegistrazioni({ leads, ricarica }: { leads: LeadRiga[]; ricarica: () => Promise<void> }) {
  const [filtro, setFiltro] = useState<'tutte' | 'verified' | 'otp' | 'blocked'>('tutte');
  const [lavoro, setLavoro] = useState('');

  const filtrate = filtro === 'tutte' ? leads : leads.filter(l => l.status === filtro);

  const azione = async (id: string, fn: () => Promise<unknown>) => {
    setLavoro(id);
    await fn();
    await ricarica();
    setLavoro('');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {([['tutte', `Tutte (${leads.length})`], ['verified', `Verificate (${leads.filter(l => l.status === 'verified').length})`], ['otp', `In attesa (${leads.filter(l => l.status === 'otp').length})`], ['blocked', `Bloccate (${leads.filter(l => l.status === 'blocked').length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFiltro(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filtro === id ? 'gradient-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}>
            {label}
          </button>
        ))}
      </div>

      {filtrate.length === 0 && <p className="text-sm text-text-secondary">Nessuna registrazione qui.</p>}

      <div className="space-y-2">
        {filtrate.map(l => (
          <div key={l.id} className="rounded-xl border border-border bg-bg-secondary p-3.5 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-text-primary text-sm">{l.nome}</p>
                {l.status === 'verified' && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-success/15 text-success">Verificato</span>}
                {l.status === 'otp' && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-warning/15 text-warning">In attesa del codice</span>}
                {l.status === 'blocked' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/15 text-error flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Bloccato: {MOTIVO_BLOCCO[l.blockReason || ''] || l.blockReason}
                  </span>
                )}
                {l.voucherUsedAt && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-accent/10 text-accent flex items-center gap-1"><Gift className="w-3 h-3" /> Omaggio usato</span>}
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                +{l.phone}{l.email ? ` · ${l.email}` : ''} · da <b>{l.affiliato}</b> ({l.qrNome})
                {l.device ? ` · ${l.device}` : ''} · {dataIt(l.createdAt)}
                {l.voucherCode && <> · buono <b className="text-text-primary">{l.voucherCode}</b></>}
              </p>
            </div>
            <div className="flex gap-1.5">
              {l.status === 'verified' && (
                <button onClick={() => azione(l.id, () => segnaOmaggioUsato(l.id, !l.voucherUsedAt))} disabled={lavoro === l.id}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 ${l.voucherUsedAt ? 'border border-border text-text-secondary hover:bg-bg-hover' : 'bg-accent/10 text-accent'}`}>
                  {l.voucherUsedAt ? 'Riporta non usato' : 'Segna omaggio usato'}
                </button>
              )}
              {l.status === 'otp' && (
                <button onClick={() => azione(l.id, () => verificaManualmente(l.id))} disabled={lavoro === l.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-success/15 text-success disabled:opacity-50">
                  Verifica a mano
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Pezzetti riusati
// ============================================================

function Campo({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-text-secondary mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted" />
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-bg-tertiary/50 py-2 px-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`text-sm font-bold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</p>
    </div>
  );
}

function BtnMini({ onClick, href, target, icon: Icon, label }: {
  onClick?: () => void; href?: string; target?: boolean;
  icon: React.ComponentType<{ className?: string }>; label: string;
}) {
  const cls = 'px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover flex items-center gap-1';
  if (href) return <a href={href} {...(target ? { target: '_blank' } : {})} className={cls}><Icon className="w-3.5 h-3.5" /> {label}</a>;
  return <button onClick={onClick} className={cls}><Icon className="w-3.5 h-3.5" /> {label}</button>;
}

function BtnStato({ onClick, lavoro, icon: Icon, label, cls }: {
  onClick: () => void; lavoro: boolean;
  icon: React.ComponentType<{ className?: string }>; label: string; cls: string;
}) {
  return (
    <button onClick={onClick} disabled={lavoro}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
