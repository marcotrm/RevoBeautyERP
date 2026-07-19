'use server';

import { prisma } from '@/lib/prisma';
import { PackageItem, ClientPackage, PackagePayment } from '@/stores/usePackageStore';
import { notifyIncasso } from '@/lib/telegram';

function toClientPackage(cp: {
  id: string; clientName: string; packageName: string; packageColor: string;
  totalSessions: number; usedSessions: number; pricePaid: number; totalPaid: number;
  remainingBalance: number; paymentPlan: string; purchaseDate: string; expiryDate: string;
  status: string; history: unknown; payments: unknown;
}): ClientPackage {
  return {
    ...cp,
    paymentPlan: cp.paymentPlan as ClientPackage['paymentPlan'],
    status: cp.status as ClientPackage['status'],
    history: (cp.history as unknown as ClientPackage['history']) ?? [],
    payments: (cp.payments as unknown as PackagePayment[]) ?? [],
  };
}

// Registra un incasso in cassa (POS) collegato a un pacchetto, così il pagamento
// compare tra le transazioni del giorno come qualsiasi altro incasso.
async function recordPosPayment(params: {
  clientName: string; amount: number; method: string; operator: string; label: string;
}) {
  if (!params.amount || params.amount <= 0) return;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  await prisma.posTransaction.create({
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
  notifyIncasso({ amount: params.amount, client: params.clientName, items: params.label, method: params.method, operator: params.operator }).catch(() => {});
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
  clientId?: string
) {
  const now = new Date();
  const exp = new Date(now);
  exp.setMonth(exp.getMonth() + validityMonths);
  const today = now.toISOString().split('T')[0];

  const created = await prisma.clientPackage.create({
    data: {
      clientName,
      packageName: pkg.name,
      packageColor: pkg.color,
      totalSessions: pkg.totalSessions,
      usedSessions: 0,
      pricePaid: pkg.price,
      totalPaid: firstPayment,
      remainingBalance: pkg.price - firstPayment,
      paymentPlan,
      purchaseDate: today,
      expiryDate: exp.toISOString().split('T')[0],
      status: 'active',
      history: [],
      payments: JSON.parse(JSON.stringify([{ id: `pay-${Date.now()}`, date: today, amount: firstPayment, method: paymentMethod, operator }])),
      packageId: pkg.id,
      clientId: clientId ?? null,
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

export async function addPayment(cpId: string, amount: number, method: PackagePayment['method'], operator: string, note?: string) {
  const cp = await prisma.clientPackage.findUniqueOrThrow({ where: { id: cpId } });
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

  // Registra anche il saldo/acconto successivo in cassa
  await recordPosPayment({
    clientName: cp.clientName,
    amount,
    method,
    operator,
    label: `Saldo pacchetto: ${cp.packageName}`,
  });

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
