/**
 * Il motore delle notifiche dell'app clienti: promemoria appuntamenti
 * e lista d'attesa intelligente. Primo motore della fase 1 di Revo Beauty OS.
 *
 * Gira dallo scheduler (instrumentation.ts) ogni cinque minuti. È tutto
 * idempotente: la deduplica sta nel database (vedi lib/pushExpo), quindi
 * un giro perso o doppio non produce né buchi né doppioni.
 *
 * I promemoria del proprio appuntamento non contano come "disturbo":
 * la fascia oraria di config si applica al promemoria del giorno prima
 * (che può aspettare le 9) ma non a quello delle 2 ore, che ha senso solo
 * quando serve.
 */

import { prisma } from '@/lib/prisma';
import { inviaNotifica } from '@/lib/pushExpo';
import { leggiConfig } from '@/lib/appSettings';

const STATI_VIVI = ['confirmed', 'pending'];

/** Data e ora italiana, in stringhe confrontabili. */
function adessoInItalia(): { data: string; hhmm: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return { data: `${g('year')}-${g('month')}-${g('day')}`, hhmm: `${g('hour')}:${g('minute')}` };
}

function dataItaliaFra(giorni: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(
    new Date(Date.now() + giorni * 86400000)
  );
}

const aMinuti = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** 0=domenica … 6=sabato di una data YYYY-MM-DD (a mezzogiorno: niente sorprese di fuso). */
const giornoSettimana = (data: string) => new Date(`${data}T12:00:00`).getDay();

// ------------------------------------------------------------
// Promemoria appuntamenti
// ------------------------------------------------------------

export async function promemoriaAppuntamenti(): Promise<{ inviate: number }> {
  const config = await leggiConfig();
  if (!config.notifiche.attive) return { inviate: 0 };

  const { data: oggi, hhmm } = adessoInItalia();
  const ora = aMinuti(hhmm);
  let inviate = 0;

  // — Il giorno prima: parte solo nella fascia in cui è lecito disturbare.
  const oraOk = ora >= config.notifiche.dalleOre * 60 && ora < config.notifiche.alleOre * 60;
  if (oraOk) {
    const domani = dataItaliaFra(1);
    const diDomani = await prisma.appointment.findMany({
      where: { date: domani, status: { in: STATI_VIVI } },
      select: { id: true, clientId: true, startTime: true, treatmentName: true, operatorName: true },
    });
    for (const a of diDomani) {
      const esito = await inviaNotifica({
        clientId: a.clientId,
        tipo: 'promemoria-24h',
        refId: a.id,
        titolo: 'A domani! 🦋',
        corpo: `Domani alle ${a.startTime}: ${a.treatmentName}${a.operatorName ? ` con ${a.operatorName}` : ''}.`,
        dati: { rotta: '/appuntamenti' },
      });
      if (esito === 'inviata') inviate++;
    }
  }

  // — Due ore prima (finestra 60–150 min: con un giro ogni 5 minuti non scappa).
  const diOggi = await prisma.appointment.findMany({
    where: { date: oggi, status: { in: STATI_VIVI } },
    select: { id: true, clientId: true, startTime: true, treatmentName: true },
  });
  for (const a of diOggi) {
    const mancano = aMinuti(a.startTime) - ora;
    if (mancano < 60 || mancano > 150) continue;
    const esito = await inviaNotifica({
      clientId: a.clientId,
      tipo: 'promemoria-2h',
      refId: a.id,
      titolo: 'Ci vediamo tra poco ✨',
      corpo: `Alle ${a.startTime} ti aspettiamo per ${a.treatmentName}.`,
      dati: { rotta: '/appuntamenti' },
    });
    if (esito === 'inviata') inviate++;
  }

  return { inviate };
}

// ------------------------------------------------------------
// Lista d'attesa intelligente
// ------------------------------------------------------------

/**
 * Quando si libera un posto, chi l'aveva chiesto lo sa per prima.
 *
 * Si guardano le disdette recenti (ultime 3 ore: abbondante rispetto al giro
 * di 5 minuti, e la deduplica evita comunque i doppioni) con data da oggi in
 * poi, e si abbinano ai desideri attivi: stesso trattamento, giorno che va
 * bene, orario dentro la fascia chiesta, operatrice giusta se indicata.
 *
 * Il desiderio avvisato passa a 'avvisata' e non spara più: una lista
 * d'attesa che ti scrive cinque volte insegna solo a ignorarla. Se il posto
 * sfuma, la cliente può riattivare il desiderio con un tocco.
 */
export async function abbinaListaAttesa(): Promise<{ avvisate: number; scadute: number }> {
  const { data: oggi } = adessoInItalia();

  // Prima le pulizie: i desideri scaduti muoiono in silenzio.
  const scadute = await prisma.waitlistWish.updateMany({
    where: { stato: 'attiva', scadenza: { lt: oggi } },
    data: { stato: 'scaduta' },
  });

  const desideri = await prisma.waitlistWish.findMany({ where: { stato: 'attiva' } });
  if (desideri.length === 0) return { avvisate: 0, scadute: scadute.count };

  const treOreFa = new Date(Date.now() - 3 * 3600000).toISOString();
  const liberati = await prisma.appointment.findMany({
    where: {
      status: 'cancelled',
      date: { gte: oggi },
      updatedAt: { gte: treOreFa },
    },
    select: {
      id: true, date: true, startTime: true, treatmentId: true,
      treatmentName: true, operatorId: true, operatorName: true,
    },
  });
  if (liberati.length === 0) return { avvisate: 0, scadute: scadute.count };

  let avvisate = 0;
  for (const posto of liberati) {
    const inizio = aMinuti(posto.startTime);
    const giorno = giornoSettimana(posto.date);

    for (const d of desideri) {
      if (d.stato !== 'attiva') continue; // può essere cambiato in questo stesso giro
      if (d.treatmentId !== posto.treatmentId && d.treatmentName !== posto.treatmentName) continue;
      if (d.operatorId && d.operatorId !== posto.operatorId) continue;
      if (d.giorni.length > 0 && !d.giorni.includes(giorno)) continue;
      if (inizio < aMinuti(d.dalleOre) || inizio >= aMinuti(d.alleOre)) continue;
      if (posto.date < oggi || (posto.date === oggi && inizio <= aMinuti(adessoInItalia().hhmm))) continue;

      const esito = await inviaNotifica({
        clientId: d.clientId,
        tipo: 'waitlist',
        refId: `${d.id}:${posto.id}`,
        titolo: 'Si è liberato un posto! 🎉',
        corpo: `${posto.treatmentName} · ${posto.date === oggi ? 'oggi' : posto.date} alle ${posto.startTime}${posto.operatorName ? ` con ${posto.operatorName}` : ''}. Prenota prima che voli via.`,
        dati: { rotta: '/prenota' },
      });

      if (esito === 'inviata' || esito === 'no-token') {
        await prisma.waitlistWish.update({ where: { id: d.id }, data: { stato: 'avvisata' } });
        d.stato = 'avvisata';
        if (esito === 'inviata') avvisate++;
      }
    }
  }

  return { avvisate, scadute: scadute.count };
}

/** Il giro completo, chiamato dallo scheduler. */
export async function giroNotificheApp(): Promise<void> {
  const p = await promemoriaAppuntamenti();
  const w = await abbinaListaAttesa();
  if (p.inviate || w.avvisate || w.scadute) {
    console.log(`[notifiche-app] ${p.inviate} promemoria, ${w.avvisate} avvisi lista d'attesa, ${w.scadute} desideri scaduti`);
  }
}
