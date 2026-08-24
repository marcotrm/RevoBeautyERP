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

  // Controlla ogni minuto
  setInterval(() => { void tick(); void waTick(); void buchiTick(); void affiliatiTick(); void recensioniTick(); }, 60 * 1000);
  console.log('[reports] Scheduler report Telegram attivo (invio alle 20:00 Europe/Rome)');
  console.log('[wa] Scheduler automazioni WhatsApp attivo');
  console.log('[copri-buchi] Scheduler copri buchi attivo');
  console.log('[affiliati] Riepilogo mensile attivo (il 1° del mese dalle 10:00)');
  console.log('[recensioni] Controllo Google ogni 30 minuti (8-22), riepilogo positive alle 20:05');
}
