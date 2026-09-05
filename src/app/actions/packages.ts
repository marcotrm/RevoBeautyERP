'use server';

import { prisma } from '@/lib/prisma';
import { PackageItem, ClientPackage, PackagePayment } from '@/stores/usePackageStore';
import { notifyIncasso } from '@/lib/telegram';
import { FREE_PACKAGES } from '@/lib/giftOptions';
import { emettiScontrinoElettronico } from '@/lib/scontrino';

function toClientPackage(cp: {
  id: string; clientName: string; packageName: string; packageColor: string;
  totalSessions: number; usedSessions: number; pricePaid: number; totalPaid: number;
  remainingBalance: number; paymentPlan: string; purchaseDate: string; expiryDate: string;
  status: string; history: unknown; payments: unknown; packageId?: string | null;
  clientId?: string | null;
}): ClientPackage {
  return {
    ...cp,
    paymentPlan: cp.paymentPlan as ClientPackage['paymentPlan'],
    status: cp.status as ClientPackage['status'],
    history: (cp.history as unknown as ClientPackage['history']) ?? [],
    payments: (cp.payments as unknown as PackagePayment[]) ?? [],
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Registra un incasso in cassa (POS) collegato a un pacchetto, così il pagamento
// compare tra le transazioni del giorno come qualsiasi altro incasso — scontrino
// elettronico compreso: chi paga un pacchetto (o una rata) è un incasso vero.
async function recordPosPayment(params: {
  clientName: string; amount: number; method: string; operator: string; label: string;
}) {
  if (!params.amount || params.amount <= 0) return;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  const created = await prisma.posTransaction.create({
    data: {
      date: today,
      time,
      clientName: params.clientName,
      items: [params.label],
      total: params.amount,
      paymentMethod: params.method,
      operator: params.operator,
      isRefund: false,
    },
  });
  await emettiScontrinoElettronico(created, params.label);
  notifyIncasso({ amount: params.amount, client: params.clientName, items: params.label, method: params.method, operator: params.operator }).catch(() => {});
}

/**
 * Riga in cassa per un regalo: importo zero, così si vede chi ha ricevuto cosa
 * senza spostare di un centesimo l'incasso del giorno.
 *
 * A zero euro il gestionale non emette scontrino fiscale, non manda la notifica
 * dell'incasso e la riga non entra né nella chiusura contanti né in cassaforte:
 * resta solo la traccia di quello che è successo.
 */
async function recordPosGift(params: {
  clientName: string; giftedAmount: number; operator: string; packageName: string;
}) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  await prisma.posTransaction.create({
    data: {
      date: today,
      time,
      clientName: params.clientName,
      items: [`Regalo pacchetto: ${params.packageName} — ${params.giftedAmount.toFixed(2).replace('.', ',')} € omaggio`],
      total: 0,
      paymentMethod: 'Regalo',
      operator: params.operator,
      isRefund: false,
    },
  });
}

export async function getPackages() {
  const packages = await prisma.package.findMany({ orderBy: { name: 'asc' } });
  return packages as unknown as PackageItem[];
}

export async function getClientPackages() {
  const clientPackages = await prisma.clientPackage.findMany({ orderBy: { purchaseDate: 'desc' } });
  return clientPackages.map(toClientPackage);
}

export async function createPackage(pkg: PackageItem) {
  const created = await prisma.package.create({ data: pkg });
  return created as unknown as PackageItem;
}

// Modifica un pacchetto del catalogo (nome, prezzo, sedute, colore, descrizione...).
// Non tocca i pacchetti già venduti alle clienti, che restano com'erano al momento della vendita.
export async function updatePackage(id: string, updates: Partial<PackageItem>) {
  const { id: _ignored, ...data } = updates as PackageItem & { id?: string };
  void _ignored;
  const updated = await prisma.package.update({ where: { id }, data });
  return updated as unknown as PackageItem;
}

export async function deletePackage(id: string) {
  await prisma.package.delete({ where: { id } });
  return true;
}

export async function activatePackage(
  pkg: PackageItem,
  clientName: string,
  validityMonths: number,
  firstPayment: number,
  paymentMethod: PackagePayment['method'],
  operator: string,
  paymentPlan: 'full' | 'installments',
  clientId?: string,
  /**
   * Il prezzo davvero concordato, quando e' diverso dal listino.
   *
   * Uno sconto su un pacchetto si faceva scrivendo un acconto piu' basso e
   * poi regalando il resto, cioe' due passaggi e una riga «regalo» che non
   * raccontava cosa era successo. Qui il pacchetto costa quello che si e'
   * detto alla cliente, e la differenza col listino resta scritta nello
   * storico con il motivo e il nome di chi l'ha decisa.
   */
  prezzoConcordato?: number,
  motivoSconto?: string,
) {
  const now = new Date();
  const exp = new Date(now);
  exp.setMonth(exp.getMonth() + validityMonths);
  const today = now.toISOString().split('T')[0];

  // Il prezzo non sale mai sopra il listino: quello non e' uno sconto, e' un
  // altro pacchetto, e si fa cambiando il listino.
  const prezzo = round2(Math.max(0, Math.min(prezzoConcordato ?? pkg.price, pkg.price)));
  const sconto = round2(pkg.price - prezzo);

  /*
    Il pacchetto va agganciato alla SCHEDA, non solo al nome.

    Chi lo attiva dalla pagina pacchetti scrive il nome e basta, e il legame
    con la cliente restava vuoto: il pacchetto esisteva, era pagato, si
    scalavano le sedute — ma nella sua scheda non compariva, e al banco
    risultava che non ne avesse. Dodici pacchetti erano finiti cosi'.

    Se il nome corrisponde a UNA sola cliente si aggancia; se corrisponde a
    due omonime non si indovina: resta senza legame, che e' meglio di un
    pacchetto attaccato alla persona sbagliata.
  */
  let idCliente = clientId ?? null;
  if (!idCliente && clientName.trim()) {
    const pezzi = clientName.trim().split(/\s+/);
    const nome = pezzi[0];
    const cognome = pezzi.slice(1).join(' ');
    if (cognome) {
      const trovate = await prisma.client.findMany({
        where: {
          firstName: { equals: nome, mode: 'insensitive' },
          lastName: { equals: cognome, mode: 'insensitive' },
        },
        select: { id: true },
        take: 2,
      });
      if (trovate.length === 1) idCliente = trovate[0].id;
    }
  }

  const created = await prisma.clientPackage.create({
    data: {
      clientName,
      packageName: pkg.name,
      packageColor: pkg.color,
      totalSessions: pkg.totalSessions,
      usedSessions: 0,
      pricePaid: prezzo,
      totalPaid: firstPayment,
      remainingBalance: round2(prezzo - firstPayment),
      paymentPlan,
      purchaseDate: today,
      expiryDate: exp.toISOString().split('T')[0],
      status: 'active',
      /*
        Lo sconto si scrive nello storico, non si deduce.

        Fra un anno, davanti a un pacchetto da 350 pagato 250, l'unica cosa
        che serve sapere e' chi l'ha deciso e perche'. Un numero piu' basso e
        basta e' un ammanco che nessuno sa spiegare.
      */
      history: sconto > 0
        ? [{
          date: today,
          operator,
          note: `Sconto di ${sconto.toFixed(2).replace('.', ',')} € sul listino di ${pkg.price.toFixed(2).replace('.', ',')} €`
            + (motivoSconto?.trim() ? ` — ${motivoSconto.trim()}` : ''),
        }]
        : [],
      payments: JSON.parse(JSON.stringify([{ id: `pay-${Date.now()}`, date: today, amount: firstPayment, method: paymentMethod, operator }])),
      packageId: pkg.id,
      clientId: idCliente,
    },
  });

  await prisma.package.update({ where: { id: pkg.id }, data: { sold: { increment: 1 } } });

  // Incasso iniziale in cassa (l'acconto o l'intero importo pagato subito)
  await recordPosPayment({
    clientName,
    amount: firstPayment,
    method: paymentMethod,
    operator,
    label: `Pacchetto: ${pkg.name}`,
  });

  return toClientPackage(created);
}

/**
 * Regalo: il residuo viene condonato alla cliente.
 *
 * Non è un incasso, quindi non tocca `totalPaid`: cala il prezzo del pacchetto,
 * così il dovuto va a zero e i conti del centro continuano a dire la verità su
 * quanto è entrato davvero. Nello storico del pacchetto resta la riga "Regalo"
 * con l'importo condonato e chi l'ha fatto, e in cassa compare una riga da zero
 * euro per sapere che quel pacchetto è stato regalato.
 */
async function giftBalance(
  cp: { id: string; clientName: string; packageName: string; pricePaid: number; totalPaid: number; remainingBalance: number; paymentPlan: string; payments: unknown },
  amount: number, operator: string, note?: string,
) {
  const today = new Date().toISOString().split('T')[0];
  const gifted = Math.min(amount, cp.remainingBalance || 0);
  const newPricePaid = Math.max(0, cp.pricePaid - gifted);
  const newRemaining = Math.max(0, newPricePaid - cp.totalPaid);
  const payments = (cp.payments as unknown as PackagePayment[]) ?? [];

  const updated = await prisma.clientPackage.update({
    where: { id: cp.id },
    data: {
      pricePaid: newPricePaid,
      remainingBalance: newRemaining,
      paymentPlan: newRemaining <= 0 ? 'full' : cp.paymentPlan,
      payments: JSON.parse(JSON.stringify([
        ...payments,
        { id: `pay-${Date.now()}`, date: today, amount: 0, giftedAmount: gifted, method: 'Regalo', operator, note },
      ])),
    },
  });

  // Traccia in cassa: importo zero, non sposta l'incasso
  await recordPosGift({
    clientName: cp.clientName,
    giftedAmount: gifted,
    operator,
    packageName: cp.packageName,
  });

  return toClientPackage(updated);
}

/**
 * Una rata pagata dopo, sul pacchetto.
 *
 * `giaInCassa` esiste per un motivo preciso: quando la rata si paga dalla
 * cassa, la riga in cassa l'ha gia' scritta la cassa. Senza questo, ogni rata
 * finiva registrata DUE volte — «Rata Pacchetto: X» dal punto cassa e «Saldo
 * pacchetto: X» da qui, stesso importo, stesso minuto — e l'incasso del
 * giorno risultava piu' alto di quello che era davvero entrato nel cassetto.
 * Successo per mesi su ogni pacchetto pagato a rate.
 */
export async function addPayment(
  cpId: string, amount: number, method: PackagePayment['method'], operator: string, note?: string,
  opzioni?: { giaInCassa?: boolean },
) {
  const cp = await prisma.clientPackage.findUniqueOrThrow({ where: { id: cpId } });
  if (method === 'Regalo') return giftBalance(cp, amount, operator, note);

  const today = new Date().toISOString().split('T')[0];
  const newTotalPaid = cp.totalPaid + amount;
  const newRemaining = Math.max(0, cp.pricePaid - newTotalPaid);
  const payments = (cp.payments as unknown as PackagePayment[]) ?? [];

  const updated = await prisma.clientPackage.update({
    where: { id: cpId },
    data: {
      totalPaid: newTotalPaid,
      remainingBalance: newRemaining,
      paymentPlan: newRemaining <= 0 ? 'full' : cp.paymentPlan,
      payments: JSON.parse(JSON.stringify([...payments, { id: `pay-${Date.now()}`, date: today, amount, method, operator, note }])),
    },
  });

  // In cassa ci va solo se non ci e' gia' andata: vedi il commento sopra.
  if (!opzioni?.giaInCassa) {
    await recordPosPayment({
      clientName: cp.clientName,
      amount,
      method,
      operator,
      label: `Saldo pacchetto: ${cp.packageName}`,
    });
  }

  return toClientPackage(updated);
}

export async function recordSessionUse(cpId: string, operator: string, note: string) {
  const cp = await prisma.clientPackage.findUniqueOrThrow({ where: { id: cpId } });
  const today = new Date().toISOString().split('T')[0];
  const newUsed = cp.usedSessions + 1;
  const history = (cp.history as unknown as ClientPackage['history']) ?? [];

  const updated = await prisma.clientPackage.update({
    where: { id: cpId },
    data: {
      usedSessions: newUsed,
      status: newUsed >= cp.totalSessions ? 'completed' : cp.status,
      history: JSON.parse(JSON.stringify([...history, { date: today, operator, note: note || undefined }])),
    },
  });

  return toClientPackage(updated);
}

export async function deleteClientPackage(cpId: string) {
  await prisma.clientPackage.delete({ where: { id: cpId } });
  return true;
}

/**
 * Cambia il trattamento dell'omaggio inaugurazione (es. da Fast Tonic a Lampada).
 * Si può fare solo finché la seduta non è stata usata.
 */
export async function changeGiftTreatment(cpId: string, giftKey: string) {
  const cfg = FREE_PACKAGES[giftKey];
  if (!cfg) throw new Error('Omaggio non valido');

  const cp = await prisma.clientPackage.findUnique({ where: { id: cpId } });
  if (!cp) throw new Error('Pacchetto non trovato');
  if (cp.pricePaid !== 0) throw new Error('Si può cambiare solo un pacchetto omaggio');
  if (cp.usedSessions > 0) throw new Error('La seduta omaggio è già stata usata');

  const updated = await prisma.clientPackage.update({
    where: { id: cpId },
    data: { packageName: cfg.name, packageColor: cfg.color, totalSessions: cfg.sessions },
  });
  return toClientPackage(updated);
}
