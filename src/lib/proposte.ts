/**
 * "Per te oggi" e "Cosa posso fare oggi": il motore delle proposte.
 *
 * Nessuna offerta a caso. Ogni proposta nasce da un fatto vero della cliente —
 * un credito che sta per scadere, sedute pagate e mai usate, il suo trattamento
 * abituale in ritardo rispetto al ritmo che tiene di solito — e porta a
 * un'azione che si può fare davvero adesso.
 *
 * Le due regole che tengono in piedi la cosa:
 *  1. **niente proposte finte**: se non c'è niente di utile da dire, si dice
 *     poco. Una schermata piena di offerte inventate viene aperta due volte e
 *     poi mai più;
 *  2. **ordine per urgenza reale**: prima quello che si perde (credito e premi
 *     in scadenza), poi quello che è già stato pagato (sedute residue), poi le
 *     occasioni (Flash Slot), infine gli inviti a tornare.
 */

import { prisma } from './prisma';
import { saldoWallet } from './wallet';
import { livelloCliente } from './club';
import { leggiConfig, type ConfigApp } from './appSettings';

export type AzioneProposta =
  | { tipo: 'prenota'; treatmentId?: string; label: string }
  | { tipo: 'flash'; slotId: string; label: string }
  | { tipo: 'wallet'; label: string }
  | { tipo: 'premio'; winId: string; label: string }
  | { tipo: 'percorso'; packageId: string; label: string }
  | { tipo: 'club'; label: string }
  | { tipo: 'referral'; label: string }
  | { tipo: 'challenge'; challengeId: string; label: string };

export interface Proposta {
  id: string;
  /** Che genere di occasione è: serve all'app per icona e colore. */
  tipo: 'scadenza' | 'premio' | 'percorso' | 'flash' | 'ritorno' | 'club' | 'challenge' | 'compleanno' | 'referral';
  icona: string;
  titolo: string;
  sottotitolo: string;
  /** Più è alta, più sta in cima. Calcolata, non scritta a mano. */
  priorita: number;
  azione: AzioneProposta;
}

