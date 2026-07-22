'use client';

import React, { useEffect, useState } from 'react';
import { Receipt, Loader2, CheckCircle2, ChevronDown } from 'lucide-react';
import { loadC95Config, saveC95ConfigAction, testC95ConnectionAction } from '@/app/actions/c95';

export default function C95Config() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [apiUsername, setApiUsername] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [idMittente, setIdMittente] = useState('');
  const [partitaIva, setPartitaIva] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://testdomain.c95.it/webservice/RestAPI.asmx');
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [vatRate, setVatRate] = useState(22);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [candidates, setCandidates] = useState<{ userId: string; email?: string | null; denominazione?: string | null; piva?: string | null }[]>([]);

  useEffect(() => {
    loadC95Config().then(c => {
      setEnabled(c.enabled); setApiUsername(c.apiUsername); setApiPassword(c.apiPassword);
      setIdMittente(c.idMittente); setPartitaIva(c.partitaIva || ''); setBaseUrl(c.baseUrl); setDeviceId(c.deviceId);
      setDeviceName(c.deviceName); setVatRate(c.vatRate); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const currentCfg = () => ({
    enabled, apiUsername: apiUsername.trim(), apiPassword: apiPassword.trim(),
    idMittente: idMittente.trim(), partitaIva: partitaIva.trim(), baseUrl: baseUrl.trim(), deviceId: deviceId.trim(),
    deviceName: deviceName.trim(), vatRate,
  });

  const save = async (overrides?: Partial<{ enabled: boolean }>) => {
    setSaving(true);
    const cfg = { ...currentCfg(), ...overrides };
    await saveC95ConfigAction(cfg);
    setEnabled(cfg.enabled);
    setSaving(false);
    setMsg({ ok: true, text: 'Impostazioni salvate' });
    setTimeout(() => setMsg(null), 3000);
  };

  const doTest = async () => {
    setTesting(true);
    setCandidates([]);
    await save();
    const res = await testC95ConnectionAction();
    setTesting(false);
    if (res.idMittente) setIdMittente(res.idMittente);
    if (res.candidates) setCandidates(res.candidates);
    const text = res.ok
      ? `Connessione riuscita${res.idMittente ? ` — ID mittente: ${res.idMittente}` : ''}${res.message ? ` (${res.message})` : ''}`
      : (res.error || 'Connessione fallita');
    setMsg({ ok: res.ok, text });
    setTimeout(() => setMsg(null), 9000);
  };

  const configured = !!(apiUsername && apiPassword);
  const status = enabled && configured
    ? { label: 'Attivo', cls: 'bg-success/10 text-success' }
    : { label: 'Da configurare', cls: 'bg-warning/10 text-warning' };
  const isProd = baseUrl.includes('app.c95.it');

  return (
    <div className="rounded-xl bg-bg-tertiary/50 border border-border/30 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 p-4 text-left">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#00A67E15' }}>
          <Receipt className="w-5 h-5" style={{ color: '#00A67E' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-text-primary">Scontrino fiscale elettronico (C95)</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">Emette lo scontrino fiscale su C95/Agenzia delle Entrate ad ogni incasso in cassa.</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-bg-secondary border border-border/50">
            <div>
              <span className="text-sm font-medium text-text-primary">Emissione automatica scontrini</span>
              <p className="text-[11px] text-text-muted">Ad ogni incasso di cassa viene emesso lo scontrino su C95</p>
            </div>
            <button onClick={() => save({ enabled: !enabled })} disabled={!loaded || saving}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-success' : 'bg-bg-hover'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className={`text-[11px] px-3 py-2 rounded-lg border ${isProd ? 'bg-warning/10 border-warning/30 text-warning' : 'bg-bg-secondary border-border/50 text-text-muted'}`}>
            {isProd ? '⚠️ Ambiente PRODUZIONE — gli scontrini emessi sono reali e vanno all\'Agenzia delle Entrate.' : 'Ambiente di TEST (testdomain.c95.it) — nessun documento fiscale reale.'}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Username API</label>
              <input type="text" value={apiUsername} onChange={e => setApiUsername(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Password API</label>
              <input type="password" value={apiPassword} onChange={e => setApiPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">P.IVA del centro</label>
              <input type="text" value={partitaIva} onChange={e => setPartitaIva(e.target.value)} placeholder="es. IT10625841217"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 font-mono" />
              <p className="text-[11px] text-text-muted mt-1">Usata solo per trovare automaticamente l&apos;ID Mittente col pulsante &quot;Testa connessione&quot;.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">ID Mittente</label>
              <input type="text" value={idMittente} onChange={e => setIdMittente(e.target.value)} placeholder="rilevato automaticamente dopo il test"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 font-mono" />
            </div>
          </div>

          {candidates.length > 0 && (
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 space-y-2">
              <p className="text-xs font-semibold text-warning">Più account trovati — scegli quello giusto:</p>
              {candidates.map(c => (
                <button key={c.userId} onClick={() => { setIdMittente(c.userId); setCandidates([]); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-bg-secondary border border-border text-left hover:border-border-light">
                  <span className="text-xs text-text-primary truncate">{c.denominazione || c.email || c.userId}</span>
                  <span className="text-[10px] text-text-muted flex-shrink-0">{c.piva || ''}</span>
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">URL base API</label>
            <select value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50">
              <option value="https://testdomain.c95.it/webservice/RestAPI.asmx">Test — testdomain.c95.it</option>
              <option value="https://app.c95.it/webservice/RestAPI.asmx">Produzione — app.c95.it</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Device ID</label>
              <input type="text" value={deviceId} onChange={e => setDeviceId(e.target.value)} placeholder="es. CASSA1"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Nome device</label>
              <input type="text" value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="Cassa Revobeauty"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Aliquota IVA di default (%)</label>
            <input type="number" min={0} max={22} value={vatRate} onChange={e => setVatRate(Number(e.target.value))}
              className="w-32 px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => save()} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Salva
            </button>
            <button onClick={doTest} disabled={testing || !configured} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-secondary border border-border text-text-primary text-sm font-medium hover:bg-bg-hover disabled:opacity-50">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} Testa connessione
            </button>
            {msg && <span className={`text-xs font-medium ${msg.ok ? 'text-success' : 'text-error'}`}>{msg.text}</span>}
          </div>

          <div className="text-[11px] text-text-muted leading-relaxed p-3 rounded-xl bg-bg-secondary/50 border border-border/30">
            Username/password e ID mittente sono le credenziali <b>API</b> fornite da C95 (non quelle del portale web).
            Le credenziali dell&apos;Agenzia delle Entrate restano su C95 (modalità CLOUD) — qui non servono.
          </div>
        </div>
      )}
    </div>
  );
}
