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

  // Controlla ogni minuto
  setInterval(tick, 60 * 1000);
  console.log('[reports] Scheduler report Telegram attivo (invio alle 20:00 Europe/Rome)');
}
