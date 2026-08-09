/**
 * Quanto rende l'app, funzione per funzione.
 *
 * La domanda a cui deve rispondere non è "quante prenotazioni sono arrivate"
 * ma "quali di queste cose valgono il tempo che costano". Per questo si guarda
 * la catena intera — **visto → toccato → prenotato → incassato** — e non solo
 * il risultato: una funzione che nessuno guarda e una che tutti guardano senza
 * usare vanno sistemate in due modi opposti.
 *
 * Il fatturato non viene stimato: si prende quello vero della cassa, agganciato
 * agli appuntamenti nati dall'app. Attribuire ricavi con moltiplicatori
 * inventati è il modo più rapido per farsi bocciare i numeri da chi li legge.
 */

import { prisma } from './prisma';

const GIORNO = 86400000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string | null | undefined) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

export interface ImbutoSuperficie {
  superficie: string;
  etichetta: string;
  viste: number;
  tocchi: number;
  prenotazioni: number;
  /** Su 100 che l'hanno vista, quante l'hanno toccata. */
  tassoTocco: number;
  /** Su 100 che l'hanno toccata, quante hanno prenotato. */
  tassoPrenotazione: number;
  valore: number;
}

export interface StatisticheApp {
  giorni: number;
  /** Clienti diverse che hanno usato l'app oggi e nel periodo. */
  attiviOggi: number;
  attiviPeriodo: number;
  /** Su quante clienti con un numero valido: quanta parte della rubrica usa l'app. */
  copertura: number;
  clientiTotali: number;
  conAccount: number;
  imbuto: ImbutoSuperficie[];
  prenotazioniApp: number;
  fatturatoApp: number;
  flash: { pubblicati: number; presi: number; scaduti: number; valore: number; tassoRiempimento: number };
  wallet: { creditoEmesso: number; creditoUsato: number; inCircolazione: number; inScadenza30: number };
  referral: { inviti: number; convertiti: number; creditoPagato: number };
  club: { nome: string; clienti: number; colore: string }[];
  sfide: { titolo: string; partecipanti: number; completate: number }[];
  /** Andamento giorno per giorno: aperture e prenotazioni. */
  andamento: { giorno: string; aperture: number; prenotazioni: number }[];
}

const ETICHETTE: Record<string, string> = {
  home: 'Home',
  per_te: 'Per te oggi',
  cosa_oggi: 'Cosa posso fare oggi',
  flash_slot: 'Flash Slot',
  referral: 'Porta un\'amica',
  challenge: 'Sfide',
  push: 'Notifiche',
  wallet: 'Wallet',
  box: 'Beauty Box',
  percorsi: 'Percorsi',
  prenota: 'Prenotazione',
  assistente: 'Assistente',
};