const GIORNO = 86400000;
const oggiISO = () => new Date().toISOString().slice(0, 10);
const eur = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('it-IT', { maximumFractionDigits: 2 })} €`;
const giorniDa = (data: string) => Math.floor((Date.now() - Date.parse(data)) / GIORNO);

/**
 * Ogni quanto torna di solito questa cliente per questo trattamento.
 * Sotto le tre visite non si parla di abitudine: due date fanno una riga, non
 * una tendenza, e proporre un ritorno sulla base di due appuntamenti è il modo
 * migliore per sembrare invadenti.
 */
function cadenzaAbituale(date: string[]): number | null {
  if (date.length < 3) return null;
  const ordinate = [...new Set(date)].sort();
  if (ordinate.length < 3) return null;
  let somma = 0;
  for (let i = 1; i < ordinate.length; i++) {
    somma += (Date.parse(ordinate[i]) - Date.parse(ordinate[i - 1])) / GIORNO;
  }
  const media = somma / (ordinate.length - 1);
  // Sotto la settimana non è un'abitudine: è un pacchetto consumato a raffica
  // (tre sedute laser in cinque giorni). Prenderlo per ritmo significherebbe
  // scrivere "sei in ritardo" a chi è venuta l'altro ieri. Sopra i sei mesi,
  // al contrario, non è una cadenza ma un caso.
  return media >= 7 && media < 180 ? Math.round(media) : null;
}

export interface ContestoCliente {
  clientId: string;
  nome: string;
  config: ConfigApp;
}

export async function generaProposte(ctx: ContestoCliente): Promise<Proposta[]> {
  const { clientId, config } = ctx;
  const oggi = oggiISO();
  const proposte: Proposta[] = [];

  const [cliente, appuntamenti, pacchetti, premi, sfide, flash] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { birthDate: true } }),
    prisma.appointment.findMany({
      where: { clientId },
      select: { id: true, date: true, startTime: true, status: true, treatmentId: true, treatmentName: true, operatorName: true },
      orderBy: { date: 'asc' },
    }),
    config.funzioni.percorsi
      ? prisma.clientPackage.findMany({
          where: { clientId, status: 'active' },
          select: { id: true, packageName: true, totalSessions: true, usedSessions: true, expiryDate: true, history: true },
        })
      : Promise.resolve([]),
    config.funzioni.beautyBox
      ? prisma.prizeWin.findMany({ where: { clientId, usedAt: null }, include: { prize: true } })
      : Promise.resolve([]),
    config.funzioni.challenge
      ? prisma.challenge.findMany({
          where: { isActive: true, startsAt: { lte: oggi }, endsAt: { gte: oggi } },
          include: { progress: { where: { clientId } } },
        })
      : Promise.resolve([]),
    config.funzioni.flashSlot
      ? prisma.flashSlot.findMany({
          where: { status: 'open', date: { gte: oggi }, expiresAt: { gt: new Date().toISOString() } },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  // ---------- 1. Credito in scadenza: è la cosa che si perde davvero ----------
  if (config.funzioni.wallet) {
    const wallet = await saldoWallet(clientId);
    if (wallet.inScadenza.importo > 0 && wallet.inScadenza.giorni !== null) {
      const g = wallet.inScadenza.giorni;
      proposte.push({
        id: 'credito-scadenza',
        tipo: 'scadenza',
        icona: '💰',
        titolo: `${eur(wallet.inScadenza.importo)} in scadenza`,
        sottotitolo: g === 0 ? 'Scadono oggi: usali prima di stasera.'
          : g === 1 ? 'Scadono domani.'
          : `Scadono fra ${g} giorni.`,
        // Più è vicina la scadenza più sale, ma resta sempre in cima al resto
        priorita: 1000 - Math.min(g, 30) * 5,
        azione: { tipo: 'prenota', label: 'Usa il credito' },
      });
    }
  }

  // ---------- 2. Premi vinti e mai usati ----------
  for (const p of premi) {
    const giorniAllaScadenza = Math.ceil((Date.parse(p.expiresAt) - Date.now()) / GIORNO);
    if (giorniAllaScadenza < 0) continue;
    proposte.push({
      id: `premio-${p.id}`,
      tipo: 'premio',
      icona: '🎁',
      titolo: p.openedAt ? `Premio da usare: ${p.prize.name}` : 'Hai una Beauty Box da aprire',
      sottotitolo: giorniAllaScadenza === 0 ? 'Scade oggi.' : `Ancora ${giorniAllaScadenza} giorni per usarlo.`,
      priorita: 900 - Math.min(giorniAllaScadenza, 30),
      azione: { tipo: 'premio', winId: p.id, label: p.openedAt ? 'Usa il premio' : 'Apri la Beauty Box' },
    });
  }

  // ---------- 3. Sedute già pagate e non usate ----------
  const completati = appuntamenti.filter(a => a.status === 'completed');
  for (const pk of pacchetti) {
    const residue = pk.totalSessions - pk.usedSessions;
    if (residue <= 0) continue;

    const storico = Array.isArray(pk.history) ? (pk.history as { date?: string }[]) : [];
    const ultima = storico.map(h => h.date).filter(Boolean).sort().pop() as string | undefined;
    const giorniFermo = ultima ? giorniDa(ultima) : null;

    // Un pacchetto in scadenza con sedute dentro è la cosa più urgente dopo il
    // credito: sono soldi già incassati che rischiano di diventare un reclamo.
    const giorniAScadenza = pk.expiryDate
      ? Math.ceil((Date.parse(pk.expiryDate) - Date.now()) / GIORNO)
      : null;
    const inScadenza = giorniAScadenza !== null && giorniAScadenza <= 45 && giorniAScadenza >= 0;

    proposte.push({
      id: `percorso-${pk.id}`,
      tipo: 'percorso',
      icona: '📦',
      titolo: `${residue} sedut${residue === 1 ? 'a' : 'e'} da fare · ${pk.packageName}`,
      sottotitolo: inScadenza
        ? `Il pacchetto scade fra ${giorniAScadenza} giorni.`
        : giorniFermo !== null
          ? `Ultima seduta ${giorniFermo} giorni fa.`
          : 'Non hai ancora iniziato il percorso.',
      priorita: inScadenza ? 850 - giorniAScadenza! : 500 + Math.min(giorniFermo ?? 0, 90),
      azione: { tipo: 'percorso', packageId: pk.id, label: 'Prenota la prossima' },
    });
  }

  // ---------- 4. Flash Slot ----------
  const livello = config.funzioni.club ? await livelloCliente(clientId) : null;
  const ordineLivello = livello?.attuale?.sortOrder ?? 0;
  for (const s of flash) {
    // Gli slot riservati ai livelli alti restano nascosti a chi non c'è ancora
    if (s.minLevelOrder > ordineLivello) continue;
    const quando = s.date === oggi ? `oggi alle ${s.startTime}` : `${new Date(s.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle ${s.startTime}`;
    const sconto = s.fullPrice > s.price ? ` · ${eur(s.fullPrice)} → ${eur(s.price)}` : '';
    proposte.push({
      id: `flash-${s.id}`,
      tipo: 'flash',
      icona: '⚡',
      titolo: `Si è liberato ${quando}`,
      sottotitolo: `${s.treatmentName} con ${s.operatorName}${sconto}`,
      priorita: s.date === oggi ? 800 : 700,
      azione: { tipo: 'flash', slotId: s.id, label: 'Prenota ora' },
    });
  }

  // ---------- 5. Il suo trattamento abituale è in ritardo ----------
  const prossimi = appuntamenti.filter(a => a.date >= oggi && a.status !== 'cancelled' && a.status !== 'completed');
  const perTrattamento = new Map<string, { nome: string; date: string[]; treatmentId: string }>();
  for (const a of completati) {
    const v = perTrattamento.get(a.treatmentName) || { nome: a.treatmentName, date: [], treatmentId: a.treatmentId };
    v.date.push(a.date);
    perTrattamento.set(a.treatmentName, v);
  }

  for (const t of perTrattamento.values()) {
    const cadenza = cadenzaAbituale(t.date);
    if (!cadenza) continue;
    const ultima = [...t.date].sort().pop()!;
    const passati = giorniDa(ultima);
    // Si parla solo se è davvero in ritardo, non appena scade il termine
    if (passati < cadenza * 1.15) continue;
    // Se ha già preso appuntamento per quel trattamento, non si insiste
    if (prossimi.some(p => p.treatmentName === t.nome)) continue;

    proposte.push({
      id: `ritorno-${t.treatmentId}`,
      tipo: 'ritorno',
      icona: '🕐',
      titolo: `Sono passati ${passati} giorni dall'ultimo ${t.nome.toLowerCase()}`,
      sottotitolo: `Di solito torni ogni ${cadenza} giorni.`,
      priorita: 400 + Math.min(passati - cadenza, 60),
      azione: { tipo: 'prenota', treatmentId: t.treatmentId, label: 'Prenota' },
    });
  }

  // ---------- 6. Challenge quasi finite ----------
  for (const c of sfide) {
    const p = c.progress[0];
    const fatto = p?.count ?? 0;
    if (p?.completedAt) continue;
    const manca = c.goalCount - fatto;
    if (manca <= 0) continue;
    // Se ne parla solo quando il traguardo è a portata: a un terzo del percorso
    // il messaggio è solo rumore.
    if (fatto / c.goalCount < 0.5) continue;
    proposte.push({
      id: `sfida-${c.id}`,
      tipo: 'challenge',
      icona: '🏆',
      titolo: c.title,
      sottotitolo: `Ti manca ${manca === 1 ? '1 passo' : `${manca} passi`} per ${c.rewardLabel.toLowerCase()}.`,
      priorita: 350 + Math.round((fatto / c.goalCount) * 50),
      azione: { tipo: 'challenge', challengeId: c.id, label: 'Vedi la sfida' },
    });
  }

  // ---------- 7. Vicina al livello successivo ----------
  if (livello?.prossimo && livello.avanzamento >= 60 && livello.prossimo.mancaSpesa > 0) {
    proposte.push({
      id: 'club-prossimo',
      tipo: 'club',
      icona: '⭐',
      titolo: `Ti mancano ${eur(livello.prossimo.mancaSpesa)} per diventare ${livello.prossimo.name}`,
      sottotitolo: `Sei al ${livello.avanzamento}% del percorso.`,
      priorita: 300 + livello.avanzamento,
      azione: { tipo: 'club', label: 'Scopri i vantaggi' },
    });
  }

  // ---------- 8. Compleanno nel mese ----------
  if (cliente?.birthDate) {
    const mese = cliente.birthDate.slice(5, 7);
    const giorno = cliente.birthDate.slice(8, 10);
    if (mese === oggi.slice(5, 7)) {
      const suo = `${oggi.slice(0, 4)}-${mese}-${giorno}`;
      const mancano = Math.ceil((Date.parse(suo) - Date.now()) / GIORNO);
      proposte.push({
        id: 'compleanno',
        tipo: 'compleanno',
        icona: '🎂',
        titolo: mancano === 0 ? 'Buon compleanno!' : mancano > 0 ? `Il tuo compleanno è fra ${mancano} giorni` : 'Buon compleanno (in ritardo)!',
        sottotitolo: 'Questo mese hai un pensiero da parte nostra.',
        priorita: 320,
        azione: { tipo: 'prenota', label: 'Festeggia da noi' },
      });
    }
  }

  // ---------- 9. Nessun appuntamento in programma ----------
  // Non a chi è appena stata in negozio: le si direbbe "non hai appuntamenti"
  // il giorno dopo che ci è venuta, che suona come non essersene accorti.
  const ultimaVisitaGlobale = completati.map(a => a.date).sort().pop();
  const appenaVenuta = !!ultimaVisitaGlobale && giorniDa(ultimaVisitaGlobale) < 7;
  if (!prossimi.length && !appenaVenuta) {
    const ultimaVisita = ultimaVisitaGlobale;
    proposte.push({
      id: 'nessun-appuntamento',
      tipo: 'ritorno',
      icona: '📅',
      titolo: 'Non hai appuntamenti in programma',
      sottotitolo: ultimaVisita
        ? `L'ultima volta sei venuta ${giorniDa(ultimaVisita)} giorni fa.`
        : 'Prenota il tuo primo trattamento.',
      priorita: 200,
      azione: { tipo: 'prenota', label: 'Prenota ora' },
    });
  }

  // ---------- 10. Invita un'amica ----------
  if (config.funzioni.referral && completati.length >= 2) {
    const gia = await prisma.referral.count({ where: { inviterClientId: clientId } });
    if (gia === 0) {
      proposte.push({
        id: 'referral',
        tipo: 'referral',
        icona: '👭',
        titolo: 'Porta un\'amica',
        sottotitolo: `${eur(config.referral.premioInvitante)} di credito per te e ${eur(config.referral.premioInvitata)} per lei.`,
        priorita: 150,
        azione: { tipo: 'referral', label: 'Invita' },
      });
    }
  }

  return proposte.sort((a, b) => b.priorita - a.priorita);
}
