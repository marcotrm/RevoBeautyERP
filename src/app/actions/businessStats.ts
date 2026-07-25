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
  booked: number;            // omaggio prenotato ma non ancora completato
  returnedPaying: number;    // tornate per un servizio a pagamento
  conversionRate: number;    // % venute → tornate paganti
}

export async function getInaugurationStats(): Promise<InaugurationStats> {
  const [leads, inaugClients, giftPkgs, transactions] = await Promise.all([
    prisma.inaugurationLead.count(),
    prisma.client.findMany({ where: { tags: { has: 'Inaugurazione' } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.clientPackage.findMany({ where: { pricePaid: 0 }, select: { clientId: true, usedSessions: true } }),
    prisma.posTransaction.findMany({ where: { total: { gt: 0 } }, select: { clientName: true } }),
  ]);

  const inaugIds = new Set(inaugClients.map(c => c.id));
  const inaugNames = new Set(inaugClients.map(c => norm(`${c.firstName} ${c.lastName}`)));

  const giftForInaug = giftPkgs.filter(g => g.clientId && inaugIds.has(g.clientId));
  const withGift = new Set(giftForInaug.map(g => g.clientId)).size;
  const came = new Set(giftForInaug.filter(g => g.usedSessions >= 1).map(g => g.clientId)).size;
  const booked = withGift - came;

  // Appuntamenti a pagamento completati per clienti inaugurazione
  const paidAppts = await prisma.appointment.findMany({
    where: { status: 'completed', price: { gt: 0 }, clientId: { in: [...inaugIds] } },
    select: { clientId: true },
  });
  const returnedIds = new Set<string>(paidAppts.map(a => a.clientId));
  // ...oppure una vendita cassa a loro nome
  for (const t of transactions) {
    const n = norm(t.clientName);
    if (n && inaugNames.has(n)) {
      const match = inaugClients.find(c => norm(`${c.firstName} ${c.lastName}`) === n);
      if (match) returnedIds.add(match.id);
    }
  }
  const returnedPaying = returnedIds.size;

  return {
    totalLeads: leads,
    inClients: inaugClients.length,
    withGift,
    came,
    booked,
    returnedPaying,
    conversionRate: came > 0 ? Math.round((returnedPaying / came) * 100) : 0,
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

  const [appts, transactions, packages] = await Promise.all([
    prisma.appointment.findMany({ where: { clientId, status: 'completed' }, select: { date: true, price: true } }),
    prisma.posTransaction.findMany({ select: { clientName: true, total: true, date: true } }),
    prisma.clientPackage.findMany({ where: { clientId }, select: { payments: true } }),
  ]);

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
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const yearStart = today.slice(0, 4) + '-01-01';

  const [clients, appts, txs, pkgs, operators, inaug] = await Promise.all([
    prisma.client.findMany({ select: { id: true, firstName: true, lastName: true, createdAt: true, tags: true, birthDate: true } }),
    prisma.appointment.findMany({ select: { clientId: true, date: true, price: true, status: true, operatorName: true, treatmentName: true, checkInAt: true, checkOutAt: true } }),
    prisma.posTransaction.findMany({ select: { clientName: true, total: true, date: true, paymentMethod: true, isRefund: true } }),
    prisma.clientPackage.findMany({ select: { clientId: true, pricePaid: true, totalPaid: true, remainingBalance: true, usedSessions: true, totalSessions: true, payments: true } }),
    prisma.operator.findMany({ where: { isResource: false }, select: { firstName: true, lastName: true, monthlyCost: true, contractHours: true } }),
    getInaugurationStats(),
  ]);

  // ---------- Incassi ----------
  const income = txs.filter(t => !t.isRefund && t.total > 0);
  const revTotal = income.reduce((s, t) => s + t.total, 0);
  const revMonth = income.filter(t => t.date >= monthStart).reduce((s, t) => s + t.total, 0);
  const revYear = income.filter(t => t.date >= yearStart).reduce((s, t) => s + t.total, 0);
  const revToday = income.filter(t => t.date === today).reduce((s, t) => s + t.total, 0);
  const refunds = txs.filter(t => t.isRefund || t.total < 0).reduce((s, t) => s + Math.abs(t.total), 0);
  const avgTicket = income.length ? revTotal / income.length : 0;
  const cash = income.filter(t => /contant|cash/i.test(t.paymentMethod)).reduce((s, t) => s + t.total, 0);
  const cashShare = revTotal > 0 ? (cash / revTotal) * 100 : 0;

  // ---------- Pacchetti ----------
  const pkgPaid = pkgs.reduce((s, p) => s + (p.totalPaid || 0), 0);
  const pkgDebt = pkgs.reduce((s, p) => s + (p.remainingBalance || 0), 0);
  const pkgSessionsLeft = pkgs.reduce((s, p) => s + Math.max(0, p.totalSessions - p.usedSessions), 0);
  // Valore "impegnato": sedute già pagate ma non ancora erogate
  const liability = pkgs.reduce((s, p) => {
    const perSession = p.totalSessions > 0 ? (p.totalPaid || 0) / p.totalSessions : 0;
    return s + perSession * Math.max(0, p.totalSessions - p.usedSessions);
  }, 0);

  // ---------- Clienti ----------
  const visitsByClient = new Map<string, string[]>();
  for (const a of appts) {
    if (a.status !== 'completed' || !a.clientId) continue;
    const arr = visitsByClient.get(a.clientId) || [];
    arr.push(a.date); visitsByClient.set(a.clientId, arr);
  }
  const withVisits = [...visitsByClient.entries()];
  const returning = withVisits.filter(([, d]) => new Set(d).size > 1).length;
  const oneShot = withVisits.filter(([, d]) => new Set(d).size === 1).length;
  const returnRate = withVisits.length ? (returning / withVisits.length) * 100 : 0;

  const lastVisitByClient = new Map<string, number>();
  for (const [cid, dates] of withVisits) {
    lastVisitByClient.set(cid, Math.max(...dates.map(d => Date.parse(d))));
  }
  const active60 = [...lastVisitByClient.values()].filter(t => (Date.now() - t) / dayMs <= 60).length;
  const inactive90 = [...lastVisitByClient.values()].filter(t => (Date.now() - t) / dayMs > 90).length;
  const newMonth = clients.filter(c => (c.createdAt || '') >= monthStart).length;

  // intervallo medio tra visite (solo clienti con 2+ visite)
  let gapSum = 0, gapCount = 0;
  for (const [, dates] of withVisits) {
    const ds = [...new Set(dates)].sort();
    for (let i = 1; i < ds.length; i++) { gapSum += (Date.parse(ds[i]) - Date.parse(ds[i - 1])) / dayMs; gapCount++; }
  }
  const avgGap = gapCount ? Math.round(gapSum / gapCount) : 0;

  // LTV medio: incasso totale / clienti che hanno speso
  const spendByName = new Map<string, number>();
  for (const t of income) {
    const n = norm(t.clientName); if (!n) continue;
    spendByName.set(n, (spendByName.get(n) || 0) + t.total);
  }
  const payers = spendByName.size;
  const ltv = payers ? revTotal / payers : 0;

  // compleanni del mese
  const mm = today.slice(5, 7);
  const birthdays = clients.filter(c => (c.birthDate || '').slice(5, 7) === mm).length;

  // ---------- Agenda ----------
  const done = appts.filter(a => a.status === 'completed');
  const cancelled = appts.filter(a => a.status === 'cancelled').length;
  const noShow = appts.filter(a => a.status === 'no_show').length;
  const booked = appts.length;
  const noShowRate = booked ? ((noShow + cancelled) / booked) * 100 : 0;
  const cabinMins = done.filter(a => a.checkInAt && a.checkOutAt)
    .map(a => (Date.parse(a.checkOutAt!) - Date.parse(a.checkInAt!)) / 60000).filter(m => m > 0 && m < 600);
  const avgCabin = cabinMins.length ? Math.round(cabinMins.reduce((s, m) => s + m, 0) / cabinMins.length) : 0;

  // trattamento e operatrice più richiesti
  const countBy = (arr: string[]) => {
    const m = new Map<string, number>();
    arr.forEach(x => { if (x) m.set(x, (m.get(x) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  };
  const topTreat = countBy(done.map(a => a.treatmentName));
  const topOp = countBy(done.map(a => a.operatorName));

  // ---------- Staff / costi ----------
  const staffMonthly = operators.reduce((s, o) => s + (o.monthlyCost || 0), 0);
  const staffHours = operators.reduce((s, o) => s + (o.contractHours || 0), 0);
  const avgHourlyCost = staffHours > 0 ? staffMonthly / (staffHours * 4.33) : 0;
  const staffCoverage = staffMonthly > 0 ? (revMonth / staffMonthly) * 100 : 0;
  const revPerHour = staffHours > 0 ? revMonth / (staffHours * 4.33) : 0;

  return [
    {
      title: 'Incassi', icon: 'euro',
      kpis: [
        { key: 'revToday', label: 'Incasso oggi', value: eur(revToday), hint: 'Somma delle vendite in cassa di oggi (esclusi i rimborsi).' },
        { key: 'revMonth', label: 'Incasso questo mese', value: eur(revMonth), hint: 'Vendite in cassa dal primo del mese a oggi.' },
        { key: 'revYear', label: 'Incasso anno', value: eur(revYear), hint: 'Totale incassato in cassa dal 1° gennaio.' },
        { key: 'avgTicket', label: 'Scontrino medio', value: eur(avgTicket), hint: 'Quanto spende in media una cliente per ogni passaggio in cassa. Alzarlo è il modo più veloce per aumentare il fatturato.' },
        { key: 'refunds', label: 'Rimborsi', value: eur(refunds), hint: 'Totale restituito alle clienti. Se cresce, indaga sulla soddisfazione.' },
        { key: 'cashShare', label: 'Quota contanti', value: pct(cashShare), hint: 'Percentuale di incasso in contanti sul totale. Utile per la gestione di cassa e cassaforte.', tone: 'neutral' },
      ],
    },
    {
      title: 'Clienti', icon: 'users',
      kpis: [
        { key: 'tot', label: 'Clienti in anagrafica', value: String(clients.length), hint: 'Tutte le persone registrate nel gestionale.' },
        { key: 'newMonth', label: 'Nuove questo mese', value: String(newMonth), hint: 'Clienti inserite in anagrafica dal primo del mese.' },
        { key: 'active60', label: 'Attive (60 gg)', value: String(active60), hint: 'Clienti che hanno completato una visita negli ultimi 60 giorni: è il tuo "zoccolo duro".' , tone: 'good' },
        { key: 'inactive90', label: 'Da recuperare (90+ gg)', value: String(inactive90), hint: 'Non vengono da oltre 90 giorni: sono le prime da richiamare con una promo.', tone: inactive90 > 0 ? 'warn' : 'neutral' },
        { key: 'returnRate', label: 'Tasso di ritorno', value: pct(returnRate), hint: 'Su 100 clienti che sono venute almeno una volta, quante sono tornate almeno una seconda. Sotto il 40% significa che il centro fatica a fidelizzare.', tone: returnRate >= 50 ? 'good' : returnRate >= 30 ? 'warn' : 'bad' },
        { key: 'oneShot', label: 'Venute una sola volta', value: String(oneShot), hint: 'Clienti "una tantum": ogni una recuperata vale quanto acquisirne una nuova, ma costa molto meno.', tone: oneShot > returning ? 'warn' : 'neutral' },
        { key: 'avgGap', label: 'Ogni quanto tornano', value: avgGap ? `${avgGap} gg` : '—', hint: 'Intervallo medio fra due visite della stessa cliente. Ti dice ogni quanto ha senso ricontattarle.' },
        { key: 'ltv', label: 'Valore medio cliente', value: eur(ltv), hint: 'Quanto ha speso in media ogni cliente pagante da quando è cliente (LTV). Serve a capire quanto puoi investire per acquisirne una nuova.' },
        { key: 'birthdays', label: 'Compleanni del mese', value: String(birthdays), hint: 'Occasione facile per una promo mirata: gli auguri con sconto hanno il tasso di risposta più alto.' },
      ],
    },
    {
      title: 'Agenda e servizio', icon: 'calendar',
      kpis: [
        { key: 'booked', label: 'Appuntamenti totali', value: String(booked), hint: 'Tutti gli appuntamenti registrati in agenda.' },
        { key: 'done', label: 'Completati', value: String(done.length), hint: 'Appuntamenti effettivamente svolti (check-out fatto).' },
        { key: 'noShowRate', label: 'Buchi in agenda', value: pct(noShowRate), hint: 'Percentuale di appuntamenti persi tra disdette e mancate presentazioni. Sopra il 10% stai perdendo parecchi soldi: valuta promemoria automatici o acconto.', tone: noShowRate <= 5 ? 'good' : noShowRate <= 12 ? 'warn' : 'bad' },
        { key: 'noShow', label: 'Non presentate', value: String(noShow), hint: 'Clienti che non si sono presentate senza disdire.' },
        { key: 'cancelled', label: 'Disdette', value: String(cancelled), hint: 'Appuntamenti annullati.' },
        { key: 'avgCabin', label: 'Tempo medio in cabina', value: avgCabin ? `${avgCabin} min` : '—', hint: 'Minuti reali tra check-in e check-out. Confrontalo con la durata prevista del trattamento: se è più alto, l\'agenda va tarata.' },
        { key: 'topTreat', label: 'Trattamento più richiesto', value: topTreat ? topTreat[0] : '—', sub: topTreat ? `${topTreat[1]} volte` : '', hint: 'Il servizio che traina il centro: tienilo sempre disponibile e usalo per costruire pacchetti.' },
        { key: 'topOp', label: 'Operatrice più attiva', value: topOp ? topOp[0] : '—', sub: topOp ? `${topOp[1]} trattamenti` : '', hint: 'Chi esegue più trattamenti completati.' },
      ],
    },
    {
      title: 'Pacchetti e crediti', icon: 'package',
      kpis: [
        { key: 'pkgPaid', label: 'Incassato da pacchetti', value: eur(pkgPaid), hint: 'Totale già pagato dalle clienti per i pacchetti.' },
        { key: 'pkgDebt', label: 'Da incassare', value: eur(pkgDebt), hint: 'Rate di pacchetti ancora non saldate: sono soldi tuoi ancora fuori. Sollecita chi è indietro.', tone: pkgDebt > 0 ? 'warn' : 'good' },
        { key: 'liability', label: 'Sedute già pagate da erogare', value: eur(liability), hint: 'Valore dei trattamenti che le clienti hanno pagato ma non hanno ancora fatto. È un debito di servizio: incasso già preso, lavoro ancora da svolgere.', tone: 'neutral' },
        { key: 'sessionsLeft', label: 'Sedute residue', value: String(pkgSessionsLeft), hint: 'Numero di sedute ancora da erogare su tutti i pacchetti attivi. Ti dice quanta agenda è già impegnata.' },
      ],
    },
    {
      title: 'Inaugurazione (omaggi)', icon: 'gift',
      kpis: [
        { key: 'leads', label: 'Contatti raccolti', value: String(inaug.totalLeads), hint: 'Persone che hanno richiesto il coupon inaugurazione.' },
        { key: 'withGift', label: 'Con omaggio assegnato', value: String(inaug.withGift), hint: 'Clienti che hanno il pacchetto omaggio pronto da usare.' },
        { key: 'came', label: 'Venute (omaggio usato)', value: String(inaug.came), hint: 'Hanno effettivamente fatto la seduta gratis: la seduta si scala al check-out.', tone: 'good' },
        { key: 'pending', label: 'Non ancora venute', value: String(inaug.booked), hint: 'Hanno l\'omaggio ma non l\'hanno ancora usato: da richiamare, l\'omaggio è già "pagato" da te.', tone: inaug.booked > 0 ? 'warn' : 'neutral' },
        { key: 'returned', label: 'Tornate paganti', value: String(inaug.returnedPaying), hint: 'Clienti arrivate dall\'inaugurazione che hanno acquistato un servizio a pagamento: è il vero risultato della campagna.', tone: 'good' },
        { key: 'conv', label: 'Conversione omaggio → pagante', value: inaug.came > 0 ? pct(inaug.conversionRate) : '—', sub: inaug.came === 0 ? 'nessuna ha ancora usato l\'omaggio' : `${inaug.returnedPaying} su ${inaug.came}`, hint: 'Su 100 clienti che hanno usato l\'omaggio, quante sono tornate a pagare. È il numero che dice se l\'inaugurazione è stata un investimento o un costo. Si calcola solo quando almeno una ha usato l\'omaggio.', tone: inaug.came === 0 ? 'neutral' : inaug.conversionRate >= 30 ? 'good' : inaug.conversionRate >= 15 ? 'warn' : 'bad' },
      ],
    },
    {
      title: 'Costi del personale', icon: 'staff',
      kpis: [
        { key: 'staffMonthly', label: 'Costo staff / mese', value: eur(staffMonthly), hint: 'Somma dei costi mensili lordi delle operatrici (impostali nella scheda di ognuna).' },
        { key: 'avgHourly', label: 'Costo orario medio', value: avgHourlyCost ? `${avgHourlyCost.toFixed(2).replace('.', ',')} €/h` : '—', hint: 'Quanto ti costa in media un\'ora di lavoro. Un trattamento deve valere almeno 3 volte tanto per essere sostenibile.' },
        { key: 'revPerHour', label: 'Ricavo per ora lavorata', value: revPerHour ? `${revPerHour.toFixed(2).replace('.', ',')} €/h` : '—', hint: 'Incasso del mese diviso le ore di staff disponibili. Confrontalo col costo orario: se è più basso, stai perdendo su ogni ora.', tone: avgHourlyCost === 0 ? 'neutral' : revPerHour > avgHourlyCost * 2 ? 'good' : revPerHour > avgHourlyCost ? 'warn' : 'bad' },
        { key: 'coverage', label: 'Copertura costo staff', value: staffMonthly > 0 ? pct(staffCoverage) : '—', hint: 'Quanto dell\'incasso del mese copre lo stipendio del personale. Sotto il 100% il mese non paga nemmeno le operatrici.', tone: staffMonthly === 0 ? 'neutral' : staffCoverage >= 300 ? 'good' : staffCoverage >= 150 ? 'warn' : 'bad' },
      ],
    },
  ];
}
