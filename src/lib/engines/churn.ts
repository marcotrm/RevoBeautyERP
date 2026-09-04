/**
 * Chi sta scivolando via: euristica trasparente, non magia.
 *
 * Con i numeri di un centro solo un modello «impara» solo rumore; questa
 * regola invece si spiega alla titolare in una frase: «veniva ogni X giorni,
 * non si vede da Y». Rischio ALTO oltre il doppio del proprio ritmo,
 * MEDIO oltre una volta e mezza.
 */

import { prisma } from '@/lib/prisma';

const GIORNO = 86400000;
const oggiISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

export interface ClienteARischio {
  clientId: string;
  nome: string;
  telefono: string;
  ultimaVisita: string;
  giorniDaUltima: number;
  ritmoGiorni: number;
  rischio: 'alto' | 'medio';
  /** Il suggerimento pratico, già scritto. */
  azione: string;
}

export async function clientiARischio(): Promise<ClienteARischio[]> {
  const oggi = oggiISO();
  const da12mesi = new Date(Date.now() - 365 * GIORNO).toISOString().slice(0, 10);

  // Solo chi ha una storia vera (3+ sedute) e nessun futuro in agenda
  const sedute = await prisma.appointment.findMany({
    where: { status: 'completed', date: { gte: da12mesi } },
    orderBy: { date: 'asc' },
    select: { clientId: true, date: true },
  });
  const futuri = await prisma.appointment.findMany({
    where: { date: { gte: oggi }, status: { in: ['confirmed', 'pending'] } },
    select: { clientId: true },
  });
  const conFuturo = new Set(futuri.map((f) => f.clientId));

  const perCliente = new Map<string, string[]>();
  for (const s of sedute) {
    const arr = perCliente.get(s.clientId) ?? [];
    arr.push(s.date);
    perCliente.set(s.clientId, arr);
  }

  const rischi: Omit<ClienteARischio, 'nome' | 'telefono'>[] = [];
  for (const [clientId, date] of perCliente) {
    if (date.length < 3 || conFuturo.has(clientId)) continue;
    let somma = 0;
    for (let i = 1; i < date.length; i++) somma += (Date.parse(date[i]) - Date.parse(date[i - 1])) / GIORNO;
    const ritmo = Math.round(somma / (date.length - 1));
    if (ritmo < 5 || ritmo > 120) continue;

    const ultima = date[date.length - 1];
    const daUltima = Math.round((Date.parse(oggi) - Date.parse(ultima)) / GIORNO);
    if (daUltima < ritmo * 1.5) continue;

    const rischio: 'alto' | 'medio' = daUltima >= ritmo * 2 ? 'alto' : 'medio';
    rischi.push({
      clientId,
      ultimaVisita: ultima,
      giorniDaUltima: daUltima,
      ritmoGiorni: ritmo,
      rischio,
      azione:
        rischio === 'alto'
          ? 'Messaggio personale o telefonata: un\'offerta fredda qui non basta.'
          : 'Proposta gentile di appuntamento, magari con la sua operatrice.',
    });
  }

  // I nomi solo per chi è in lista: una query, non cinquecento
  const clienti = await prisma.client.findMany({
    where: { id: { in: rischi.map((r) => r.clientId) } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  const anagrafica = new Map(clienti.map((c) => [c.id, c]));

  return rischi
    .map((r) => {
      const c = anagrafica.get(r.clientId);
      return {
        ...r,
        nome: c ? `${c.firstName} ${c.lastName}`.trim() : r.clientId,
        telefono: c?.phone ?? '',
      };
    })
    .sort((a, b) => b.giorniDaUltima / b.ritmoGiorni - a.giorniDaUltima / a.ritmoGiorni);
}
