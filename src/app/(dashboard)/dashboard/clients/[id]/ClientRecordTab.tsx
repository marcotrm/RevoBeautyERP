'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Trash2, Save, Plus, X, PenLine, Loader2, FileSignature, ImageIcon, Eraser } from 'lucide-react';
import {
  getClientRecord, updateMedicalRecord, addClientPhoto, deleteClientPhoto,
  addClientConsent, deleteClientConsent,
  type ClientPhoto, type ClientConsent, type MedicalRecord,
} from '@/app/actions/clientRecords';
import { compressImage } from '@/lib/imageCompress';
import { mandaAlTablet, statoTablet } from '@/app/actions/tablet';
import { linkConsensoCliente } from '@/app/actions/consensoLaser';
import DettaglioConsenso from './DettaglioConsenso';
import { Credito } from './Credito';
import CaricaDocumento from './CaricaDocumento';

const SKIN_TYPES = ['Normale', 'Secca', 'Grassa', 'Mista', 'Sensibile', 'Asfittica'];
const PHOTOTYPES = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const CONSENT_PRESETS = ['Consenso Privacy (GDPR)', 'Consenso al Trattamento', 'Consenso Foto', 'Consenso Laser/Epilazione'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all';

// ============ Signature pad ============
function SignaturePad({ onChange }: { onChange: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';
  }, []);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const start = (e: React.PointerEvent) => {
    drawing.current = true; dirty.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) onChange(canvasRef.current!.toDataURL('image/png'));
  };
  const clear = () => {
    const c = canvasRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    dirty.current = false; onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef} width={500} height={160}
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
        className="w-full h-40 rounded-xl bg-white border border-border touch-none cursor-crosshair"
      />
      <button type="button" onClick={clear} className="mt-1.5 flex items-center gap-1 text-xs text-text-muted hover:text-error transition-colors">
        <Eraser className="w-3.5 h-3.5" /> Cancella firma
      </button>
    </div>
  );
}

