'use client';

/**
 * Bacheca dell'app: da qui il centro pubblica la promo del giorno e le
 * foto dei lavori (le unghie belle!). Con la spunta, la pubblicazione
 * manda anche la notifica push a tutte le clienti con l'app.
 *
 * La foto si comprime QUI, nel browser, prima di partire (max 900px,
 * jpeg): il telefono della cliente scarica 100 KB, non 8 MB.
 */

import { useCallback, useEffect, useState } from 'react';

interface Post {
  id: string;
  tipo: string;
  titolo: string;
  testo: string;
  foto: string | null;
  attivo: boolean;
  pushInviata: boolean;
  createdAt: string;
}

/** Ridimensiona e comprime l'immagine nel browser: torna una data-URI jpeg. */
async function comprimiFoto(file: File): Promise<string> {
  const img = document.createElement('img');
  const url = URL.createObjectURL(file);
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
  const MAX = 900;
  const scala = Math.min(1, MAX / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scala);
  canvas.height = Math.round(img.height * scala);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export default function BachecaPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [tipo, setTipo] = useState<'lavoro' | 'promo'>('lavoro');
  const [titolo, setTitolo] = useState('');
  const [testo, setTesto] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [push, setPush] = useState(true);
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  const carica = useCallback(async () => {
    const r = await fetch('/api/admin/bacheca').then(r => r.json()).catch(() => null);
    if (r?.posts) setPosts(r.posts);
  }, []);
  useEffect(() => { void carica(); }, [carica]);

  const pubblica = async () => {
    if (!titolo.trim()) { setEsito('Metti almeno il titolo.'); return; }
    setInCorso(true);
    setEsito(null);
    try {
      const r = await fetch('/api/admin/bacheca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, titolo, testo, foto, push }),
      }).then(r => r.json());
      if (r.error) { setEsito(r.error); return; }
      setEsito(push ? `Pubblicato ✓ — notifica inviata a ${r.inviate} clienti con l'app` : 'Pubblicato ✓');
      setTitolo(''); setTesto(''); setFoto(null);
      void carica();
    } finally {
      setInCorso(false);
    }
  };

  const toggle = async (p: Post, azione: string) => {
    await fetch('/api/admin/bacheca/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, azione }),
    });
    void carica();
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Bacheca dell&apos;app</h1>
      <p className="text-sm text-gray-500 mb-6">
        La promo del giorno e i lavori del salone, dritti sul telefono delle clienti.
      </p>

      {/* ── Nuovo post ── */}
      <div className="rounded-xl border bg-white p-5 mb-8 space-y-4">
        <div className="flex gap-2">
          {(['lavoro', 'promo'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                tipo === t ? 'bg-black text-white border-black' : 'bg-white text-gray-600'
              }`}
            >
              {t === 'lavoro' ? '✨ Lavoro del salone' : '🎁 Promo del giorno'}
            </button>
          ))}
        </div>

        <input
          value={titolo}
          onChange={e => setTitolo(e.target.value)}
          placeholder={tipo === 'promo' ? 'Es. Oggi manicure a 25€' : 'Es. French rosa antico di oggi'}
          className="w-full border rounded-lg px-3 py-2"
        />
        <textarea
          value={testo}
          onChange={e => setTesto(e.target.value)}
          placeholder="Due righe di descrizione (facoltative)…"
          rows={2}
          className="w-full border rounded-lg px-3 py-2"
        />

        <div className="flex items-center gap-4">
          <label className="cursor-pointer text-sm font-medium text-gray-700 border rounded-lg px-3 py-2 hover:bg-gray-50">
            📷 {foto ? 'Cambia foto' : 'Aggiungi foto'}
            <input
              type="file" accept="image/*" className="hidden"
              onChange={async e => {
                const f = e.target.files?.[0];
                if (f) setFoto(await comprimiFoto(f));
                e.target.value = '';
              }}
            />
          </label>
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="anteprima" className="h-16 w-16 object-cover rounded-lg border" />
          ) : null}
          {foto ? (
            <button onClick={() => setFoto(null)} className="text-sm text-red-600">togli</button>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={push} onChange={e => setPush(e.target.checked)} />
          Manda la notifica push a tutte le clienti con l&apos;app
        </label>

        <button
          onClick={pubblica}
          disabled={inCorso}
          className="bg-black text-white rounded-lg px-5 py-2 font-medium disabled:opacity-50"
        >
          {inCorso ? 'Pubblico…' : 'Pubblica'}
        </button>
        {esito ? <p className="text-sm text-gray-700">{esito}</p> : null}
      </div>

      {/* ── Post pubblicati ── */}
      <h2 className="font-semibold mb-3">Pubblicati</h2>
      <div className="space-y-3">
        {posts.map(p => (
          <div key={p.id} className={`flex items-center gap-4 rounded-xl border bg-white p-3 ${p.attivo ? '' : 'opacity-50'}`}>
            {p.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.foto} alt="" className="h-14 w-14 object-cover rounded-lg" />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center">
                {p.tipo === 'promo' ? '🎁' : '✨'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{p.titolo}</p>
              <p className="text-xs text-gray-500">
                {p.tipo === 'promo' ? 'Promo' : 'Lavoro'} · {p.createdAt.slice(0, 10)}
                {p.pushInviata ? ' · push inviata' : ''}
              </p>
            </div>
            <button onClick={() => toggle(p, p.attivo ? 'spegni' : 'accendi')} className="text-sm text-gray-600">
              {p.attivo ? 'Spegni' : 'Riaccendi'}
            </button>
            <button
              onClick={() => { if (confirm(`Eliminare "${p.titolo}"?`)) void toggle(p, 'elimina'); }}
              className="text-sm text-red-600"
            >
              Elimina
            </button>
          </div>
        ))}
        {posts.length === 0 ? <p className="text-sm text-gray-400">Ancora nessun post.</p> : null}
      </div>
    </div>
  );
}
