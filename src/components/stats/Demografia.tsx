'use client';

/**
 * Chi frequenta il centro: età, genere, provenienza.
 *
 * È la domanda che sta prima delle altre — che trattamenti spingere, come
 * scrivere i messaggi, dove mettere i soldi della pubblicità — e i dati per
 * rispondere c'erano già, sparsi in trecentosettanta schede.
 *
 * Due scelte da spiegare, perché cambiano la lettura:
 *
 *  - si contano le clienti VENUTE davvero, non le schede in rubrica: fra
 *    quelle ci sono i contatti dell'inaugurazione che non hanno mai messo
 *    piede in centro;
 *  - le percentuali sono su chi il dato ce l'ha. Chi non ha la data di nascita
 *    non diventa una fascia "sconosciuti" che sporca il grafico: si dice a
 *    parte quante sono, perché è un buco da chiudere al banco.
 */

import React, { useMemo, useState } from 'react';
import { Users, Cake, MapPin, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import type { Demografia as DatiDemografia, FasciaDemografica } from '@/app/actions/demografia';
import { Card, Vuoto, Caricamento } from './StatsUI';

const COLORI = ['#A855F7', '#EC4899', '#3B82F6', '#22C55E', '#F59E0B', '#14B8A6', '#EF4444', '#6366F1'];

function Barre({ righe, colori = COLORI }: { righe: FasciaDemografica[]; colori?: string[] }) {
  const max = Math.max(...righe.map(r => r.clienti), 1);
  if (!righe.some(r => r.clienti > 0)) return <Vuoto testo="Nessun dato." />;
  return (
    <div className="space-y-2.5">
      {righe.map((r, i) => (
        <div key={r.nome}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-text-primary">{r.nome}</span>
            <span className="text-sm text-text-secondary tabular-nums">
              <b className="text-text-primary">{r.clienti}</b>
              <span className="text-text-muted"> · {r.percentuale}%</span>
              {r.spesaMedia > 0 && <span className="text-[11px] text-text-muted"> · {formatCurrency(r.spesaMedia)} a testa</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-bg-tertiary mt-1 overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${(r.clienti / max) * 100}%`, backgroundColor: colori[i % colori.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Demografia({ dati }: { dati: DatiDemografia | null }) {
  const [scelte, setScelte] = useState<Set<string>>(new Set());
  const [cerca, setCerca] = useState('');
  const [spiega, setSpiega] = useState(false);

  const citta = useMemo(() => dati?.citta ?? [], [dati]);
  const filtrate = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return q ? citta.filter(c => c.nome.toLowerCase().includes(q)) : citta;
  }, [citta, cerca]);

  /* Il riepilogo delle città spuntate: serve a confrontare due zone. */
  const selezione = useMemo(() => {
    const dentro = citta.filter(c => scelte.has(c.nome));
    const clienti = dentro.reduce((s, c) => s + c.clienti, 0);
    const spesa = Math.round(dentro.reduce((s, c) => s + c.spesa, 0) * 100) / 100;
    const totale = citta.reduce((s, c) => s + c.clienti, 0);
    return {
      clienti, spesa,
      percentuale: totale ? Math.round((clienti / totale) * 1000) / 10 : 0,
      media: clienti ? Math.round((spesa / clienti) * 100) / 100 : 0,
    };
  }, [citta, scelte]);

  if (!dati) return <Caricamento />;

  const spunta = (nome: string) => setScelte(prev => {
    const n = new Set(prev);
    if (n.has(nome)) n.delete(nome); else n.add(nome);
    return n;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" />
          <h3 className="text-base font-display font-semibold text-text-primary">Chi frequenta il centro</h3>
          <span className="text-xs text-text-muted">
            {dati.venute} clienti venute almeno una volta · età media {dati.etaMedia} anni
          </span>
        </div>
        <button onClick={() => setSpiega(v => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">
          <Info className="w-3.5 h-3.5" /> {spiega ? 'nascondi' : 'come si leggono'}
        </button>
      </div>

      {spiega && (
        <div className="rounded-xl border border-accent/25 bg-accent/5 p-4 space-y-1.5 text-[11px] text-text-secondary leading-relaxed">
          <p><b className="text-text-primary">Chi si conta</b>: solo le clienti che sono venute almeno una volta da
            quando il centro ha aperto. Le schede raccolte all&apos;inaugurazione e mai tornate non ci sono: gonfiano
            i numeri e non comprano niente.</p>
          <p><b className="text-text-primary">Le percentuali</b> sono calcolate su chi ha il dato in scheda. Chi non
            ce l&apos;ha è contato a parte, sotto ogni riquadro: non è una fascia d&apos;età, è un dato da chiedere al
            banco.</p>
          <p><b className="text-text-primary">La spesa a testa</b> è quanto ha lasciato in cassa in media una cliente
            di quella fascia. È il numero che dice dove sta il valore, che spesso non è dove sta il numero di persone.</p>
          <p><b className="text-text-primary">Le città</b> sono ripulite dai modi diversi di scriverle (maddaloni,
            Maddaloni, Maddalomi contano insieme). I paesi vicini restano separati: Valle di Maddaloni non è Maddaloni.</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card titolo="Età" spiega="Quante clienti per fascia, e quanto lascia in cassa ognuna. Se il valore sta in una fascia diversa da quella più numerosa, il listino sta parlando a due pubblici.">
          <Barre righe={dati.eta} />
          {dati.senzaNascita > 0 && (
            <p className="text-[11px] text-text-muted mt-3">
              {dati.senzaNascita} clienti non hanno la data di nascita in scheda: non sono in questi conti, e
              non ricevono nemmeno gli auguri col regalo.
            </p>
          )}
        </Card>

        <Card titolo="Donne e uomini" spiega="Percentuali su chi ha il genere in scheda. La spesa a testa dice se il pubblico maschile vale quanto sembra.">
          <div className="flex items-center gap-3 mb-3">
            <Cake className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted">
              {dati.genere.map(g => `${g.nome} ${g.percentuale}%`).join(' · ')}
            </span>
          </div>
          <Barre righe={dati.genere} colori={['#EC4899', '#3B82F6']} />
          {dati.senzaGenere > 0 && (
            <p className="text-[11px] text-text-muted mt-3">{dati.senzaGenere} schede senza il genere indicato.</p>
          )}
        </Card>
      </div>

      <Card titolo="Da dove vengono"
        spiega="Città delle clienti che sono venute davvero. Spunta una o più città per vedere quanto pesano insieme: serve a decidere dove ha senso farsi pubblicità e fin dove la gente è disposta a spostarsi.">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca una città…"
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
          </div>
          {scelte.size > 0 && (
            <button onClick={() => setScelte(new Set())}
              className="text-[11px] text-text-muted hover:text-text-primary">togli la selezione</button>
          )}
        </div>

        {scelte.size > 0 && (
          <div className="mb-3 p-3 rounded-xl bg-accent/10 border border-accent/25">
            <p className="text-xs text-text-secondary">
              <b className="text-accent">{scelte.size} {scelte.size === 1 ? 'città scelta' : 'città scelte'}</b>:{' '}
              <b className="text-text-primary">{selezione.clienti} clienti</b> ({selezione.percentuale}% di chi ha la
              città in scheda) · hanno speso <b className="text-text-primary">{formatCurrency(selezione.spesa)}</b>,{' '}
              {formatCurrency(selezione.media)} a testa.
            </p>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
          {filtrate.map(c => (
            <label key={c.nome} className="flex items-center gap-3 py-2 cursor-pointer hover:bg-bg-hover/40 px-1 rounded">
              <input type="checkbox" checked={scelte.has(c.nome)} onChange={() => spunta(c.nome)}
                className="w-4 h-4 rounded border-border accent-accent cursor-pointer flex-shrink-0" />
              <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{c.nome}</span>
              <span className="text-sm text-text-secondary tabular-nums flex-shrink-0">
                <b className="text-text-primary">{c.clienti}</b>
                <span className="text-text-muted"> · {c.percentuale}%</span>
                <span className="text-[11px] text-text-muted"> · {formatCurrency(c.spesaMedia)} a testa</span>
              </span>
            </label>
          ))}
          {filtrate.length === 0 && <Vuoto testo="Nessuna città con questo nome." />}
        </div>

        {dati.senzaCitta > 0 && (
          <p className="text-[11px] text-text-muted mt-3">
            {dati.senzaCitta} clienti non hanno la città in scheda: si chiede al check-in, insieme all&apos;indirizzo.
          </p>
        )}
      </Card>
    </div>
  );
}