export async function leggiStatisticheApp(giorni = 30): Promise<StatisticheApp> {
  const da = new Date(Date.now() - giorni * GIORNO).toISOString();
  const oggi = new Date().toISOString().slice(0, 10);

  const [eventi, account, clienti, slot, movimenti, inviti, livelli, sfide] = await Promise.all([
    prisma.appEvent.findMany({ where: { createdAt: { gte: da } } }),
    prisma.mobileAccount.findMany({ select: { clientId: true, lastLoginAt: true } }),
    prisma.client.count(),
    prisma.flashSlot.findMany({ where: { createdAt: { gte: da } } }),
    prisma.loyaltyMovement.findMany({ where: { kind: 'credit' } }),
    prisma.referral.findMany(),
    prisma.clubLevel.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.challenge.findMany({ include: { progress: true } }),
  ]);

  // ---------- Imbuto per superficie ----------
  const perSuperficie = new Map<string, { viste: number; tocchi: number; prenotazioni: number; valore: number }>();
  for (const e of eventi) {
    const v = perSuperficie.get(e.surface) || { viste: 0, tocchi: 0, prenotazioni: 0, valore: 0 };
    if (e.type === 'view') v.viste++;
    else if (e.type === 'click') v.tocchi++;
    else if (e.type === 'booking') { v.prenotazioni++; v.valore += e.value ?? 0; }
    perSuperficie.set(e.surface, v);
  }

  const imbuto: ImbutoSuperficie[] = [...perSuperficie.entries()]
    .map(([superficie, v]) => ({
      superficie,
      etichetta: ETICHETTE[superficie] ?? superficie,
      viste: v.viste,
      tocchi: v.tocchi,
      prenotazioni: v.prenotazioni,
      tassoTocco: v.viste ? Math.round((v.tocchi / v.viste) * 100) : 0,
      tassoPrenotazione: v.tocchi ? Math.round((v.prenotazioni / v.tocchi) * 100) : 0,
      valore: round2(v.valore),
    }))
    .sort((a, b) => b.prenotazioni - a.prenotazioni || b.viste - a.viste);

  // ---------- Clienti attive ----------
  const giornoDi = (iso: string) => iso.slice(0, 10);
  const attiviOggi = new Set(eventi.filter(e => giornoDi(e.createdAt) === oggi && e.clientId).map(e => e.clientId!)).size;
  const attiviPeriodo = new Set(eventi.filter(e => e.clientId).map(e => e.clientId!)).size;

  // ---------- Fatturato vero degli appuntamenti nati dall'app ----------
  const idPrenotazioni = eventi.filter(e => e.type === 'booking' && e.itemId).map(e => e.itemId!);
  const appuntamentiApp = idPrenotazioni.length
    ? await prisma.appointment.findMany({
        where: { id: { in: idPrenotazioni } },
        select: { clientName: true, date: true, status: true, price: true },
      })
    : [];

  // L'incasso si riconosce sulla cassa: stesso nome, stesso giorno. È il
  // legame più stretto disponibile senza toccare la struttura della cassa.
  const svolti = appuntamentiApp.filter(a => a.status === 'completed');
  let fatturatoApp = 0;
  if (svolti.length) {
    const incassi = await prisma.posTransaction.findMany({
      where: { isRefund: false, total: { gt: 0 }, date: { in: [...new Set(svolti.map(a => a.date))] } },
      select: { clientName: true, date: true, total: true },
    });
    for (const a of svolti) {
      const trovato = incassi.find(t => t.date === a.date && norm(t.clientName) === norm(a.clientName));
      fatturatoApp += trovato ? trovato.total : 0;
    }
  }

  // ---------- Flash Slot ----------
  const presi = slot.filter(s => s.status === 'taken');
  const flash = {
    pubblicati: slot.length,
    presi: presi.length,
    scaduti: slot.filter(s => s.status === 'expired').length,
    valore: round2(presi.reduce((s, x) => s + x.price, 0)),
    tassoRiempimento: slot.length ? Math.round((presi.length / slot.length) * 100) : 0,
  };

  // ---------- Wallet ----------
  const entrate = movimenti.filter(m => m.amount > 0);
  const fra30 = new Date(Date.now() + 30 * GIORNO).toISOString();
  const adesso = new Date().toISOString();
  const wallet = {
    creditoEmesso: round2(entrate.reduce((s, m) => s + m.amount, 0)),
    creditoUsato: round2(movimenti.filter(m => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0)),
    inCircolazione: round2(
      entrate.filter(m => !m.expiresAt || m.expiresAt > adesso).reduce((s, m) => s + (m.amount - m.consumed), 0)
    ),
    inScadenza30: round2(
      entrate
        .filter(m => m.expiresAt && m.expiresAt > adesso && m.expiresAt <= fra30)
        .reduce((s, m) => s + (m.amount - m.consumed), 0)
    ),
  };

  // ---------- Referral ----------
  const creditoReferral = movimenti.filter(m => m.sourceType === 'referral' && m.amount > 0);
  const referral = {
    inviti: inviti.length,
    convertiti: inviti.filter(r => r.status === 'converted').length,
    creditoPagato: round2(creditoReferral.reduce((s, m) => s + m.amount, 0)),
  };

  // ---------- Distribuzione per livello ----------
  // Si conta sull'ultimo livello raggiunto secondo la spesa registrata in cassa
  const spese = await prisma.posTransaction.findMany({
    where: { isRefund: false, total: { gt: 0 } },
    select: { clientName: true, total: true },
  });
  const perNome = new Map<string, number>();
  for (const t of spese) {
    const n = norm(t.clientName);
    if (n) perNome.set(n, (perNome.get(n) || 0) + t.total);
  }
  const club = livelli.map(l => ({
    nome: l.name,
    colore: l.color,
    clienti: [...perNome.values()].filter(spesa => {
      const superiori = livelli.filter(x => x.sortOrder > l.sortOrder);
      return spesa >= l.minSpent && !superiori.some(x => spesa >= x.minSpent);
    }).length,
  }));

  // ---------- Sfide ----------
  const sfideRighe = sfide.map(s => ({
    titolo: s.title,
    partecipanti: s.progress.length,
    completate: s.progress.filter(p => p.completedAt).length,
  }));

  // ---------- Andamento giornaliero ----------
  const perGiorno = new Map<string, { aperture: Set<string>; prenotazioni: number }>();
  for (let i = giorni - 1; i >= 0; i--) {
    const g = new Date(Date.now() - i * GIORNO).toISOString().slice(0, 10);
    perGiorno.set(g, { aperture: new Set(), prenotazioni: 0 });
  }
  for (const e of eventi) {
    const slot = perGiorno.get(giornoDi(e.createdAt));
    if (!slot) continue;
    if (e.clientId) slot.aperture.add(e.clientId);
    if (e.type === 'booking') slot.prenotazioni++;
  }

  return {
    giorni,
    attiviOggi,
    attiviPeriodo,
    clientiTotali: clienti,
    conAccount: account.length,
    copertura: clienti ? Math.round((account.length / clienti) * 100) : 0,
    imbuto,
    prenotazioniApp: eventi.filter(e => e.type === 'booking').length,
    fatturatoApp: round2(fatturatoApp),
    flash,
    wallet,
    referral,
    club,
    sfide: sfideRighe,
    andamento: [...perGiorno.entries()].map(([giorno, v]) => ({
      giorno,
      aperture: v.aperture.size,
      prenotazioni: v.prenotazioni,
    })),
  };
}
