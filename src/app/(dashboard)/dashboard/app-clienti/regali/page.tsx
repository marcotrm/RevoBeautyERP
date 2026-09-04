'use client';

/**
 * Regali coi punti: la vetrina si prepara qui.
 *
 * Si cerca nel magazzino vero, si carica la foto (compressa nel browser),
 * si scrive quanti punti costa — e il prodotto compare nell'app. Sotto,
 * i riscatti da consegnare al banco: la cliente mostra il codice, si
 * preme «Consegnato» e lo stock scala da solo.
 */

import { useCallback, useEffect, useState } from 'react';

interface Prodotto {
  id: string;
  name: string;
  brand: string;
  category: string;
  stock: number;
  price: number;
  image: string | null;
  premio: { punti: number; attivo: boolean } | null;
}

interface Riscatto {
  id: string;
  clientName: string;
  nomeProdotto: string;
  punti: number;
  codice: string;
  createdAt: string;
  stato: string;
}

async function comprimiFoto(file: File): Promise<string> {
  const img = document.createElement('img');
  const url = URL.createObjectURL(file);
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
  const MAX = 700;
  const scala = Math.min(1, MAX / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scala);
  canvas.height = Math.round(img.height * scala);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export default function RegaliPage() {
  const [q, setQ] = useState('');
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [daRitirare, setDaRitirare] = useState<Riscatto[]>([]);
  const [puntiBozza, setPuntiBozza] = useState<Record<string, string>>({});

  const carica = useCallback(async (cerca: string) => {
    const r = await fetch(`/api/admin/premi-prodotti?q=${encodeURIComponent(cerca)}`).then(r => r.json()).catch(() => null);
    if (r?.prodotti) setProdotti(r.prodotti);
  }, []);
  const caricaRiscatti = useCallback(async () => {
    const r = await fetch('/api/admin/premi-riscatti').then(r => r.json()).catch(() => null);
    if (r?.daRitirare) setDaRitirare(r.daRitirare);
  }, []);

  useEffect(() => { void carica(''); void caricaRiscatti(); }, [carica, caricaRiscatti]);
  useEffect(() => {
    const t = setTimeout(() => void carica(q), 350);
    return () => clearTimeout(t);
  }, [q, carica]);

  const salva = async (p: Prodotto, dati: { punti?: number; attivo?: boolean; image?: string }) => {
    await fetch('/api/admin/premi-prodotti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: p.id, ...dati }),
    });
    void carica(q);
  };

  const gestisci = async (id: string, azione: 'consegna' | 'annulla') => {
    await fetch('/api/admin/premi-riscatti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, azione }),
    });
    void caricaRiscatti();
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Regali coi punti</h1>
      <p className="text-sm text-gray-500 mb-6">
        Scegli dallo scaffale cosa regalare, metti la foto e quanti punti costa: compare nell&apos;app.
      </p>

      {/* ── Da consegnare ── */}
      {daRitirare.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-8">
          <h2 className="font-semibold mb-3">🎁 Da consegnare al banco</h2>
          <div className="space-y-2">
            {daRitirare.map(r => (
              <div key={r.id} className="flex items-center gap-3 bg-white rounded-lg border p-3">
                <span className="font-mono text-lg font-bold tracking-widest">{r.codice}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.nomeProdotto}</p>
                  <p className="text-xs text-gray-500">{r.clientName} · {r.punti} punti · {r.createdAt.slice(0, 10)}</p>
                </div>
                <button onClick={() => void gestisci(r.id, 'consegna')} className="text-sm bg-black text-white rounded-lg px-3 py-1.5">
                  Consegnato
                </button>
                <button onClick={() => { if (confirm('Annullare e restituire i punti?')) void gestisci(r.id, 'annulla'); }} className="text-sm text-red-600">
                  Annulla
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── La vetrina ── */}
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Cerca nel magazzino (nome o marca)…"
        className="w-full border rounded-lg px-3 py-2 mb-4"
      />
      <div className="space-y-2">
        {prodotti.map(p => (
          <div key={p.id} className={`flex items-center gap-3 rounded-xl border bg-white p-3 ${p.premio?.attivo ? 'border-emerald-300' : ''}`}>
            <label className="cursor-pointer flex-shrink-0" title="Carica la foto">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="h-14 w-14 object-cover rounded-lg border" />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-gray-100 border border-dashed flex items-center justify-center text-lg">📷</div>
              )}
              <input
                type="file" accept="image/*" className="hidden"
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (f) void salva(p, { image: await comprimiFoto(f) });
                  e.target.value = '';
                }}
              />
            </label>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.brand ? `${p.brand} · ` : ''}{p.name}</p>
              <p className="text-xs text-gray-500">{p.category} · {p.stock} a scaffale · listino {p.price}€</p>
            </div>
            <input
              type="number" min={0} placeholder="punti"
              defaultValue={p.premio?.punti ?? ''}
              onChange={e => setPuntiBozza(prev => ({ ...prev, [p.id]: e.target.value }))}
              className="w-24 border rounded-lg px-2 py-1.5 text-sm text-right"
            />
            <button
              onClick={() => void salva(p, { punti: Number(puntiBozza[p.id] ?? p.premio?.punti ?? 0), attivo: true })}
              className="text-sm bg-black text-white rounded-lg px-3 py-1.5"
            >
              {p.premio ? 'Aggiorna' : 'In vetrina'}
            </button>
            {p.premio ? (
              <button onClick={() => void salva(p, { punti: 0 })} className="text-sm text-red-600">Togli</button>
            ) : null}
          </div>
        ))}
        {prodotti.length === 0 ? <p className="text-sm text-gray-400">Nessun prodotto trovato.</p> : null}
      </div>
    </div>
  );
}
