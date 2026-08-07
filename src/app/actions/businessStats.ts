'use server';

import { prisma } from '@/lib/prisma';

const norm = (s: string | null | undefined) =>
  (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

// ============================================================
// FUNNEL INAUGURAZIONE
// Quante clienti dell'inaugurazione sono venute (omaggio scalato) e quante
// sono TORNATE come paganti (upsell dopo la seduta gratis).
// ============================================================
export interface InaugurationStats {
  totalLeads: number;        // contatti raccolti all'inaugurazione
  inClients: number;         // entrati in anagrafica
  withGift: number;          // con pacchetto omaggio assegnato
  came: number;              // omaggio effettivamente scalato (sono venute)
  booked: number;            // omaggio non ancora usato
  bookedGift: number;        // ha già fissato l'appuntamento per l'omaggio
  returnedPaying: number;    // tornate per un servizio a pagamento DOPO l'omaggio
  boughtPackage: number;     // hanno acquistato un PACCHETTO a pagamento dopo l'omaggio
  conversionRate: number;    // % venute -> tornate paganti
  showRate: number;          // % con omaggio -> venute
  packageRate: number;       // % venute -> hanno comprato un pacchetto
  revenueAfter: number;      // fatturato generato dopo l'omaggio
  avgValuePerGift: number;   // fatturato medio per omaggio usato
  avgDaysToPurchase: number; // giorni medi tra omaggio e primo acquisto
}

export async function getInaugurationStats(): Promise<InaugurationStats> {
  // Una query per volta: in parallelo, sommate a quelle delle altre statistiche
  // aperte nella stessa pagina, saturano il pool di connessioni Prisma e tutto
  // muore con "connection pool timeout".
  const totalLeads = await prisma.inaugurationLead.count();
  const leadRows = await prisma.inaugurationLead.findMany({ select: { phone: true, email: true } });
  const allClients = await prisma.client.findMany({ select: { id: true, firstName: true, lastName: true, phone: true, email: true, tags: true } });
  const allPkgs = await prisma.clientPackage.findMany({ select: { clientId: true, usedSessions: true, pricePaid: true, purchaseDate: true, history: true } });
  const transactions = await prisma.posTransaction.findMany({ where: { total: { gt: 0 }, isRefund: false }, select: { clientName: true, total: true, date: true } });
  const appts = await prisma.appointment.findMany({ where: { status: { not: 'cancelled' } }, select: { clientId: true, date: true, status: true } });

  // --- Chi sono le clienti dell'inaugurazione ---
  // Dal COUPON al cliente: telefono prima, email come ripiego (le email
  // condivise in famiglia agganciano la persona sbagliata). In più chi porta
  // l'etichetta 'Inaugurazione': così chi è stato creato a mano senza etichetta
  // ma con un coupon suo non sparisce dal funnel (successo davvero).
  const tail = (p: string | null | undefined) => (p || '').replace(/\D/g, '').slice(-9);
  const inaugIds = new Set<string>();
  for (const c of allClients) {
    if ((c.tags || []).some(t => t.toLowerCase() === 'inaugurazione')) inaugIds.add(c.id);
  }
  for (const l of leadRows) {
    const c = (tail(l.phone) && allClients.find(x => tail(x.phone) === tail(l.phone)))
      || (l.email && allClients.find(x => (x.email || '').toLowerCase() === l.email!.toLowerCase()))
      || null;
    if (c) inaugIds.add(c.id);
  }
  const nameById = new Map(allClients.filter(c => inaugIds.has(c.id)).map(c => [c.id, norm(`${c.firstName} ${c.lastName}`)]));

  // --- Omaggi (pacchetti a 0€) delle clienti inaugurazione ---
  const gifts = allPkgs.filter(g => g.pricePaid === 0 && g.clientId && inaugIds.has(g.clientId));
  const withGift = new Set(gifts.map(g => g.clientId)).size;

  // --- Sono venute = omaggio scalato OPPURE almeno un appuntamento completato.
  // Guardare solo lo scalo del pacchetto sottostimava: nei giorni storti
  // diversi check-out non hanno scalato l'omaggio, ma la cliente era in negozio.
  const completatiPerCliente = new Map<string, string[]>();
  for (const a of appts) {
    if (a.status !== 'completed' || !inaugIds.has(a.clientId)) continue;
    const arr = completatiPerCliente.get(a.clientId) || [];
    arr.push(a.date);
    completatiPerCliente.set(a.clientId, arr);
  }

  const visitDate = new Map<string, string>(); // clientId -> giorno della prima visita
  for (const g of gifts) {
    if (g.usedSessions < 1 || !g.clientId) continue;
    const hist = Array.isArray(g.history) ? (g.history as { date?: string }[]) : [];
    const d = hist.map(h => h.date).filter(Boolean).sort()[0] || g.purchaseDate;
    if (d) visitDate.set(g.clientId, d);
  }
  for (const [clientId, date] of completatiPerCliente) {
    const prima = [...date].sort()[0];
    const attuale = visitDate.get(clientId);
    if (!attuale || prima < attuale) visitDate.set(clientId, prima);
  }
  const came = visitDate.size;

  // Chi ha l'omaggio, non è ancora venuta, ma ha già fissato un appuntamento
  const giftClientIds = new Set(gifts.map(g => g.clientId as string));
  const pendingIds = [...giftClientIds].filter(id => !visitDate.has(id));
  const apptByClient = new Set(appts.map(a => a.clientId));
  const bookedGift = pendingIds.filter(id => apptByClient.has(id)).length;

  // --- Cosa hanno speso, dalla prima visita in poi (giorno stesso compreso:
  // la crema comprata uscendo dalla seduta omaggio È la conversione).
  // Il fatturato si conta SOLO dalla cassa: anche i pacchetti passano da lì,
  // sommare pure ClientPackage.totalPaid contava i soldi due volte.
  const returnedIds = new Set<string>();
  const packageIds = new Set<string>();
  let revenueAfter = 0;
  const daysToPurchase: number[] = [];

  for (const [clientId, giorno] of visitDate) {
    const fullName = nameById.get(clientId) || '';
    let firstPurchase: string | null = null;

    // Pacchetti a pagamento acquistati dalla visita in poi
    for (const pkg of allPkgs) {
      if (pkg.clientId !== clientId || pkg.pricePaid <= 0) continue;
      if (pkg.purchaseDate && pkg.purchaseDate >= giorno) {
        packageIds.add(clientId);
        returnedIds.add(clientId);
        if (!firstPurchase || pkg.purchaseDate < firstPurchase) firstPurchase = pkg.purchaseDate;
      }
    }

    // Incassi in cassa a suo nome dalla visita in poi
    for (const t of transactions) {
      if (!fullName || norm(t.clientName) !== fullName) continue;
      if (t.date >= giorno) {
        returnedIds.add(clientId);
        revenueAfter += t.total;
        if (!firstPurchase || t.date < firstPurchase) firstPurchase = t.date;
      }
    }

    if (firstPurchase) {
      const d = Math.round((Date.parse(firstPurchase) - Date.parse(giorno)) / 86400000);
      if (d >= 0 && d < 400) daysToPurchase.push(d);
    }
  }

  const returnedPaying = returnedIds.size;
  const boughtPackage = packageIds.size;
  revenueAfter = Math.round(revenueAfter * 100) / 100;

  return {
    totalLeads,
    inClients: inaugIds.size,
    withGift,
    came,
    booked: withGift - came,
    bookedGift,
    returnedPaying,
    boughtPackage,
    conversionRate: came > 0 ? Math.round((returnedPaying / came) * 100) : 0,
    showRate: withGift > 0 ? Math.round((came / withGift) * 100) : 0,
    packageRate: came > 0 ? Math.round((boughtPackage / came) * 100) : 0,
    revenueAfter,
    avgValuePerGift: came > 0 ? Math.round((revenueAfter / came) * 100) / 100 : 0,
    avgDaysToPurchase: daysToPurchase.length ? Math.round(daysToPurchase.reduce((a, b) => a + b, 0) / daysToPurchase.length) : 0,
  };
}

// ============================================================
// VALORE REALE DEL CLIENTE
// Aggrega incassi cassa (per nome) + pagamenti pacchetti (per nome) e conta
// le visite dagli appuntamenti completati.
// ============================================================
export interface ClientValue {
  totalSpent: number;
  visits: number;
  avgTicket: number;
  firstVisit: string | null;
  lastVisit: string | null;
  daysSinceLastVisit: number | null;
  avgDaysBetweenVisits: number | null;
  monthlyAvg: number; // spesa media al mese da quando è cliente
}

export async function getClientValue(clientId: string): Promise<ClientValue> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { firstName: true, lastName: true, createdAt: true },
  });
  if (!client) {
    return { totalSpent: 0, visits: 0, avgTicket: 0, firstVisit: null, lastVisit: null, daysSinceLastVisit: null, avgDaysBetweenVisits: null, monthlyAvg: 0 };
  }
  const fullName = norm(`${client.firstName} ${client.lastName}`);

  const appts = await prisma.appointment.findMany({ where: { clientId, status: 'completed' }, select: { date: true, price: true } });
  const transactions = await prisma.posTransaction.findMany({ select: { clientName: true, total: true, date: true } });
  const packages = await prisma.clientPackage.findMany({ where: { clientId }, select: { payments: true } });

  // Incasso cassa a nome del cliente (solo importi positivi)
  const posTotal = transactions
    .filter(t => norm(t.clientName) === fullName && t.total > 0)
    .reduce((s, t) => s + t.total, 0);

  // Pagamenti pacchetti
  let pkgTotal = 0;
  for (const p of packages) {
    const pays = Array.isArray(p.payments) ? (p.payments as { amount?: number }[]) : [];
    pkgTotal += pays.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  }

  const totalSpent = Math.round((posTotal + pkgTotal) * 100) / 100;

  // Visite = appuntamenti completati (date distinte)
  const visitDates = [...new Set(appts.map(a => a.date).filter(Boolean))].sort();
  const visits = visitDates.length;

  const firstVisit = visitDates[0] || null;
  const lastVisit = visitDates[visitDates.length - 1] || null;

  const dayMs = 86400000;
  const daysSinceLastVisit = lastVisit ? Math.floor((Date.now() - Date.parse(lastVisit)) / dayMs) : null;

  let avgDaysBetweenVisits: number | null = null;
  if (visitDates.length >= 2) {
    let sum = 0;
    for (let i = 1; i < visitDates.length; i++) sum += (Date.parse(visitDates[i]) - Date.parse(visitDates[i - 1])) / dayMs;
    avgDaysBetweenVisits = Math.round(sum / (visitDates.length - 1));
  }

  const monthsAsClient = Math.max(1, (Date.now() - Date.parse(client.createdAt || firstVisit || new Date().toISOString())) / (dayMs * 30));
  const monthlyAvg = Math.round(totalSpent / monthsAsClient);

  return {
    totalSpent,
    visits,
    avgTicket: visits > 0 ? Math.round(totalSpent / visits) : 0,
    firstVisit,
    lastVisit,
    daysSinceLastVisit,
    avgDaysBetweenVisits,
    monthlyAvg,
  };
}