export default function ClientRecordTab({ clientId, nomeCliente }: { clientId: string; nomeCliente?: string }) {
  /** Apre il modulo del consenso laser per questa cliente, su una scheda nuova. */
  /*
    La scheda si apre PRIMA di sapere l'indirizzo.

    `window.open` funziona solo dentro al clic: se lo si chiama dopo aver
    aspettato la risposta del server, il browser lo considera una finestra
    aperta da sola e la blocca in silenzio — il tasto sembra rotto, e infatti
    sembrava rotto. Quindi si apre subito una scheda vuota e la si manda
    all'indirizzo appena arriva.
  */
  const apriQui = async () => {
    const scheda = window.open('', '_blank');
    const l = await linkConsensoCliente(clientId).catch(() => null);
    if (l?.ok && l.url) {
      if (scheda) scheda.location.href = l.url;
      else window.location.href = l.url;
      return;
    }
    scheda?.close();
    alert(l?.errore || 'Non riesco ad aprire il modulo');
  };

  /*
    Dove far comparire il modulo.

    Sul TABLET quando il centro ne ha uno collegato: e' il caso normale — la
    cliente e' al banco, le si passa il tablet gia' aperto sul suo modulo.
    Su QUESTO schermo quando il tablet non c'e', che e' la strada di prima:
    senza tablet non si resta a piedi.
  */
  const [tabletCollegato, setTabletCollegato] = useState<boolean | null>(null);
  const [mandato, setMandato] = useState('');

  useEffect(() => {
    let vivo = true;
    statoTablet()
      .then(t => { if (vivo) setTabletCollegato(t.collegato); })
      .catch(() => { if (vivo) setTabletCollegato(false); });
    return () => { vivo = false; };
  }, []);

  const apriConsensoLaser = async () => {
    if (!tabletCollegato) { await apriQui(); return; }
    const r = await mandaAlTablet(clientId).catch(() => null);
    if (r?.ok) {
      setMandato('Aperto sul tablet');
      setTimeout(() => setMandato(''), 5000);
      return;
    }
    alert(r?.errore || 'Non riesco a mandarlo al tablet');
  };

  const [loading, setLoading] = useState(true);
  const [rec, setRec] = useState<MedicalRecord>({});
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [consents, setConsents] = useState<ClientConsent[]>([]);
  /** Il consenso che si sta leggendo, con dentro le risposte della cliente. */
  const [consensoAperto, setConsensoAperto] = useState<ClientConsent | null>(null);
  /** Cambia quando si carica un documento nuovo: fa ricaricare quello mostrato. */
  const [versioneDoc, setVersioneDoc] = useState(0);

  const [savingRec, setSavingRec] = useState(false);
  const [recSaved, setRecSaved] = useState(false);
  const [uploading, setUploading] = useState<null | 'before' | 'after' | 'document'>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadKind = useRef<'before' | 'after' | 'document'>('before');
  const [lightbox, setLightbox] = useState<ClientPhoto | null>(null);

  const [showConsent, setShowConsent] = useState(false);
  const [consentTitle, setConsentTitle] = useState(CONSENT_PRESETS[0]);
  const [consentNotes, setConsentNotes] = useState('');
  const [consentSig, setConsentSig] = useState<string | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await getClientRecord(clientId);
        setRec(r.medicalRecord || {});
        setPhotos(r.photos);
        setConsents(r.consents);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [clientId]);

  const setField = (k: string, v: unknown) => setRec(prev => ({ ...prev, [k]: v }));
  const g = (k: string) => (rec[k] as string) || '';
  const gb = (k: string) => !!rec[k];

  const saveRecord = async () => {
    setSavingRec(true);
    try {
      await updateMedicalRecord(clientId, rec);
      setRecSaved(true);
      setTimeout(() => setRecSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSavingRec(false); }
  };

  const pickFiles = (kind: 'before' | 'after' | 'document') => {
    uploadKind.current = kind;
    fileRef.current?.click();
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const kind = uploadKind.current;
    setUploading(kind);
    try {
      for (const f of files) {
        const data = await compressImage(f);
        const saved = await addClientPhoto({ clientId, kind, data });
        setPhotos(prev => [saved, ...prev]);
      }
    } catch (e) { console.error(e); alert('Errore nel caricamento della foto.'); }
    finally { setUploading(null); }
  };

  const removePhoto = async (id: string) => {
    if (!confirm('Eliminare questa foto?')) return;
    try { await deleteClientPhoto(id); setPhotos(prev => prev.filter(p => p.id !== id)); }
    catch (e) { console.error(e); }
  };

  const saveConsent = async () => {
    if (!consentTitle.trim()) return;
    setSavingConsent(true);
    try {
      const saved = await addClientConsent({ clientId, title: consentTitle.trim(), signatureData: consentSig || undefined, notes: consentNotes || undefined });
      setConsents(prev => [saved, ...prev]);
      setShowConsent(false); setConsentNotes(''); setConsentSig(null); setConsentTitle(CONSENT_PRESETS[0]);
    } catch (e) { console.error(e); }
    finally { setSavingConsent(false); }
  };

  const removeConsent = async (id: string) => {
    if (!confirm('Eliminare questo consenso?')) return;
    try { await deleteClientConsent(id); setConsents(prev => prev.filter(c => c.id !== id)); }
    catch (e) { console.error(e); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-text-muted"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento scheda...</div>;
  }

  const beforePhotos = photos.filter(p => p.kind === 'before');
  const afterPhotos = photos.filter(p => p.kind === 'after');
  const docs = photos.filter(p => p.kind === 'document');

  return (
    <div className="space-y-5">
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />

      {/* ====== ANAMNESI / SCHEDA TECNICA ====== */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-display font-semibold text-text-primary">Anamnesi / Scheda tecnica</h3>
          </div>
          <button onClick={saveRecord} disabled={savingRec}
            className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium hover:scale-105 transition-all disabled:opacity-60">
            {savingRec ? <Loader2 className="w-4 h-4 animate-spin" /> : recSaved ? <CheckMini /> : <Save className="w-4 h-4" />}
            {recSaved ? 'Salvato' : 'Salva scheda'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Tipo di pelle">
            <select value={g('skinType')} onChange={e => setField('skinType', e.target.value)} className={inputCls}>
              <option value="">—</option>
              {SKIN_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Fototipo">
            <select value={g('phototype')} onChange={e => setField('phototype', e.target.value)} className={inputCls}>
              <option value="">—</option>
              {PHOTOTYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Allergie">
            <input type="text" value={g('allergies')} onChange={e => setField('allergies', e.target.value)} placeholder="Es. nichel, profumi..." className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Patologie / Controindicazioni">
            <textarea value={g('conditions')} onChange={e => setField('conditions', e.target.value)} rows={2} placeholder="Diabete, problemi circolatori, patologie della pelle..." className={inputCls + ' resize-none'} />
          </Field>
          <Field label="Farmaci in uso">
            <textarea value={g('medications')} onChange={e => setField('medications', e.target.value)} rows={2} placeholder="Farmaci fotosensibilizzanti, anticoagulanti..." className={inputCls + ' resize-none'} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-4">
          {[
            { k: 'pregnant', label: 'Gravidanza / Allattamento' },
            { k: 'pacemaker', label: 'Pacemaker / Protesi metalliche' },
            { k: 'recentSun', label: 'Esposizione solare recente' },
          ].map(({ k, label }) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <button type="button" onClick={() => setField(k, !gb(k))}
                className={`w-10 h-5 rounded-full relative transition-colors ${gb(k) ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${gb(k) ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-text-secondary">{label}</span>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Obiettivi estetici">
            <textarea value={g('goals')} onChange={e => setField('goals', e.target.value)} rows={2} placeholder="Cosa desidera ottenere la cliente..." className={inputCls + ' resize-none'} />
          </Field>
          <Field label="Note dell'estetista">
            <textarea value={g('notes')} onChange={e => setField('notes', e.target.value)} rows={2} placeholder="Osservazioni, prodotti consigliati..." className={inputCls + ' resize-none'} />
          </Field>
        </div>
      </div>

      {/* ====== FOTO PRIMA / DOPO ====== */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-display font-semibold text-text-primary">Foto prima / dopo</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => pickFiles('before')} disabled={!!uploading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-60">
              {uploading === 'before' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Carica PRIMA
            </button>
            <button onClick={() => pickFiles('after')} disabled={!!uploading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl gradient-accent text-white text-sm font-medium hover:scale-105 transition-all disabled:opacity-60">
              {uploading === 'after' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Carica DOPO
            </button>
          </div>
        </div>

        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Camera className="w-10 h-10 text-text-muted mb-2" />
            <p className="text-sm text-text-muted">Nessuna foto. Carica il &quot;prima&quot; e il &quot;dopo&quot; del trattamento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map(p => (
              <div key={p.id} className="relative group rounded-xl overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.data} alt={p.kind} className="w-full h-32 object-cover cursor-pointer" onClick={() => setLightbox(p)} />
                <span className={`absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.kind === 'after' ? 'bg-accent text-white' : p.kind === 'document' ? 'bg-bg-primary/80 text-text-primary' : 'bg-white/90 text-text-primary'}`}>
                  {p.kind === 'after' ? 'DOPO' : p.kind === 'document' ? 'DOC' : 'PRIMA'}
                </span>
                <button onClick={() => removePhoto(p.id)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-error transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
          <p className="text-xs text-text-muted">{beforePhotos.length} prima · {afterPhotos.length} dopo{docs.length ? ` · ${docs.length} documenti` : ''}</p>
        )}
      </div>

      {/* ====== CONSENSI ====== */}
      {/* Il credito prima dei consensi: sono soldi, e si guardano per primi */}
      <Credito clientId={clientId} />

      <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-display font-semibold text-text-primary">Consensi firmati</h3>
          </div>
          <div className="flex items-center gap-2">
            {/*
              Il modulo del laser si apre da qui, non solo dal check-in.

              Il check-in e' il momento giusto ma non e' l'unico: capita di
              farlo firmare al banco mentre si prende l'appuntamento, o il
              giorno dopo perche' ci si era dimenticati. Da qui il modulo si
              apre per questa cliente, anche senza un appuntamento aperto.
            */}
            <CaricaDocumento clientId={clientId} onFatto={() => setVersioneDoc(v => v + 1)} />
            <button onClick={apriConsensoLaser}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                mandato ? 'border-success/40 bg-success/10 text-success'
                  : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
              <FileSignature className="w-4 h-4" />
              {mandato || (tabletCollegato ? 'Manda al tablet' : 'Consenso laser')}
            </button>
            <button onClick={() => setShowConsent(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl gradient-accent text-white text-sm font-medium hover:scale-105 transition-all">
              <Plus className="w-4 h-4" /> Nuovo consenso
            </button>
          </div>
        </div>

        {consents.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">Nessun consenso registrato.</p>
        ) : (
          <div className="space-y-2">
            {consents.map(c => (
              /* La riga si apre: dentro c'e' tutto quello che la cliente ha
                 compilato, che finora restava nel database senza che nessuno
                 potesse rileggerlo. */
              <div key={c.id} role="button" tabIndex={0}
                onClick={() => setConsensoAperto(c)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setConsensoAperto(c); } }}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-bg-tertiary/40 cursor-pointer hover:border-accent/40 hover:bg-bg-hover transition-colors">
                {c.signatureData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.signatureData} alt="firma" className="w-16 h-10 object-contain bg-white rounded border border-border flex-shrink-0" />
                ) : (
                  <div className="w-16 h-10 rounded bg-bg-secondary border border-border flex items-center justify-center flex-shrink-0"><PenLine className="w-4 h-4 text-text-muted" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{c.title}</p>
                  <p className="text-xs text-text-muted">Firmato il {new Date(c.signedAt).toLocaleDateString('it-IT')}{c.notes ? ` · ${c.notes}` : ''}</p>
                </div>
                <span className="text-[11px] text-accent font-medium flex-shrink-0 hidden sm:inline">apri →</span>
                <button onClick={e => { e.stopPropagation(); removeConsent(c.id); }}
                  className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Il consenso firmato, per intero */}
      <AnimatePresence>
        {consensoAperto && (
          <DettaglioConsenso key={versioneDoc} consenso={consensoAperto} clientId={clientId} nomeCliente={nomeCliente} onChiudi={() => setConsensoAperto(null)} />
        )}
      </AnimatePresence>

      {/* Lightbox foto */}
      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.data} alt="foto" className="max-w-full max-h-full rounded-xl" />
            <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20"><X className="w-5 h-5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal nuovo consenso */}
      <AnimatePresence>
        {showConsent && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowConsent(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="text-lg font-display font-semibold text-text-primary">Nuovo consenso</h3>
                  <button onClick={() => setShowConsent(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <Field label="Tipo di consenso">
                    <input list="consent-presets" value={consentTitle} onChange={e => setConsentTitle(e.target.value)} className={inputCls} />
                    <datalist id="consent-presets">{CONSENT_PRESETS.map(p => <option key={p} value={p} />)}</datalist>
                  </Field>
                  <Field label="Firma della cliente">
                    <SignaturePad onChange={setConsentSig} />
                  </Field>
                  <Field label="Note (facoltative)">
                    <input type="text" value={consentNotes} onChange={e => setConsentNotes(e.target.value)} placeholder="Es. firmato in sede" className={inputCls} />
                  </Field>
                </div>
                <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30">
                  <button onClick={saveConsent} disabled={savingConsent || !consentTitle.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:scale-105 transition-all disabled:opacity-60">
                    {savingConsent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salva consenso
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

function CheckMini() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}
