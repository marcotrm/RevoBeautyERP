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

  // Controlla ogni minuto
  setInterval(() => { void tick(); void waTick(); }, 60 * 1000);
  console.log('[reports] Scheduler report Telegram attivo (invio alle 20:00 Europe/Rome)');
  console.log('[wa] Scheduler automazioni WhatsApp attivo');
}
