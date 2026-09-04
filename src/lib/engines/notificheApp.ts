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

/** "oggi", "domani" o "sabato 5 settembre": come lo direbbe una persona. */
function dataLeggibile(data: string): string {
  const oggi = adessoInItalia().data;
  if (data === oggi) return 'oggi';
  if (data === dataItaliaFra(1)) return 'domani';
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${data}T12:00:00`));
}

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
        corpo: `${posto.treatmentName} · ${dataLeggibile(posto.date)} alle ${posto.startTime}${posto.operatorName ? ` con ${posto.operatorName}` : ''}. Prenota prima che voli via.`,
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

// ------------------------------------------------------------
// Revo Moments: il compleanno
// ------------------------------------------------------------

/**
 * Gli auguri, una volta l'anno (refId = clientId:anno) e solo a chi ha
 * l'app. La data di nascita in scheda gira in formati diversi: si estrae
 * giorno e mese senza fare gli schizzinosi.
 */
export async function auguriDiCompleanno(): Promise<{ inviate: number }> {
  const config = await leggiConfig();
  if (!config.notifiche.attive) return { inviate: 0 };

  const { data: oggi, hhmm } = adessoInItalia();
  const ora = aMinuti(hhmm);
  if (ora < config.notifiche.dalleOre * 60 || ora >= config.notifiche.alleOre * 60) return { inviate: 0 };

  const [, meseOggi, giornoOggi] = oggi.split('-');
  const anno = oggi.slice(0, 4);

  const account = await prisma.mobileAccount.findMany({
    select: { clientId: true, client: { select: { firstName: true, birthDate: true } } },
  });

  let inviate = 0;
  for (const a of account) {
    const nascita = String(a.client.birthDate || '');
    // "1990-05-12" → 05-12 · "12/05/1990" → 05-12
    let mese = '', giorno = '';
    const iso = nascita.match(/^\d{4}-(\d{2})-(\d{2})/);
    const ita = nascita.match(/^(\d{1,2})\/(\d{1,2})\/\d{4}/);
    if (iso) { mese = iso[1]; giorno = iso[2]; }
    else if (ita) { mese = ita[2].padStart(2, '0'); giorno = ita[1].padStart(2, '0'); }
    if (mese !== meseOggi || giorno !== giornoOggi) continue;

    const esito = await inviaNotifica({
      clientId: a.clientId,
      tipo: 'compleanno',
      refId: `${a.clientId}:${anno}`,
      titolo: `Tanti auguri, ${a.client.firstName}! 🎂`,
      corpo: 'Oggi è il tuo giorno: passa a trovarci, ci piace festeggiarti.',
      dati: { rotta: '/per-te' },
    });
    if (esito === 'inviata') inviate++;
  }
  return { inviate };
}

// ------------------------------------------------------------
// Avvisi Autopilot: la finestra ideale si è aperta
// ------------------------------------------------------------

/** Numero della settimana: il freno «massimo un avviso a settimana». */
function settimanaISO(): string {
  const d = new Date();
  const inizio = new Date(d.getFullYear(), 0, 1);
  const sett = Math.ceil(((d.getTime() - inizio.getTime()) / 86400000 + inizio.getDay() + 1) / 7);
  return `${d.getFullYear()}w${sett}`;
}

/**
 * Una volta al giorno (fascia mattutina), per chi ha una finestra aperta e
 * niente in agenda: un solo avviso a settimana per cliente — il refId con
 * la settimana dentro È il freno, non serve contare nulla.
 */
export async function avvisiAutopilot(): Promise<{ inviate: number }> {
  const config = await leggiConfig();
  if (!config.notifiche.attive) return { inviate: 0 };

  const { hhmm } = adessoInItalia();
  if (hhmm < '10:00' || hhmm >= '11:00') return { inviate: 0 };

  const { suggerimentiAutopilot } = await import('@/lib/engines/autopilot');
  const account = await prisma.mobileAccount.findMany({ select: { clientId: true } });
  const settimana = settimanaISO();

  let inviate = 0;
  for (const a of account) {
    try {
      const sugg = (await suggerimentiAutopilot(a.clientId)).find((s) => s.aperta);
      if (!sugg) continue;
      const esito = await inviaNotifica({
        clientId: a.clientId,
        tipo: 'autopilot',
        refId: `${a.clientId}:${settimana}`,
        titolo: 'È il momento giusto ✨',
        corpo: `${sugg.treatmentName}: di solito lo fai ogni ${sugg.ogniGiorni} giorni e la tua finestra ideale è aperta. Tocca per vedere gli orari.`,
        dati: { rotta: '/prenota' },
      });
      if (esito === 'inviata') inviate++;
    } catch (err) {
      console.error('[autopilot] avviso fallito per', a.clientId, err);
    }
  }
  return { inviate };
}

// ------------------------------------------------------------
// Revo Drop: lo slot in vetrina arriva a chi può volerlo
// ------------------------------------------------------------

/**
 * Per ogni Flash Slot ancora aperto e fresco (ultime 3 ore), la push va
 * alle clienti compatibili: chi quel trattamento (o quella categoria) l'ha
 * già fatto. Massimo 20 per slot, le più recenti prima — la prima onda del
 * progetto Drop; le onde successive arriveranno col pannello.
 */
export async function avvisiDrop(): Promise<{ inviate: number }> {
  const config = await leggiConfig();
  if (!config.notifiche.attive || !config.funzioni.flashSlot) return { inviate: 0 };

  const adesso = new Date().toISOString();
  const treOreFa = new Date(Date.now() - 3 * 3600000).toISOString();
  const slots = await prisma.flashSlot.findMany({
    where: { status: 'open', createdAt: { gte: treOreFa }, expiresAt: { gt: adesso } },
    select: { id: true, treatmentId: true, treatmentName: true, date: true, startTime: true, price: true, fullPrice: true },
  });
  if (slots.length === 0) return { inviate: 0 };

  let inviate = 0;
  for (const slot of slots) {
    const categoria = await prisma.treatment.findUnique({
      where: { id: slot.treatmentId },
      select: { category: true },
    });
    // Le compatibili: hanno fatto quel trattamento o quella categoria, e hanno l'app
    const compatibili = await prisma.appointment.findMany({
      where: {
        status: 'completed',
        OR: [
          { treatmentId: slot.treatmentId },
          ...(categoria?.category ? [{ treatmentCategory: categoria.category }] : []),
        ],
      },
      orderBy: { date: 'desc' },
      select: { clientId: true },
      take: 200,
    });
    const conApp = await prisma.mobileAccount.findMany({
      where: { clientId: { in: [...new Set(compatibili.map((c) => c.clientId))] } },
      select: { clientId: true },
    });

    for (const c of conApp.slice(0, 20)) {
      const esito = await inviaNotifica({
        clientId: c.clientId,
        tipo: 'drop',
        refId: `${slot.id}:${c.clientId}`,
        titolo: 'Revo Drop ⚡ solo per poco',
        corpo: `${slot.treatmentName} · ${dataLeggibile(slot.date)} alle ${slot.startTime} a ${slot.price}€ invece di ${slot.fullPrice}€. Chi prima arriva…`,
        dati: { rotta: '/per-te' },
      });
      if (esito === 'inviata') inviate++;
    }
  }
  return { inviate };
}

/** Il giro completo, chiamato dallo scheduler. */
export async function giroNotificheApp(): Promise<void> {
  const p = await promemoriaAppuntamenti();
  const w = await abbinaListaAttesa();
  const c = await auguriDiCompleanno();
  const au = await avvisiAutopilot();
  const d = await avvisiDrop();
  const tot = p.inviate + w.avvisate + c.inviate + au.inviate + d.inviate;
  if (tot || w.scadute) {
    console.log(
      `[notifiche-app] ${p.inviate} promemoria · ${w.avvisate} lista d'attesa · ${c.inviate} auguri · ${au.inviate} autopilot · ${d.inviate} drop · ${w.scadute} desideri scaduti`
    );
  }
}