// ============================================================
// CRUSCOTTO KPI — tutti calcolati sui dati reali del database.
// Ogni KPI ha valore + spiegazione, così si capisce cosa significa.
// ============================================================
export interface Kpi {
  key: string;
  label: string;
  value: string;
  hint: string;          // spiegazione/legenda
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  sub?: string;
}
export interface KpiGroup { title: string; icon: string; kpis: Kpi[] }

const eur = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
const pct = (n: number) => `${Math.round(n)}%`;

export async function getBusinessKPIs(): Promise<KpiGroup[]> {
  const dayMs = 86400000;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const yearStart = today.slice(0, 4) + '-01-01';
  const d = new Date(today);
  const prevMonthEnd = new Date(Date.parse(monthStart) - dayMs).toISOString().slice(0, 10);
  const prevMonthStart = prevMonthEnd.slice(0, 8) + '01';
  const weekStart = new Date(Date.parse(today) - ((d.getDay() + 6) % 7) * dayMs).toISOString().slice(0, 10);

  // Anche qui una alla volta, per lo stesso motivo: questa funzione da sola
  // aprirebbe otto connessioni, e getInaugurationStats ne vuole altre sei.
  const clients = await prisma.client.findMany({ select: { id: true, firstName: true, lastName: true, createdAt: true, birthDate: true, marketingConsent: true } });
  const appts = await prisma.appointment.findMany({ select: { clientId: true, date: true, price: true, status: true, operatorName: true, treatmentName: true, checkInAt: true, checkOutAt: true, duration: true, startTime: true, createdAt: true } });
  const txs = await prisma.posTransaction.findMany({ select: { clientName: true, total: true, date: true, paymentMethod: true, isRefund: true, productLines: true } });
  const pkgs = await prisma.clientPackage.findMany({ select: { clientId: true, pricePaid: true, totalPaid: true, remainingBalance: true, usedSessions: true, totalSessions: true, status: true, expiryDate: true } });
  const operators = await prisma.operator.findMany({ where: { isResource: false }, select: { firstName: true, lastName: true, monthlyCost: true, contractHours: true } });
  const products = await prisma.product.findMany({ where: { isActive: true }, select: { name: true, price: true, costPrice: true, stock: true, minStock: true } });
  const giftCards = await prisma.giftCard.findMany({ select: { amount: true, status: true } });
  const inaug = await getInaugurationStats();

  const top = (arr: string[]) => {
    const m = new Map<string, number>();
    arr.forEach(x => { if (x) m.set(x, (m.get(x) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  };

  // ================= INCASSI =================
  const income = txs.filter(t => !t.isRefund && t.total > 0);
  const sum = (a: typeof income) => a.reduce((s, t) => s + t.total, 0);
  const revTotal = sum(income);
  const revMonth = sum(income.filter(t => t.date >= monthStart));
  const revPrevMonth = sum(income.filter(t => t.date >= prevMonthStart && t.date <= prevMonthEnd));
  const revWeek = sum(income.filter(t => t.date >= weekStart));
  const revYear = sum(income.filter(t => t.date >= yearStart));
  const revToday = sum(income.filter(t => t.date === today));
  const refunds = txs.filter(t => t.isRefund || t.total < 0).reduce((s, t) => s + Math.abs(t.total), 0);
  const avgTicket = income.length ? revTotal / income.length : 0;
  const cash = sum(income.filter(t => /contant|cash/i.test(t.paymentMethod)));
  const cashShare = revTotal > 0 ? (cash / revTotal) * 100 : 0;
  const growth = revPrevMonth > 0 ? ((revMonth - revPrevMonth) / revPrevMonth) * 100 : null;

  const byDay = new Map<string, number>();
  income.forEach(t => byDay.set(t.date, (byDay.get(t.date) || 0) + t.total));
  const workedDays = byDay.size;
  const bestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const dailyAvg = workedDays ? revTotal / workedDays : 0;

  // incasso da prodotti (dalle righe prodotto delle vendite)
  const priceByName = new Map(products.map(p => [p.name, p.price]));
  void priceByName;
  const productUnits = txs.reduce((s, t) => {
    const lines = Array.isArray(t.productLines) ? (t.productLines as { qty?: number }[]) : [];
    return s + lines.reduce((x, l) => x + (Number(l.qty) || 0), 0);
  }, 0);

  // incasso atteso: appuntamenti futuri confermati
  const upcoming = appts.filter(a => a.date >= today && (a.status === 'confirmed' || a.status === 'pending'));
  const expected = upcoming.reduce((s, a) => s + (a.price || 0), 0);

  // ================= CLIENTI =================
  const visitsByClient = new Map<string, Set<string>>();
  for (const a of appts) {
    if (a.status !== 'completed' || !a.clientId) continue;
    const set = visitsByClient.get(a.clientId) || new Set<string>();
    set.add(a.date); visitsByClient.set(a.clientId, set);
  }
  const withVisits = [...visitsByClient.entries()];
  const returning = withVisits.filter(([, s]) => s.size > 1).length;
  const oneShot = withVisits.filter(([, s]) => s.size === 1).length;
  const returnRate = withVisits.length ? (returning / withVisits.length) * 100 : 0;
  const neverCame = clients.length - withVisits.length;

  const lastVisit = new Map<string, number>();
  withVisits.forEach(([cid, s]) => lastVisit.set(cid, Math.max(...[...s].map(x => Date.parse(x)))));
  const active60 = [...lastVisit.values()].filter(t => (Date.now() - t) / dayMs <= 60).length;
  const inactive90 = [...lastVisit.values()].filter(t => (Date.now() - t) / dayMs > 90).length;
  const newMonth = clients.filter(c => (c.createdAt || '') >= monthStart).length;
  const contactable = clients.filter(c => c.marketingConsent).length;

  let gapSum = 0, gapN = 0;
  withVisits.forEach(([, s]) => {
    const ds = [...s].sort();
    for (let i = 1; i < ds.length; i++) { gapSum += (Date.parse(ds[i]) - Date.parse(ds[i - 1])) / dayMs; gapN++; }
  });
  const avgGap = gapN ? Math.round(gapSum / gapN) : 0;

  const spendByName = new Map<string, number>();
  income.forEach(t => { const n = norm(t.clientName); if (n) spendByName.set(n, (spendByName.get(n) || 0) + t.total); });
  const payers = spendByName.size;
  const ltv = payers ? revTotal / payers : 0;
  const sortedSpend = [...spendByName.values()].sort((a, b) => b - a);
  const top10Count = Math.max(1, Math.ceil(sortedSpend.length * 0.1));
  const top10Share = revTotal > 0 ? (sortedSpend.slice(0, top10Count).reduce((s, x) => s + x, 0) / revTotal) * 100 : 0;
  const birthdays = clients.filter(c => (c.birthDate || '').slice(5, 7) === today.slice(5, 7)).length;
  const withActivePkg = new Set(pkgs.filter(p => p.status === 'active' && p.clientId).map(p => p.clientId)).size;

  // ================= AGENDA =================
  const done = appts.filter(a => a.status === 'completed');
  const cancelled = appts.filter(a => a.status === 'cancelled').length;
  const noShow = appts.filter(a => a.status === 'no_show').length;
  const noShowRate = appts.length ? ((noShow + cancelled) / appts.length) * 100 : 0;
  const apptToday = appts.filter(a => a.date === today).length;
  const apptWeek = appts.filter(a => a.date >= weekStart && a.date <= today).length;
  const hoursDone = done.reduce((s, a) => s + (a.duration || 0), 0) / 60;
  const hoursMonth = done.filter(a => a.date >= monthStart).reduce((s, a) => s + (a.duration || 0), 0) / 60;
  const avgDuration = done.length ? Math.round(done.reduce((s, a) => s + (a.duration || 0), 0) / done.length) : 0;
  const cabinMins = done.filter(a => a.checkInAt && a.checkOutAt)
    .map(a => (Date.parse(a.checkOutAt!) - Date.parse(a.checkInAt!)) / 60000).filter(m => m > 0 && m < 600);
  const avgCabin = cabinMins.length ? Math.round(cabinMins.reduce((s, m) => s + m, 0) / cabinMins.length) : 0;
  const leadDays = appts.filter(a => a.createdAt && a.date)
    .map(a => (Date.parse(a.date) - Date.parse(a.createdAt.slice(0, 10))) / dayMs).filter(x => x >= 0 && x < 365);
  const avgLead = leadDays.length ? Math.round(leadDays.reduce((s, x) => s + x, 0) / leadDays.length) : 0;
  const DOW = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const topDow = top(done.map(a => DOW[new Date(a.date).getDay()]));
  const topHour = top(done.map(a => (a.startTime || '').slice(0, 2) + ':00'));
  const topTreat = top(done.map(a => a.treatmentName));
  const topOp = top(done.map(a => a.operatorName));

  // ================= PACCHETTI =================
  const pkgPaid = pkgs.reduce((s, p) => s + (p.totalPaid || 0), 0);
  const pkgDebt = pkgs.reduce((s, p) => s + (p.remainingBalance || 0), 0);
  const sessionsLeft = pkgs.reduce((s, p) => s + Math.max(0, p.totalSessions - p.usedSessions), 0);
  const sessionsTot = pkgs.reduce((s, p) => s + p.totalSessions, 0);
  const sessionsUsed = pkgs.reduce((s, p) => s + p.usedSessions, 0);
  const usageRate = sessionsTot ? (sessionsUsed / sessionsTot) * 100 : 0;
  const liability = pkgs.reduce((s, p) => s + (p.totalSessions > 0 ? (p.totalPaid || 0) / p.totalSessions : 0) * Math.max(0, p.totalSessions - p.usedSessions), 0);
  const activePkgs = pkgs.filter(p => p.status === 'active').length;
  const paidPkgs = pkgs.filter(p => p.pricePaid > 0);
  const avgPkgValue = paidPkgs.length ? paidPkgs.reduce((s, p) => s + p.pricePaid, 0) / paidPkgs.length : 0;
  const expiring = pkgs.filter(p => p.status === 'active' && p.expiryDate && Date.parse(p.expiryDate) - Date.now() < 30 * dayMs && Date.parse(p.expiryDate) > Date.now()).length;
  const gcActive = giftCards.filter(g => g.status === 'active');
  const gcValue = gcActive.reduce((s, g) => s + (g.amount || 0), 0);

  // ================= MAGAZZINO =================
  const stockCost = products.reduce((s, p) => s + (p.costPrice || 0) * (p.stock || 0), 0);
  const stockRetail = products.reduce((s, p) => s + (p.price || 0) * (p.stock || 0), 0);
  const lowStock = products.filter(p => (p.stock || 0) <= (p.minStock || 0)).length;
  const outOfStock = products.filter(p => (p.stock || 0) <= 0).length;
  const stockMargin = stockRetail - stockCost;

  // ================= STAFF =================
  const staffMonthly = operators.reduce((s, o) => s + (o.monthlyCost || 0), 0);
  const staffHours = operators.reduce((s, o) => s + (o.contractHours || 0), 0);
  const monthCapacity = staffHours * 4.33;
  const avgHourlyCost = monthCapacity > 0 ? staffMonthly / monthCapacity : 0;
  const revPerHour = monthCapacity > 0 ? revMonth / monthCapacity : 0;
  const coverage = staffMonthly > 0 ? (revMonth / staffMonthly) * 100 : 0;
  const occupancy = monthCapacity > 0 ? (hoursMonth / monthCapacity) * 100 : 0;
  const marginPerHour = revPerHour - avgHourlyCost;

  return [
    {
      title: 'Incassi', icon: 'euro',
      kpis: [
        { key: 'revToday', label: 'Incasso oggi', value: eur(revToday), hint: 'Vendite in cassa di oggi (esclusi i rimborsi).' },
        { key: 'revWeek', label: 'Incasso settimana', value: eur(revWeek), hint: 'Da lunedì a oggi.' },
        { key: 'revMonth', label: 'Incasso mese', value: eur(revMonth), hint: 'Dal primo del mese a oggi.' },
        { key: 'revYear', label: 'Incasso anno', value: eur(revYear), hint: 'Dal 1° gennaio a oggi.' },
        { key: 'growth', label: 'Crescita vs mese scorso', value: growth === null ? '—' : `${growth > 0 ? '+' : ''}${Math.round(growth)}%`, sub: revPrevMonth > 0 ? `mese scorso ${eur(revPrevMonth)}` : 'nessun dato del mese scorso', hint: 'Confronto tra l’incasso di questo mese e quello del mese precedente. È il termometro più immediato dell’andamento.', tone: growth === null ? 'neutral' : growth >= 0 ? 'good' : 'bad' },
        { key: 'dailyAvg', label: 'Media giornaliera', value: eur(dailyAvg), sub: `su ${workedDays} giorni con incasso`, hint: 'Quanto incassi in media in un giorno di apertura. Utile per stimare il mese e capire se una giornata è andata bene o male.' },
        { key: 'bestDay', label: 'Giornata record', value: bestDay ? eur(bestDay[1]) : '—', sub: bestDay ? bestDay[0].split('-').reverse().join('/') : '', hint: 'Il giorno in cui hai incassato di più. Guarda cosa avevi in agenda quel giorno e prova a replicarlo.' },
        { key: 'avgTicket', label: 'Scontrino medio', value: eur(avgTicket), hint: 'Quanto spende in media una cliente per ogni passaggio in cassa. Alzarlo (abbinamenti, prodotti, pacchetti) è il modo più veloce per crescere.' },
        { key: 'expected', label: 'Incasso atteso in agenda', value: eur(expected), sub: `${upcoming.length} appuntamenti futuri`, hint: 'Valore degli appuntamenti già prenotati e non ancora svolti: sono soldi che stanno per entrare, se non ti disdicono.' },
        { key: 'cashShare', label: 'Quota contanti', value: pct(cashShare), sub: eur(cash), hint: 'Percentuale di incasso in contanti. Serve per la gestione di cassa e cassaforte.' },
        { key: 'productUnits', label: 'Prodotti venduti', value: String(productUnits), hint: 'Pezzi di prodotto usciti dalla cassa. La rivendita è il margine più facile in un centro estetico: se è bassa, si sta lasciando soldi sul tavolo.' },
        { key: 'refunds', label: 'Rimborsi', value: eur(refunds), hint: 'Totale restituito alle clienti. Se cresce, indaga sulla soddisfazione.', tone: refunds > 0 ? 'warn' : 'neutral' },
      ],
    },
    {
      title: 'Clienti', icon: 'users',
      kpis: [
        { key: 'tot', label: 'Clienti in anagrafica', value: String(clients.length), hint: 'Tutte le persone registrate nel gestionale.' },
        { key: 'newMonth', label: 'Nuove questo mese', value: String(newMonth), hint: 'Clienti inserite in anagrafica dal primo del mese.' },
        { key: 'active60', label: 'Attive (60 gg)', value: String(active60), hint: 'Hanno completato una visita negli ultimi 60 giorni: è il tuo zoccolo duro.', tone: 'good' },
        { key: 'inactive90', label: 'Da recuperare (90+ gg)', value: String(inactive90), hint: 'Non vengono da oltre 90 giorni: le prime da richiamare con una promo.', tone: inactive90 > 0 ? 'warn' : 'neutral' },
        { key: 'neverCame', label: 'Mai venute', value: String(neverCame), hint: 'In anagrafica ma senza nessuna visita completata (spesso contatti da campagne). Sono il bacino più grande e più economico da attivare.', tone: neverCame > clients.length / 2 ? 'warn' : 'neutral' },
        { key: 'returnRate', label: 'Tasso di ritorno', value: pct(returnRate), sub: `${returning} su ${withVisits.length}`, hint: 'Su 100 clienti venute almeno una volta, quante sono tornate una seconda. Sotto il 40% il centro fatica a fidelizzare.', tone: returnRate >= 50 ? 'good' : returnRate >= 30 ? 'warn' : 'bad' },
        { key: 'oneShot', label: 'Venute una volta sola', value: String(oneShot), hint: 'Recuperarne una vale quanto acquisirne una nuova, ma costa molto meno.', tone: oneShot > returning ? 'warn' : 'neutral' },
        { key: 'avgGap', label: 'Ogni quanto tornano', value: avgGap ? `${avgGap} gg` : '—', hint: 'Intervallo medio fra due visite della stessa cliente: ti dice ogni quanto ha senso ricontattarle.' },
        { key: 'ltv', label: 'Valore medio cliente', value: eur(ltv), sub: `${payers} clienti paganti`, hint: 'Quanto ha speso in media ogni cliente pagante (LTV). Serve a capire quanto puoi investire per acquisirne una nuova.' },
        { key: 'top10', label: 'Peso dei top clienti', value: pct(top10Share), sub: `top ${top10Count} clienti`, hint: 'Quanta parte dell’incasso arriva dal 10% delle clienti migliori. Sopra il 50% sei molto dipendente da poche persone: è un rischio.', tone: top10Share > 60 ? 'warn' : 'neutral' },
        { key: 'withPkg', label: 'Con pacchetto attivo', value: String(withActivePkg), hint: 'Clienti che hanno un pacchetto in corso: tornano con più regolarità e hanno un valore più alto.' , tone: 'good' },
        { key: 'contactable', label: 'Contattabili (marketing)', value: String(contactable), hint: 'Clienti con consenso al marketing: è il numero massimo di persone raggiungibili con una campagna.' },
        { key: 'birthdays', label: 'Compleanni del mese', value: String(birthdays), hint: 'Occasione facile per una promo mirata: gli auguri con sconto hanno il tasso di risposta più alto.' },
      ],
    },
    {
      title: 'Agenda e produttività', icon: 'calendar',
      kpis: [
        { key: 'apptToday', label: 'Appuntamenti oggi', value: String(apptToday), hint: 'Quanti appuntamenti sono in agenda oggi.' },
        { key: 'apptWeek', label: 'Appuntamenti settimana', value: String(apptWeek), hint: 'Da lunedì a oggi.' },
        { key: 'booked', label: 'Appuntamenti totali', value: String(appts.length), hint: 'Tutti gli appuntamenti registrati in agenda.' },
        { key: 'done', label: 'Completati', value: String(done.length), hint: 'Appuntamenti effettivamente svolti (check-out fatto).' },
        { key: 'occupancy', label: 'Tasso di occupazione', value: monthCapacity > 0 ? pct(occupancy) : '—', sub: monthCapacity > 0 ? `${hoursMonth.toFixed(1)}h su ${Math.round(monthCapacity)}h` : 'imposta le ore da contratto', hint: 'Quante delle ore pagate allo staff sono realmente occupate da trattamenti. È IL numero della produttività: sotto il 50% stai pagando ore vuote.', tone: monthCapacity === 0 ? 'neutral' : occupancy >= 65 ? 'good' : occupancy >= 40 ? 'warn' : 'bad' },
        { key: 'hoursDone', label: 'Ore erogate (totali)', value: `${hoursDone.toFixed(1)}h`, hint: 'Ore di trattamento effettivamente svolte.' },
        { key: 'noShowRate', label: 'Buchi in agenda', value: pct(noShowRate), sub: `${noShow} assenti · ${cancelled} disdette`, hint: 'Percentuale di appuntamenti persi tra disdette e mancate presentazioni. Sopra il 10% stai perdendo parecchi soldi: valuta promemoria automatici o acconto.', tone: noShowRate <= 5 ? 'good' : noShowRate <= 12 ? 'warn' : 'bad' },
        { key: 'avgDuration', label: 'Durata media prevista', value: avgDuration ? `${avgDuration} min` : '—', hint: 'Durata media pianificata degli appuntamenti.' },
        { key: 'avgCabin', label: 'Tempo medio in cabina', value: avgCabin ? `${avgCabin} min` : '—', hint: 'Minuti reali tra check-in e check-out. Se è molto più alto della durata prevista, l’agenda va ritarata (o si accumulano ritardi).' },
        { key: 'avgLead', label: 'Anticipo prenotazione', value: `${avgLead} gg`, hint: 'Quanti giorni prima, in media, le clienti prenotano. Se è basso (0-1) lavori quasi solo su last-minute: rischioso per riempire l’agenda.' },
        { key: 'topDow', label: 'Giorno più forte', value: topDow ? topDow[0] : '—', sub: topDow ? `${topDow[1]} trattamenti` : '', hint: 'Il giorno della settimana con più trattamenti: mettici più personale.' },
        { key: 'topHour', label: 'Fascia oraria più richiesta', value: topHour ? topHour[0] : '—', sub: topHour ? `${topHour[1]} trattamenti` : '', hint: 'L’orario di punta. Le fasce vuote sono quelle da spingere con promozioni mirate.' },
        { key: 'topTreat', label: 'Trattamento più richiesto', value: topTreat ? topTreat[0] : '—', sub: topTreat ? `${topTreat[1]} volte` : '', hint: 'Il servizio che traina il centro: tienilo sempre disponibile e usalo per costruire pacchetti.' },
        { key: 'topOp', label: 'Operatrice più attiva', value: topOp ? topOp[0] : '—', sub: topOp ? `${topOp[1]} trattamenti` : '', hint: 'Chi esegue più trattamenti completati.' },
      ],
    },
    {
      title: 'Pacchetti, crediti e buoni', icon: 'package',
      kpis: [
        { key: 'activePkgs', label: 'Pacchetti attivi', value: String(activePkgs), hint: 'Pacchetti in corso con sedute ancora da fare.' },
        { key: 'pkgPaid', label: 'Incassato da pacchetti', value: eur(pkgPaid), hint: 'Totale già pagato dalle clienti per i pacchetti.' },
        { key: 'pkgDebt', label: 'Da incassare', value: eur(pkgDebt), hint: 'Rate di pacchetti non ancora saldate: sono soldi tuoi ancora fuori. Sollecita chi è indietro.', tone: pkgDebt > 0 ? 'warn' : 'good' },
        { key: 'avgPkg', label: 'Valore medio pacchetto', value: eur(avgPkgValue), hint: 'Prezzo medio dei pacchetti venduti: se sale, stai vendendo meglio.' },
        { key: 'usage', label: 'Utilizzo pacchetti', value: pct(usageRate), sub: `${sessionsUsed} su ${sessionsTot} sedute`, hint: 'Quante delle sedute vendute sono state effettivamente erogate. Se è basso, molte clienti hanno pagato e non tornano: rischio reclami e passaparola negativo.', tone: usageRate >= 60 ? 'good' : usageRate >= 30 ? 'warn' : 'bad' },
        { key: 'liability', label: 'Sedute pagate da erogare', value: eur(liability), hint: 'Valore dei trattamenti già pagati ma non ancora svolti. È un debito di servizio: incasso già preso, lavoro ancora da fare.' },
        { key: 'sessionsLeft', label: 'Sedute residue', value: String(sessionsLeft), hint: 'Sedute ancora da erogare su tutti i pacchetti: ti dice quanta agenda è già impegnata.' },
        { key: 'expiring', label: 'Pacchetti in scadenza', value: String(expiring), hint: 'Scadono entro 30 giorni con sedute ancora da fare: chiamale, o perdi la cliente e ti resta il reclamo.', tone: expiring > 0 ? 'warn' : 'neutral' },
        { key: 'giftcards', label: 'Buoni regalo attivi', value: String(gcActive.length), sub: eur(gcValue), hint: 'Buoni venduti e non ancora usati: soldi già incassati a fronte di servizi ancora dovuti.' },
      ],
    },
    {
      title: 'Magazzino', icon: 'box',
      kpis: [
        { key: 'stockCost', label: 'Valore magazzino (a costo)', value: eur(stockCost), hint: 'Quanto hai speso per la merce ferma in negozio: sono soldi immobilizzati.' },
        { key: 'stockRetail', label: 'Valore a prezzo di vendita', value: eur(stockRetail), hint: 'Quanto incasseresti vendendo tutta la merce a scaffale.' },
        { key: 'stockMargin', label: 'Margine potenziale', value: eur(stockMargin), hint: 'Guadagno che otterresti vendendo tutto il magazzino: la differenza tra prezzo di vendita e costo.', tone: 'good' },
        { key: 'lowStock', label: 'Sotto scorta', value: String(lowStock), hint: 'Prodotti arrivati alla soglia minima: da riordinare per non perdere vendite.', tone: lowStock > 0 ? 'warn' : 'good' },
        { key: 'outStock', label: 'Esauriti', value: String(outOfStock), hint: 'Prodotti a zero: ogni giorno di assenza è una vendita persa.', tone: outOfStock > 0 ? 'bad' : 'good' },
        { key: 'skus', label: 'Prodotti a catalogo', value: String(products.length), hint: 'Referenze attive in magazzino.' },
      ],
    },
    {
      title: 'Inaugurazione — dal coupon al cliente pagante', icon: 'gift',
      kpis: [
        { key: 'leads', label: '1· Contatti raccolti', value: String(inaug.totalLeads), hint: 'Persone che hanno richiesto il coupon inaugurazione.' },
        { key: 'withGift', label: '2· Con omaggio assegnato', value: String(inaug.withGift), hint: 'Hanno il pacchetto omaggio pronto da usare.' },
        { key: 'bookedGift', label: 'Hanno già fissato l\'omaggio', value: String(inaug.bookedGift), hint: 'Hanno preso appuntamento ma non sono ancora venute.' },
        { key: 'came', label: '3· Sono venute', value: String(inaug.came), sub: `${pct(inaug.showRate)} di chi ha l'omaggio`, hint: 'Hanno fatto la seduta gratis (omaggio scalato al check-out). È il primo vero contatto in negozio.', tone: inaug.showRate >= 50 ? 'good' : inaug.showRate >= 25 ? 'warn' : 'bad' },
        { key: 'pending', label: 'Non ancora venute', value: String(inaug.booked), hint: 'Hanno l\'omaggio ma non l\'hanno usato: da richiamare, l\'omaggio lo stai già pagando tu.', tone: inaug.booked > 0 ? 'warn' : 'neutral' },
        { key: 'returned', label: '4· Sono tornate paganti', value: String(inaug.returnedPaying), sub: inaug.came > 0 ? `${pct(inaug.conversionRate)} di chi è venuta` : '', hint: 'Dopo l\'omaggio hanno speso qualcosa: un trattamento, un prodotto o un pacchetto. È la prova che il servizio ha convinto.', tone: inaug.came === 0 ? 'neutral' : inaug.conversionRate >= 30 ? 'good' : inaug.conversionRate >= 15 ? 'warn' : 'bad' },
        { key: 'boughtPkg', label: '5· Hanno comprato un pacchetto', value: String(inaug.boughtPackage), sub: inaug.came > 0 ? `${pct(inaug.packageRate)} di chi è venuta` : '', hint: 'Hanno acquistato un pacchetto a pagamento dopo l\'omaggio: è il risultato che vale di più, perché lega la cliente per più sedute.', tone: inaug.came === 0 ? 'neutral' : inaug.packageRate >= 20 ? 'good' : inaug.packageRate >= 10 ? 'warn' : 'bad' },
        { key: 'revAfter', label: 'Fatturato generato', value: eur(inaug.revenueAfter), hint: 'Quanto hanno speso in totale queste clienti DOPO aver usato l\'omaggio. Confrontalo con quanto ti è costata la campagna.', tone: inaug.revenueAfter > 0 ? 'good' : 'neutral' },
        { key: 'valuePerGift', label: 'Valore per omaggio erogato', value: eur(inaug.avgValuePerGift), hint: 'Quanto rende in media ogni seduta omaggio regalata. Se supera il costo del trattamento gratis, la campagna è in utile.', tone: inaug.avgValuePerGift > 0 ? 'good' : 'neutral' },
        { key: 'daysToBuy', label: 'Giorni prima di ricomprare', value: inaug.avgDaysToPurchase ? `${inaug.avgDaysToPurchase} gg` : '—', hint: 'Tempo medio tra la seduta omaggio e il primo acquisto: ti dice dopo quanti giorni ha senso richiamare chi non è ancora tornata.' },
      ],
    },
    {
      title: 'Costi e redditività', icon: 'staff',
      kpis: [
        { key: 'staffMonthly', label: 'Costo staff / mese', value: eur(staffMonthly), hint: 'Somma dei costi mensili lordi delle operatrici (impostali nella scheda di ognuna).' },
        { key: 'capacity', label: 'Ore disponibili / mese', value: monthCapacity > 0 ? `${Math.round(monthCapacity)}h` : '—', hint: 'Ore di lavoro che hai a disposizione in un mese secondo i contratti (ore settimanali × 4,33).' },
        { key: 'avgHourly', label: 'Costo orario medio', value: avgHourlyCost ? `${avgHourlyCost.toFixed(2).replace('.', ',')} €/h` : '—', hint: 'Quanto ti costa un’ora di lavoro. Un trattamento dovrebbe valere almeno 3 volte tanto per essere sostenibile.' },
        { key: 'revPerHour', label: 'Ricavo per ora disponibile', value: revPerHour ? `${revPerHour.toFixed(2).replace('.', ',')} €/h` : '—', hint: 'Incasso del mese diviso le ore di staff disponibili.', tone: avgHourlyCost === 0 ? 'neutral' : revPerHour > avgHourlyCost * 2 ? 'good' : revPerHour > avgHourlyCost ? 'warn' : 'bad' },
        { key: 'marginHour', label: 'Margine per ora', value: avgHourlyCost > 0 ? `${marginPerHour.toFixed(2).replace('.', ',')} €/h` : '—', hint: 'Ricavo per ora meno costo orario: quanto resta a ora per coprire affitto, utenze e utile. Se è negativo, ogni ora aperta ti fa perdere soldi.', tone: avgHourlyCost === 0 ? 'neutral' : marginPerHour > 0 ? 'good' : 'bad' },
        { key: 'coverage', label: 'Copertura costo staff', value: staffMonthly > 0 ? pct(coverage) : '—', hint: 'Quanto dell’incasso del mese copre lo stipendio del personale. Sotto il 100% il mese non paga nemmeno le operatrici.', tone: staffMonthly === 0 ? 'neutral' : coverage >= 300 ? 'good' : coverage >= 150 ? 'warn' : 'bad' },
      ],
    },
  ];
}
