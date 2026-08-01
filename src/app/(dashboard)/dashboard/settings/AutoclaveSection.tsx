'use client';

/**
 * Impostazioni → Autoclave: il registro delle disinfezioni serali.
 *
 * Ogni sera chi fa il ciclo lo segna qui: operatrice (dall'anagrafica del
 * centro), data e numero di pezzi nella macchina. Lo storico si consulta per
 * giorno, settimana o mese, e con Stampa / Scarica PDF diventa il registro
 * da mettere in mano all'ispettore.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Plus, Loader2, ChevronLeft, ChevronRight, Printer, FileDown, Trash2 } from 'lucide-react';
import { useOperatorStore } from '@/stores/useOperatorStore';
import { listaDisinfezioni, aggiungiDisinfezione, eliminaDisinfezione, type Disinfezione } from '@/app/actions/autoclave';

const oggiRome = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });

/** Il periodo [dal, al] per il tipo scelto, partendo dal giorno di riferimento. */
function periodoPer(tipo: 'giorno' | 'settimana' | 'mese', rif: string): { dal: string; al: string; label: string } {
  const [y, m, d] = rif.split('-').map(Number);
  const data = new Date(y, m - 1, d);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

  if (tipo === 'giorno') {
    return { dal: rif, al: rif, label: data.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
  }
  if (tipo === 'settimana') {
    const lun = new Date(data);
    lun.setDate(data.getDate() - ((data.getDay() + 6) % 7));
    const dom = new Date(lun);
    dom.setDate(lun.getDate() + 6);
    return {
      dal: iso(lun), al: iso(dom),
      label: `${lun.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${dom.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    };
  }
  const primo = new Date(y, m - 1, 1);
  const ultimo = new Date(y, m, 0);
  return { dal: iso(primo), al: iso(ultimo), label: primo.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) };
}

/** Sposta il giorno di riferimento avanti/indietro di un periodo. */
function spostaRif(tipo: 'giorno' | 'settimana' | 'mese', rif: string, verso: 1 | -1): string {
  const [y, m, d] = rif.split('-').map(Number);
  // Per il mese si riparte SEMPRE dal giorno 1: con il 31 in mano, setMonth
  // sborda (31 gennaio + 1 mese = 3 marzo) e febbraio diventa irraggiungibile.
  const data = tipo === 'mese' ? new Date(y, m - 1 + verso, 1) : new Date(y, m - 1, d);
  if (tipo === 'giorno') data.setDate(data.getDate() + verso);
  else if (tipo === 'settimana') data.setDate(data.getDate() + 7 * verso);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

const dataIt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const oraIt = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });

export default function AutoclaveSection() {
  const operators = useOperatorStore(s => s.operators);
  const fetchOperators = useOperatorStore(s => s.fetchOperators);
  useEffect(() => { fetchOperators(); }, [fetchOperators]);
  const operatrici = useMemo(() => operators.filter(o => o.isActive && !o.isResource), [operators]);

  // --- modulo di inserimento -------------------------------------------
  const [form, setForm] = useState({ date: oggiRome(), operatorId: '', pieces: '', notes: '' });
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);

  // --- storico ----------------------------------------------------------
  const [tipo, setTipo] = useState<'giorno' | 'settimana' | 'mese'>('mese');
  const [rif, setRif] = useState(oggiRome());
  const { dal, al, label } = periodoPer(tipo, rif);
  const [dati, setDati] = useState<{ chiave: string; righe: Disinfezione[] } | null>(null);
  const chiave = `${dal}_${al}`;
  // Il periodo corrente vive anche in una ref: le risposte arrivate in ritardo
  // (periodo cambiato mentre la richiesta era in volo) vengono buttate via,
  // altrimenti sovrascrivono lo storico e lo lasciano su "Carico…" per sempre.
  const periodoRef = React.useRef(chiave);
  useEffect(() => { periodoRef.current = chiave; }, [chiave]);

  useEffect(() => {
    const mia = `${dal}_${al}`;
    listaDisinfezioni(dal, al)
      .then(righe => { if (periodoRef.current === mia) setDati({ chiave: mia, righe }); })
      .catch(() => { if (periodoRef.current === mia) setDati({ chiave: mia, righe: [] }); });
  }, [dal, al]);

  const righe = dati?.chiave === chiave ? dati.righe : null;
  const totalePezzi = (righe || []).reduce((s, r) => s + r.pieces, 0);

  const ricarica = async () => {
    const mia = periodoRef.current;
    const [d, a] = mia.split('_');
    const nuove = await listaDisinfezioni(d, a);
    if (periodoRef.current === mia) setDati({ chiave: mia, righe: nuove });
  };

  const salva = async () => {
    const op = operatrici.find(o => o.id === form.operatorId);
    setSalvo(true); setErrore(null); setFatto(false);
    try {
      const res = await aggiungiDisinfezione({
        date: form.date,
        operatorId: form.operatorId,
        operatorName: op ? `${op.firstName} ${op.lastName}`.trim() : '',
        pieces: Number(form.pieces),
        notes: form.notes || undefined,
      });
      if (!res.ok) setErrore(res.error || 'Salvataggio non riuscito');
      else {
        setForm(f => ({ ...f, pieces: '', notes: '' }));
        setFatto(true);
        setTimeout(() => setFatto(false), 2500);
        await ricarica();
      }
    } catch {
      setErrore('Salvataggio non riuscito: controlla la connessione e riprova.');
    } finally {
      // il finally è la rete di sicurezza: senza, un errore lascerebbe il
      // bottone Registra con lo spinner per sempre
      setSalvo(false);
    }
  };

  const elimina = async (id: string) => {
    if (!confirm('Cancellare questa riga del registro?')) return;
    try {
      await eliminaDisinfezione(id);
      await ricarica();
    } catch { /* riga rimasta: si vede dallo storico, si riprova */ }
  };

  // --- stampa e PDF -----------------------------------------------------

  const intestazione = `Registro disinfezioni autoclave — ${label}`;

  // Nomi e note sono testo libero: senza escape una nota con "<" romperebbe la stampa
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const stampa = () => {
    if (!righe) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Sblocca i popup per stampare il registro.'); return; }
    const righeHtml = righe.map(r => `
      <tr>
        <td>${dataIt(r.date)}</td>
        <td>${oraIt(r.createdAt)}</td>
        <td>${esc(r.operatorName)}</td>
        <td style="text-align:center">${r.pieces}</td>
        <td>${esc(r.notes || '')}</td>
        <td style="width:120px"></td>
      </tr>`).join('');
    w.document.write(`<!doctype html><html><head><title>${intestazione}</title>
      <style>
        body { font-family: -apple-system, Segoe UI, sans-serif; color: #111; padding: 24px; }
        h1 { font-size: 18px; margin: 0 0 2px; } h2 { font-size: 13px; font-weight: normal; color: #555; margin: 0 0 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; }
        th { background: #f2f2f2; }
        .tot { margin-top: 12px; font-size: 12px; }
      </style></head><body>
      <h1>RevoBeauty — Registro disinfezioni autoclave</h1>
      <h2>Periodo: ${label} · Stampato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</h2>
      <table>
        <thead><tr><th>Data</th><th>Ora</th><th>Operatrice</th><th>Pezzi</th><th>Note</th><th>Firma</th></tr></thead>
        <tbody>${righeHtml || '<tr><td colspan="6" style="text-align:center;color:#777">Nessuna disinfezione nel periodo</td></tr>'}</tbody>
      </table>
      <p class="tot">Cicli registrati: <b>${righe.length}</b> · Pezzi totali: <b>${totalePezzi}</b></p>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const scaricaPdf = async () => {
    if (!righe) return;
    const { default: JsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new JsPDF();
    doc.setFontSize(14);
    doc.text('RevoBeauty — Registro disinfezioni autoclave', 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Periodo: ${label} — generato il ${new Date().toLocaleDateString('it-IT')}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [['Data', 'Ora', 'Operatrice', 'Pezzi', 'Note']],
      body: righe.map(r => [dataIt(r.date), oraIt(r.createdAt), r.operatorName, String(r.pieces), r.notes || '']),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [168, 85, 247] },
    });
    const fineTabella = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 30;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Cicli registrati: ${righe.length} — Pezzi totali: ${totalePezzi}`, 14, fineTabella + 8);
    doc.save(`registro-autoclave-${dal}_${al}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><FlaskConical className="w-5 h-5" /></div>
        <div>
          <h3 className="text-lg font-display font-semibold text-text-primary">Autoclave</h3>
          <p className="text-sm text-text-secondary">Il registro delle disinfezioni serali degli attrezzi: si compila ogni sera, si stampa quando serve.</p>
        </div>
      </div>

      {/* Inserimento della sera */}
      <div className="rounded-2xl border border-border bg-bg-secondary p-4 space-y-3">
        <p className="text-sm font-bold text-text-primary">Registra la disinfezione</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">Operatrice *</label>
            <select value={form.operatorId} onChange={e => setForm(f => ({ ...f, operatorId: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary">
              <option value="">Scegli…</option>
              {operatrici.map(o => <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>)}
            </select>
            {operatrici.length === 0 && (
              <p className="text-[11px] text-warning mt-1">Elenco operatrici vuoto: ricarica la pagina o controlla l&apos;anagrafica in Staff.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">Data *</label>
            <input type="date" value={form.date} onChange={e => e.target.value && setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">Pezzi nella macchina *</label>
            <input inputMode="numeric" value={form.pieces} onChange={e => setForm(f => ({ ...f, pieces: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="Es. 12"
              className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-text-secondary mb-1">Note (facoltative)</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Es. secondo ciclo, carico frese…"
            className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted" />
        </div>
        {errore && <p className="text-sm text-error">{errore}</p>}
        {fatto && <p className="text-sm text-success">Disinfezione registrata ✓</p>}
        <button onClick={salva} disabled={salvo || !form.operatorId || !form.pieces}
          className="px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
          {salvo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registra
        </button>
      </div>

      {/* Storico */}
      <div className="rounded-2xl border border-border bg-bg-secondary p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-bold text-text-primary">Storico</p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 p-1 rounded-lg bg-bg-tertiary/60">
              {(['giorno', 'settimana', 'mese'] as const).map(t => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`px-3 py-1 rounded-md text-xs font-bold capitalize ${tipo === t ? 'bg-bg-secondary text-accent shadow' : 'text-text-secondary'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setRif(r => spostaRif(tipo, r, -1))} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-semibold text-text-primary capitalize min-w-[150px] text-center">{label}</span>
              <button onClick={() => setRif(r => spostaRif(tipo, r, 1))} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><ChevronRight className="w-4 h-4" /></button>
              <button onClick={() => setRif(oggiRome())} className="px-2.5 py-1 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover">Oggi</button>
            </div>
            <button onClick={stampa} disabled={!righe}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover flex items-center gap-1 disabled:opacity-50">
              <Printer className="w-3.5 h-3.5" /> Stampa
            </button>
            <button onClick={scaricaPdf} disabled={!righe}
              className="px-3 py-1.5 rounded-lg gradient-accent text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50">
              <FileDown className="w-3.5 h-3.5" /> Scarica PDF
            </button>
          </div>
        </div>

        {righe === null ? (
          <div className="flex items-center py-6 text-text-muted text-sm"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Carico…</div>
        ) : righe.length === 0 ? (
          <p className="text-sm text-text-secondary py-4">Nessuna disinfezione registrata in questo periodo.</p>
        ) : (
          <>
            <p className="text-xs text-text-secondary">{righe.length} cicli · {totalePezzi} pezzi totali</p>
            <div className="space-y-1.5">
              {righe.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl bg-bg-tertiary/40 border border-border/60 px-3 py-2.5">
                  <FlaskConical className="w-4 h-4 text-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary capitalize">{dataIt(r.date)} <span className="text-text-muted font-normal">· registrato alle {oraIt(r.createdAt)}</span></p>
                    <p className="text-xs text-text-secondary">{r.operatorName} · <b className="text-text-primary">{r.pieces} pezzi</b>{r.notes ? ` · ${r.notes}` : ''}</p>
                  </div>
                  <button onClick={() => elimina(r.id)} title="Cancella riga"
                    className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-bg-hover flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
