'use server';

/**
 * Tutte le volte che un trattamento è stato fatto davvero.
 *
 * Nelle statistiche si legge "Epilazione laser Total Body — 260 €, 2 volte" e
 * la domanda che viene subito dopo è: quando? a chi? con chi? Finora bisognava
 * andare a cercarle in agenda una per una, sapendo già dove guardare — cioè
 * non si faceva.
 *
 * Il nome è la chiave, perché è così che le statistiche contano: un
 * appuntamento con più trattamenti li tiene dentro `services`, e ogni riga di
 * lì vale come una seduta a sé.
 */

import { prisma } from '@/lib/prisma';

export interface SedutaTrattamento {
  appointmentId: string;
  data: string;
  ora: string;
  cliente: string;
  clientId: string | null;
  operatrice: string;
  prezzo: number;
  durata: number;
  /** Vero se quella riga era coperta da un pacchetto (prezzo a zero). */
  daPacchetto: boolean;
  stato: string;
}

export interface StoricoTrattamento {
  nome: string;
  sedute: SedutaTrattamento[];
  volte: number;
  incasso: number;
  prezzoMedio: number;
  clientiDiverse: number;
  perOperatrice: { nome: string; volte: number; incasso: number }[];
  perMese: { mese: string; volte: number; incasso: number }[];
  /** Chi lo fa più spesso: le clienti affezionate a quel trattamento. */
  topClienti: { nome: string; volte: number; spesa: number }[];
  primaVolta: string | null;
  ultimaVolta: string | null;
}

const norm = (s: string) => (s || '').trim().toLowerCase();

export async function storicoTrattamento(nome: string, mesi = 12): Promise<StoricoTrattamento> {
  const da = new Date();
  da.setMonth(da.getMonth() - mesi);
  const dal = da.toISOString().slice(0, 10);

  const appuntamenti = await prisma.appointment.findMany({
    where: { date: { gte: dal }, status: 'completed' },
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
  });

  const cercato = norm(nome);
  const sedute: SedutaTrattamento[] = [];

  for (const a of appuntamenti) {
    const servizi = Array.isArray(a.services) ? (a.services as unknown as {
      treatmentName?: string; price?: number; duration?: number; operatorName?: string; startTime?: string;
    }[]) : [];

    /*
      Due strade, come nelle statistiche: se l'appuntamento ha l'elenco dei
      trattamenti si guarda riga per riga (una seduta può contenere il
      trattamento cercato insieme ad altri due); se non ce l'ha — i più
      vecchi — vale il nome scritto sull'appuntamento.
    */
    const righe = servizi.length > 0
      ? servizi.filter(s => norm(s.treatmentName || '') === cercato)
        .map(s => ({
          prezzo: s.price ?? 0,
          durata: s.duration ?? a.duration,
          operatrice: s.operatorName || a.operatorName,
          ora: s.startTime || a.startTime,
        }))
      : (norm(a.treatmentName) === cercato
        ? [{ prezzo: a.price, durata: a.duration, operatrice: a.operatorName, ora: a.startTime }]
        : []);

    for (const r of righe) {
      sedute.push({
        appointmentId: a.id,
        data: a.date,
        ora: r.ora,
        cliente: a.clientName,
        clientId: a.clientId,
        operatrice: r.operatrice,
        prezzo: Math.round((r.prezzo || 0) * 100) / 100,
        durata: r.durata || 0,
        // Prezzo a zero su una seduta completata vuol dire quasi sempre
        // pacchetto o omaggio: si segnala, se no sembra un errore di listino.
        daPacchetto: (r.prezzo || 0) === 0,
        stato: a.status,
      });
    }
  }

  const incasso = Math.round(sedute.reduce((s, x) => s + x.prezzo, 0) * 100) / 100;
  const pagate = sedute.filter(s => s.prezzo > 0);

  const conta = <T>(chiave: (s: SedutaTrattamento) => string, extra: (s: SedutaTrattamento) => number) => {
    const m = new Map<string, { volte: number; somma: number }>();
    for (const s of sedute) {
      const k = chiave(s);
      const c = m.get(k) || { volte: 0, somma: 0 };
      c.volte += 1; c.somma += extra(s);
      m.set(k, c);
    }
    return [...m.entries()].sort((a, b) => b[1].volte - a[1].volte) as [string, { volte: number; somma: number }][];
  };

  return {
    nome,
    sedute,
    volte: sedute.length,
    incasso,
    prezzoMedio: pagate.length > 0 ? Math.round((pagate.reduce((s, x) => s + x.prezzo, 0) / pagate.length) * 100) / 100 : 0,
    clientiDiverse: new Set(sedute.map(s => s.clientId || s.cliente)).size,
    perOperatrice: conta(s => s.operatrice, s => s.prezzo)
      .map(([nome, v]) => ({ nome, volte: v.volte, incasso: Math.round(v.somma * 100) / 100 })),
    perMese: conta(s => s.data.slice(0, 7), s => s.prezzo)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mese, v]) => ({ mese, volte: v.volte, incasso: Math.round(v.somma * 100) / 100 })),
    topClienti: conta(s => s.cliente, s => s.prezzo)
      .slice(0, 8)
      .map(([nome, v]) => ({ nome, volte: v.volte, spesa: Math.round(v.somma * 100) / 100 })),
    primaVolta: sedute.length ? sedute[sedute.length - 1].data : null,
    ultimaVolta: sedute.length ? sedute[0].data : null,
  };
}
