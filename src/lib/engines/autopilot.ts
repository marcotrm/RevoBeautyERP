/**
 * Revo Autopilot: «non deve ricordarselo lei, ci pensa l'app».
 *
 * La cadenza non si scrive a mano in nessuna tabella: si legge dalla storia
 * vera della cliente. Se ha fatto la stessa seduta almeno due volte, la media
 * degli intervalli è il SUO ritmo, e la finestra consigliata è ±20% intorno.
 * Quando la finestra si apre e in agenda non c'è nulla di quel tipo, si
 * propongono i tre orari migliori — usando il motore di prenotazione vero,
 * con l'operatrice che sceglie più spesso.
 */

import { prisma } from '@/lib/prisma';
import { cercaSlot } from '@/lib/bookingEngine';
import { soloNome } from '@/lib/nomiPropri';

const GIORNO = 86400000;
const oggiISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
const piuGiorni = (data: string, giorni: number) =>
  new Date(Date.parse(data) + giorni * GIORNO).toISOString().slice(0, 10);

export interface SlotAutopilot {
  date: string;
  time: string;
  endTime: string;
  operatorName: string;
  operatorId: string;
}

export interface SuggerimentoAutopilot {
  treatmentId: string;
  treatmentName: string;
  ultimaSeduta: string;
  ogniGiorni: number;
  finestraDa: string;
  finestraA: string;
  /** true quando la finestra è già aperta (o alle porte: -3 giorni) */
  aperta: boolean;
  slots: SlotAutopilot[];
}

/**
 * I suggerimenti per una cliente. `conSlots` fa girare anche il motore di
 * prenotazione (più lento): la Home lo chiede, il giro notturno no.
 */
export async function suggerimentiAutopilot(
  clientId: string,
  opzioni: { conSlots?: boolean } = {}
): Promise<SuggerimentoAutopilot[]> {
  const oggi = oggiISO();
  const da12mesi = new Date(Date.now() - 365 * GIORNO).toISOString().slice(0, 10);

  const [cliente, sedute, futuri] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { gender: true } }),
    prisma.appointment.findMany({
      where: { clientId, status: 'completed', date: { gte: da12mesi } },
      orderBy: { date: 'asc' },
      select: { treatmentId: true, treatmentName: true, date: true, operatorId: true },
    }),
    prisma.appointment.findMany({
      where: { clientId, date: { gte: oggi }, status: { in: ['confirmed', 'pending'] } },
      select: { treatmentId: true },
    }),
  ]);
  if (!cliente) return [];

  const giaPrenotati = new Set(futuri.map((f) => f.treatmentId));

  // Raggruppa per trattamento e calcola il ritmo personale
  const perTrattamento = new Map<string, typeof sedute>();
  for (const s of sedute) {
    const gruppo = perTrattamento.get(s.treatmentId) ?? [];
    gruppo.push(s);
    perTrattamento.set(s.treatmentId, gruppo);
  }

  const suggerimenti: SuggerimentoAutopilot[] = [];
  for (const [treatmentId, storia] of perTrattamento) {
    if (storia.length < 2) continue; // una volta sola non è un ritmo
    if (giaPrenotati.has(treatmentId)) continue; // il prossimo passo c'è già

    let somma = 0;
    for (let i = 1; i < storia.length; i++) {
      somma += (Date.parse(storia[i].date) - Date.parse(storia[i - 1].date)) / GIORNO;
    }
    const media = Math.round(somma / (storia.length - 1));
    if (media < 7 || media > 120) continue; // ritmi senza senso: fuori

    const ultima = storia[storia.length - 1].date;
    const finestraDa = piuGiorni(ultima, Math.round(media * 0.8));
    const finestraA = piuGiorni(ultima, Math.round(media * 1.2));
    if (oggi > piuGiorni(finestraA, 30)) continue; // finestra morta da un mese: è churn, non autopilot

    const aperta = oggi >= piuGiorni(finestraDa, -3);
    suggerimenti.push({
      treatmentId,
      treatmentName: storia[storia.length - 1].treatmentName,
      ultimaSeduta: ultima,
      ogniGiorni: media,
      finestraDa,
      finestraA,
      aperta,
      slots: [],
    });
  }

  // Prima le finestre aperte, poi quelle più vicine
  suggerimenti.sort((a, b) => Number(b.aperta) - Number(a.aperta) || a.finestraDa.localeCompare(b.finestraDa));

  // Gli orari veri, solo per il suggerimento principale (il motore costa)
  if (opzioni.conSlots && suggerimenti.length > 0 && suggerimenti[0].aperta) {
    const s = suggerimenti[0];
    const storia = perTrattamento.get(s.treatmentId)!;

    // L'operatrice del cuore: la più frequente nelle ultime sedute
    const conta = new Map<string, number>();
    for (const seduta of storia.slice(-5)) {
      conta.set(seduta.operatorId, (conta.get(seduta.operatorId) ?? 0) + 1);
    }
    const preferita = [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const gender = String(cliente.gender).toUpperCase() === 'M' ? 'male' as const : 'female' as const;
    const dateFrom = s.finestraDa > oggi ? s.finestraDa : oggi;

    let esito = await cercaSlot({
      dateFrom, giorni: 14, gender,
      services: [{ treatmentId: s.treatmentId, operatorId: preferita }],
      maxPerGiorno: 2,
    });
    // Con la preferita piena si allarga a chiunque sappia farlo
    if (esito.giorni.length === 0 && preferita) {
      esito = await cercaSlot({
        dateFrom, giorni: 14, gender,
        services: [{ treatmentId: s.treatmentId }],
        maxPerGiorno: 2,
      });
    }

    s.slots = esito.giorni
      .flatMap((g) =>
        g.slots.map((slot) => ({
          date: g.date,
          time: slot.time,
          endTime: slot.endTime,
          operatorName: soloNome(slot.assegnazioni[0]?.operatorName),
          operatorId: slot.assegnazioni[0]?.operatorId ?? '',
        }))
      )
      .slice(0, 3);
  }

  return suggerimenti.slice(0, 3);
}
