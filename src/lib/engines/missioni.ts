/**
 * Missioni e badge: la gamification che premia gesti veri.
 *
 * L'avanzamento NON è un contatore: si calcola dai dati ogni volta che
 * serve. Un contatore può scordarsi di crescere o crescere due volte; le
 * sedute in agenda invece sono quelle. In `mission_claims` finisce solo il
 * riscatto — quello sì, una volta sola (vincolo unico clientId+codice).
 */

import { prisma } from '@/lib/prisma';
import { muoviPunti } from '@/lib/wallet';

const GIORNO = 86400000;
const oggiISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

export interface MissioneConStato {
  codice: string;
  titolo: string;
  descrizione: string;
  premioPunti: number;
  badge: { codice: string; nome: string } | null;
  target: number;
  avanzamento: number;
  completata: boolean;
  riscattata: boolean;
}

interface DefinizioneMissione {
  codice: string;
  titolo: string;
  descrizione: string;
  premioPunti: number;
  badge?: { codice: string; nome: string };
  target: number;
  /** Quante volte l'ha già fatto: la verità viene dal database. */
  avanzamento: (clientId: string) => Promise<number>;
}

/**
 * Il registro. Aggiungere una missione = aggiungere una voce qui: il
 * riscatto, i punti e i badge funzionano da soli.
 */
const MISSIONI: DefinizioneMissione[] = [
  {
    codice: 'streak-3',
    titolo: 'Perfect Streak',
    descrizione: 'Completa 3 appuntamenti senza mancarne nessuno',
    premioPunti: 300,
    badge: { codice: 'perfect-streak', nome: 'Perfect Streak' },
    target: 3,
    avanzamento: async (clientId) => {
      // Le ultime sedute in ordine: lo streak si spezza al primo no-show
      const ultime = await prisma.appointment.findMany({
        where: { clientId, status: { in: ['completed', 'no_show'] } },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        take: 10,
        select: { status: true },
      });
      let streak = 0;
      for (const a of ultime) {
        if (a.status !== 'completed') break;
        streak++;
      }
      return streak;
    },
  },
  {
    codice: 'esploratrice',
    titolo: 'Esploratrice',
    descrizione: 'Prova trattamenti di 3 aree diverse',
    premioPunti: 200,
    badge: { codice: 'beauty-addict', nome: 'Beauty Addict' },
    target: 3,
    avanzamento: async (clientId) => {
      const sedute = await prisma.appointment.findMany({
        where: { clientId, status: 'completed' },
        select: { treatmentCategory: true },
      });
      return new Set(sedute.map((s) => s.treatmentCategory || 'altro')).size;
    },
  },
  {
    codice: 'ambasciatrice',
    titolo: 'Revo Ambassador',
    descrizione: 'Porta un\'amica che diventa cliente',
    premioPunti: 250,
    badge: { codice: 'revo-ambassador', nome: 'Revo Ambassador' },
    target: 1,
    avanzamento: async (clientId) => {
      // Un'amica «arrivata» = una nuova cliente che indica questo id
      return prisma.client.count({ where: { referredBy: clientId } });
    },
  },
  {
    codice: 'percorso-finito',
    titolo: 'Fino in fondo',
    descrizione: 'Completa tutte le sedute di un pacchetto',
    premioPunti: 300,
    badge: { codice: 'laser-queen', nome: 'Regina del percorso' },
    target: 1,
    avanzamento: async (clientId) => {
      const finiti = await prisma.clientPackage.count({
        where: { clientId, usedSessions: { gte: prisma.clientPackage.fields.totalSessions } },
      });
      return finiti;
    },
  },
  {
    codice: 'habitue',
    titolo: 'Habituée',
    descrizione: 'Vieni a trovarci 3 volte in 60 giorni',
    premioPunti: 150,
    target: 3,
    avanzamento: async (clientId) => {
      const da = new Date(Date.now() - 60 * GIORNO).toISOString().slice(0, 10);
      return prisma.appointment.count({
        where: { clientId, status: 'completed', date: { gte: da, lte: oggiISO() } },
      });
    },
  },
];

export async function missioniDellaCliente(clientId: string): Promise<MissioneConStato[]> {
  const riscatti = await prisma.missionClaim.findMany({
    where: { clientId },
    select: { codice: true },
  });
  const riscattate = new Set(riscatti.map((r) => r.codice));

  const esiti: MissioneConStato[] = [];
  for (const m of MISSIONI) {
    const fatto = Math.min(await m.avanzamento(clientId), m.target);
    esiti.push({
      codice: m.codice,
      titolo: m.titolo,
      descrizione: m.descrizione,
      premioPunti: m.premioPunti,
      badge: m.badge ?? null,
      target: m.target,
      avanzamento: fatto,
      completata: fatto >= m.target,
      riscattata: riscattate.has(m.codice),
    });
  }
  // Prima le riscattabili, poi quelle in corso, in fondo le già prese
  return esiti.sort(
    (a, b) =>
      Number(a.riscattata) - Number(b.riscattata) ||
      Number(b.completata) - Number(a.completata) ||
      b.avanzamento / b.target - a.avanzamento / a.target
  );
}

export async function riscattaMissione(
  clientId: string,
  codice: string
): Promise<{ ok: true; punti: number } | { ok: false; errore: string; code: string }> {
  const def = MISSIONI.find((m) => m.codice === codice);
  if (!def) return { ok: false, errore: 'Missione non trovata.', code: 'NOT_FOUND' };

  const fatto = await def.avanzamento(clientId);
  if (fatto < def.target) {
    return { ok: false, errore: 'La missione non è ancora completata.', code: 'VALIDATION' };
  }

  // Il lucchetto: il vincolo unico fa sì che il premio parta una volta sola
  try {
    await prisma.missionClaim.create({
      data: { clientId, codice, puntiDati: def.premioPunti, riscattataAt: new Date().toISOString() },
    });
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2002') {
      return { ok: false, errore: 'Premio già riscattato.', code: 'NOT_CANCELLABLE' };
    }
    throw err;
  }

  await muoviPunti({
    clientId,
    punti: def.premioPunti,
    motivo: `Missione completata: ${def.titolo}`,
    sourceType: 'missione',
    sourceId: codice,
  });

  if (def.badge) {
    await prisma.clientBadge
      .create({
        data: {
          clientId,
          codice: def.badge.codice,
          nome: def.badge.nome,
          assegnatoAt: new Date().toISOString(),
        },
      })
      .catch(() => null); // già in bacheca: va benissimo
  }

  return { ok: true, punti: def.premioPunti };
}
