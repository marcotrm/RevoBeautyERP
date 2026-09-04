// Scheduler in-process: invia i report Telegram alle 20:00 (fuso Italia).
// Gira nel processo di `next start` su Railway. Deduplica per data via DB.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Evita di avviare lo scheduler durante il build
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const REPORT_HHMM = '20:00';
  const STATE_ROW = 'integration:reports_state';

  const nowRome = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find(p => p.type === t)?.value || '';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, hhmm: `${get('hour')}:${get('minute')}` };
  };

  const tick = async () => {
    try {
      const { date, hhmm } = nowRome();
      if (hhmm !== REPORT_HHMM) return;

      const { prisma } = await import('@/lib/prisma');
      // Già inviato oggi?
      const state = await prisma.adminEntry.findUnique({ where: { rowId: STATE_ROW } });
      const lastSent = (state?.data as { lastSent?: string } | undefined)?.lastSent;
      if (lastSent === date) return;

      const { sendDailyReports } = await import('@/lib/reports-telegram');
      await sendDailyReports({ which: 'both' });

      await prisma.adminEntry.upsert({
        where: { rowId: STATE_ROW },
        update: { data: { lastSent: date } },
        create: { rowId: STATE_ROW, kind: 'integration', entityId: 'reports_state', data: { lastSent: date }, createdAt: new Date().toISOString() },
      });
      console.log(`[reports] Report Telegram inviati per ${date}`);
    } catch (err) {
      console.error('[reports] scheduler error', err);
    }
  };

  // Automazioni WhatsApp: ognuna ha il suo orario (vedi WA_SCHEDULE).
  // La deduplica vera è per messaggio (AdminEntry kind `wa_log`), quindi qui
  // basta evitare di rilanciare la stessa automazione due volte nello stesso minuto.
  const waLastRun = new Map<string, string>();

  const waTick = async () => {
    try {
      const { date, hhmm } = nowRome();
      const { WA_SCHEDULE, runWaAutomations } = await import('@/lib/wa-automations');
      for (const slot of WA_SCHEDULE) {
        if (slot.hhmm !== hhmm) continue;
        if (waLastRun.get(slot.which) === date) continue;
        waLastRun.set(slot.which, date);
        const results = await runWaAutomations({ which: slot.which });
        for (const r of results) {
          if (r.skipped) continue;
          console.log(`[wa] ${r.automation}: ${r.candidates} candidati, ${r.sent} inviati, ${r.failed} falliti${r.dryRun ? ' (SIMULAZIONE)' : ''}`);
        }
      }
    } catch (err) {
      console.error('[wa] scheduler error', err);
    }
  };

  /**
   * Copri buchi: le campagne aperte vanno a blocchi con mezz'ora di attesa,
   * quindi non hanno un orario fisso come le altre automazioni — vanno
   * guardate a ogni giro di lancetta per vedere se è ora del blocco dopo.
   */
  const buchiTick = async () => {
    try {
      const { avanzaCampagne } = await import('@/lib/copriBuchi');
      const fatti = await avanzaCampagne();
      for (const f of fatti) console.log(`[copri-buchi] ${f.id}: ${f.azione}`);
    } catch (err) {
      console.error('[copri-buchi] scheduler error', err);
    }
  };

  /**
   * Riepilogo mensile agli affiliati: il primo del mese, dalle 10 in poi.
   *
   * Non si aspetta il minuto esatto ma si guarda una scadenza: "è il primo del
   * mese, sono passate le 10, e questo mese non l'ho ancora fatto". Con
   * l'uguaglianza sull'orario, un deploy o un riavvio proprio in quel minuto
   * farebbe saltare l'intero mese, e nessuno se ne accorgerebbe fino alla
   * telefonata dell'affiliato.
   *
   * La difesa contro il doppio invio non sta qui ma nel database: dentro
   * riepilogoMensileAffiliati ogni affiliato ha una riga per mese creata in
   * modo atomico. Anche con due processi accesi insieme — i secondi di
   * sovrapposizione di un deploy — il secondo trova la riga e si ferma.
   */
  const affiliatiTick = async () => {
    const { date, hhmm } = nowRome();
    if (!date.endsWith('-01') || hhmm < '10:00') return;
    try {
      const { riepilogoMensileAffiliati } = await import('@/lib/affiliazione');
      const esito = await riepilogoMensileAffiliati();
      if (esito.mandati > 0 || esito.saltati.length > 0) {
        console.log(`[affiliati] riepilogo mensile: ${esito.mandati} mandati`, esito.saltati);
      }
    } catch (err) {
      console.error('[affiliati] riepilogo mensile fallito', err);
    }
  };

  /**
   * Recensioni Google: si guarda ogni mezz'ora, e solo mentre il centro è
   * sveglio (8-22). Ogni lettura è una chiamata a pagamento alla Places API:
   * al minuto sarebbero 1440 chiamate al giorno per una recensione che arriva
   * una volta a settimana. Mezz'ora è già più veloce di chiunque guardi Google
   * a mano.
   *
   * Il riepilogo delle positive parte alle 20:05, cinque minuti dopo i report,
   * per non far arrivare tre messaggi tutti insieme.
   */
  const recensioniTick = async () => {
    const { hhmm } = nowRome();
    const [hh, mm] = hhmm.split(':').map(Number);

    try {
      if (hh >= 8 && hh < 22 && (mm === 0 || mm === 30)) {
        const { controllaRecensioni } = await import('@/lib/recensioniTelegram');
        const e = await controllaRecensioni();
        if (e.errore) console.error('[recensioni] lettura fallita:', e.errore);
        else if (e.negativeInviate || e.positiveInCoda || e.invisibili) {
          console.log(`[recensioni] ${e.negativeInviate} negative avvisate, ${e.positiveInCoda} in coda per la sera, ${e.invisibili} senza testo`);
        }
      }

      if (hhmm === '20:05') {
        const { riepilogoRecensioni } = await import('@/lib/recensioniTelegram');
        const r = await riepilogoRecensioni();
        if (r.inviato) console.log(`[recensioni] riepilogo serale: ${r.quante} positive`);
      }
    } catch (err) {
      console.error('[recensioni] scheduler error', err);
    }
  };

  /**
   * L'autocritica della segretaria: la sera, a giornata chiusa.
   *
   * Alle 21:30 e non alle 20: il centro chiude alle 19 e qualche conversazione
   * si trascina, e rileggere una giornata mentre è ancora in corso significa
   * giudicare una prenotazione a metà come se fosse stata abbandonata.
   *
   * La difesa contro il doppio giro non sta qui ma nel database: dentro
   * `autocriticaDelGiorno` c'è una riga per giornata, e se c'è già non si
   * rifà. Così un riavvio proprio in quel minuto non produce due analisi né
   * due messaggi su Telegram.
   */
  const autocriticaTick = async () => {
    const { hhmm } = nowRome();
    if (hhmm !== '21:30') return;
    try {
      const { autocriticaDelGiorno } = await import('@/lib/autocritica');
      const esito = await autocriticaDelGiorno();
      if (esito.fatta && esito.analisi) {
        const a = esito.analisi;
        console.log(`[autocritica] ${a.giorno}: ${a.chatLette} chat, voto ${a.voto}/5, ${a.problemi.length} problemi, ${a.proposte.length} proposte`);
      } else if (esito.motivo) {
        console.log(`[autocritica] non fatta: ${esito.motivo}`);
      }
    } catch (err) {
      console.error('[autocritica] scheduler error', err);
    }
  };

  // Controlla ogni minuto
  /**
   * Il giro dei rinnovi degli abbonamenti: una volta al giorno, alle 10.
   *
   * Non e' un addebito automatico — nessuna carta e' salvata qui: e' l'elenco
   * di chi scade, l'email a chi ha un indirizzo e il riepilogo su Telegram al
   * titolare, che e' poi la persona che deve ricordarsi di chiedere i soldi.
   *
   * A quell'ora il centro e' aperto da un'ora: se qualcuna scade oggi, la si
   * puo' ancora fermare al banco.
   */
  let rinnoviFatti = '';
  const rinnoviTick = async () => {
    const { date, hhmm } = nowRome();
    if (hhmm !== '10:00' || rinnoviFatti === date) return;
    rinnoviFatti = date;
    try {
      const { giroRinnovi } = await import('@/app/actions/abbonamenti');
      const e = await giroRinnovi(false);
      if (e.daChiedere > 0) console.log(`[abbonamenti] ${e.daChiedere} da rinnovare, ${e.avvisate} avvisate per email`);
    } catch (err) {
      console.error('[abbonamenti] giro rinnovi fallito', err);
    }
  };

  /**
   * Notifiche push dell'app clienti (promemoria + lista d'attesa): ogni 5
   * minuti. La deduplica sta nel database (app_notifications), quindi un
   * giro doppio o saltato non produce né doppioni né buchi.
   */
  let notificheInCorso = false;
  const notificheTick = async () => {
    const { hhmm } = nowRome();
    const minuto = Number(hhmm.slice(3));
    if (minuto % 5 !== 0 || notificheInCorso) return;
    notificheInCorso = true;
    try {
      const { giroNotificheApp } = await import('@/lib/engines/notificheApp');
      await giroNotificheApp();
    } catch (err) {
      console.error('[notifiche-app] scheduler error', err);
    } finally {
      notificheInCorso = false;
    }
  };

  /**
   * Revo Score: la fotografia notturna, alle 03:30 — quando l'agenda dorme.
   * L'upsert per (cliente, giorno) rende innocuo qualsiasi doppio giro.
   */
  let scoreFatto = '';
  const scoreTick = async () => {
    const { date, hhmm } = nowRome();
    if (hhmm !== '03:30' || scoreFatto === date) return;
    scoreFatto = date;
    try {
      const { snapshotScoreGiornaliero } = await import('@/lib/engines/score');
      const e = await snapshotScoreGiornaliero();
      console.log(`[score] snapshot notturno: ${e.salvati} clienti`);
    } catch (err) {
      console.error('[score] snapshot fallito', err);
    }
  };

  setInterval(() => { void tick(); void waTick(); void buchiTick(); void affiliatiTick(); void recensioniTick(); void autocriticaTick(); void rinnoviTick(); void notificheTick(); void scoreTick(); }, 60 * 1000);
  console.log('[reports] Scheduler report Telegram attivo (invio alle 20:00 Europe/Rome)');
  console.log('[wa] Scheduler automazioni WhatsApp attivo');
  console.log('[copri-buchi] Scheduler copri buchi attivo');
  console.log('[affiliati] Riepilogo mensile attivo (il 1° del mese dalle 10:00)');
  console.log('[recensioni] Controllo Google ogni 30 minuti (8-22), riepilogo positive alle 20:05');
  console.log('[autocritica] La segretaria si rilegge alle 21:30');
  console.log('[notifiche-app] Promemoria e lista d\'attesa ogni 5 minuti');
}
