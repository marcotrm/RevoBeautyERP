/**
 * Beauty Challenge: obiettivi a tempo con un premio.
 *
 * L'avanzamento non si calcola guardando indietro nello storico, si accumula
 * quando il fatto accade. Ricalcolare a ogni apertura dell'app sembrerebbe più
 * pulito, ma vorrebbe dire che una sfida creata oggi risulterebbe già completata
 * da chi ha fatto tre appuntamenti il mese scorso — e il premio verrebbe
 * regalato senza che nessuno abbia fatto nulla per meritarlo.
 */

import { prisma } from './prisma';
import { accreditaCredito, muoviPunti } from './wallet';
import { leggiConfig } from './appSettings';

export type TipoObiettivo = 'appointments' | 'bookings_app' | 'referrals' | 'packages' | 'reviews' | 'spend';

/**
 * Registra un passo avanti su tutte le sfide attive di quel tipo e assegna il
 * premio a chi arriva in fondo. Non fa mai fallire l'azione che l'ha chiamata.
 */
export async function avanzaSfide(clientId: string, tipo: TipoObiettivo, quantita = 1): Promise<void> {
  try {
    const oggi = new Date().toISOString().slice(0, 10);
    const sfide = await prisma.challenge.findMany({
      where: { isActive: true, goalType: tipo, startsAt: { lte: oggi }, endsAt: { gte: oggi } },
    });
    if (!sfide.length) return;

    const adesso = new Date().toISOString();

    for (const s of sfide) {
      const stato = await prisma.challengeProgress.upsert({
        where: { challengeId_clientId: { challengeId: s.id, clientId } },
        create: { challengeId: s.id, clientId, count: quantita, updatedAt: adesso },
        update: { count: { increment: quantita }, updatedAt: adesso },
      });

      if (stato.count < s.goalCount || stato.completedAt) continue;

      await prisma.challengeProgress.update({
        where: { id: stato.id },
        data: { completedAt: adesso },
      });
      await assegnaPremioSfida(clientId, s);
    }
  } catch (e) {
    console.error('[challenge] avanzamento non registrato:', e);
  }
}

async function assegnaPremioSfida(clientId: string, s: {
  id: string; rewardType: string; rewardValue: number; rewardLabel: string; title: string;
}) {
  const adesso = new Date().toISOString();

  if (s.rewardType === 'credit' && s.rewardValue > 0) {
    const config = await leggiConfig();
    await accreditaCredito({
      clientId, importo: s.rewardValue, bucket: 'promo',
      motivo: `Sfida completata: ${s.title}`, sourceType: 'challenge', sourceId: s.id,
      validoGiorni: config.cashback.validoGiorni,
    });
  } else if (s.rewardType === 'points' && s.rewardValue > 0) {
    await muoviPunti({
      clientId, punti: s.rewardValue,
      motivo: `Sfida completata: ${s.title}`, sourceType: 'challenge', sourceId: s.id,
    });
  } else if (s.rewardType === 'prize') {
    await assegnaBeautyBox(clientId, 'challenge');
  }

  await prisma.challengeProgress.updateMany({
    where: { challengeId: s.id, clientId },
    data: { rewardGivenAt: adesso },
  });
}

/**
 * Estrae un premio e lo assegna, chiuso: la cliente lo aprirà dall'app.
 *
 * L'estrazione avviene qui e non all'apertura perché due tocchi ravvicinati
 * sulla stessa box estrarrebbero due premi diversi. Il peso è relativo, non
 * una percentuale: aggiungere un premio non obbliga a ribilanciare gli altri.
 */
export async function assegnaBeautyBox(clientId: string, motivo: string): Promise<string | null> {
  const disponibili = await prisma.prize.findMany({
    where: { isActive: true, OR: [{ stock: null }, { stock: { gt: 0 } }] },
  });
  if (!disponibili.length) return null;

  const totale = disponibili.reduce((s, p) => s + Math.max(1, p.weight), 0);
  let punto = Math.random() * totale;
  let scelto = disponibili[disponibili.length - 1];
  for (const p of disponibili) {
    punto -= Math.max(1, p.weight);
    if (punto <= 0) { scelto = p; break; }
  }

  const adesso = new Date();
  const win = await prisma.prizeWin.create({
    data: {
      clientId,
      prizeId: scelto.id,
      reason: motivo,
      expiresAt: new Date(adesso.getTime() + scelto.validDays * 86400000).toISOString(),
      createdAt: adesso.toISOString(),
    },
  });

  if (scelto.stock !== null) {
    await prisma.prize.update({ where: { id: scelto.id }, data: { stock: { decrement: 1 } } });
  }

  return win.id;
}

/** Le sfide attive con l'avanzamento della cliente, per l'app. */
export async function sfidePerCliente(clientId: string) {
  const oggi = new Date().toISOString().slice(0, 10);
  const sfide = await prisma.challenge.findMany({
    where: { isActive: true, startsAt: { lte: oggi }, endsAt: { gte: oggi } },
    include: { progress: { where: { clientId } } },
    orderBy: { endsAt: 'asc' },
  });

  return sfide.map(s => {
    const p = s.progress[0];
    const fatto = p?.count ?? 0;
    return {
      id: s.id,
      titolo: s.title,
      descrizione: s.description,
      obiettivo: s.goalCount,
      fatto: Math.min(fatto, s.goalCount),
      percentuale: Math.min(100, Math.round((fatto / s.goalCount) * 100)),
      premio: s.rewardLabel,
      completata: !!p?.completedAt,
      scade: s.endsAt,
      giorniRimasti: Math.max(0, Math.ceil((Date.parse(s.endsAt) - Date.now()) / 86400000)),
    };
  });
}
