import { prisma } from '@/lib/prisma';
import { sendTelegram, getTelegramConfig } from '@/lib/telegram';

function todayRome(): string {
  // Data "oggi" nel fuso Italia in formato YYYY-MM-DD
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts; // en-CA → YYYY-MM-DD
}
function fmtEuro(n: number) { return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }); }
function fmtDay(d: string) { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; }

const CASH_METHODS = ['Contanti'];
const CARD_METHODS = ['Carta', 'POS', 'Satispay', 'Bancomat'];

// ── Report incassi della serata ──
export async function buildIncassiReport(date?: string): Promise<string> {
  const d = date || todayRome();
  const txs = (await prisma.posTransaction.findMany({ where: { date: d } })).filter(t => t.total > 0);
  const total = txs.reduce((s, t) => s + t.total, 0);
  const cash = txs.filter(t => CASH_METHODS.includes(t.paymentMethod)).reduce((s, t) => s + t.total, 0);
  const card = txs.filter(t => CARD_METHODS.includes(t.paymentMethod)).reduce((s, t) => s + t.total, 0);
  const other = total - cash - card;

  const lines: string[] = [];
  lines.push(`🧾 <b>Report incassi — ${fmtDay(d)}</b>`);
  lines.push('');
  lines.push(`💰 <b>Totale: ${fmtEuro(total)}</b> (${txs.length} incassi)`);
  lines.push(`💵 Contanti: ${fmtEuro(cash)}`);
  lines.push(`💳 POS/Carta: ${fmtEuro(card)}`);
  if (other > 0.001) lines.push(`↔️ Altri metodi: ${fmtEuro(other)}`);
  lines.push('');
  if (txs.length === 0) {
    lines.push('Nessun incasso registrato oggi.');
  } else {
    lines.push('<b>Clienti paganti:</b>');
    txs.sort((a, b) => b.total - a.total).forEach(t => {
      lines.push(`• ${t.clientName || 'Cliente'} — ${fmtEuro(t.total)} (${t.paymentMethod})`);
    });
  }
  return lines.join('\n');
}

// ── Report classifica estetiste (per incasso) ──
export async function buildStaffReport(date?: string): Promise<string> {
  const d = date || todayRome();
  const txs = (await prisma.posTransaction.findMany({ where: { date: d } })).filter(t => t.total > 0);

  const byOp = new Map<string, { total: number; count: number }>();
  txs.forEach(t => {
    const name = (t.operator || '').trim() || 'Non assegnato';
    const cur = byOp.get(name) || { total: 0, count: 0 };
    cur.total += t.total; cur.count += 1;
    byOp.set(name, cur);
  });
  const ranking = Array.from(byOp.entries()).sort((a, b) => b[1].total - a[1].total);

  const lines: string[] = [];
  lines.push(`🏆 <b>Classifica estetiste — ${fmtDay(d)}</b>`);
  lines.push('');
  if (ranking.length === 0) {
    lines.push('Nessun incasso registrato oggi.');
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    ranking.forEach(([name, v], i) => {
      const badge = medals[i] || `${i + 1}.`;
      lines.push(`${badge} <b>${name}</b> — ${fmtEuro(v.total)} (${v.count} incassi)`);
    });
    lines.push('');
    lines.push(`Migliore della giornata: <b>${ranking[0][0]}</b> 👏`);
  }
  return lines.join('\n');
}

// Invia i report abilitati. `force` ignora i toggle (usato dal tasto "Invia ora").
export async function sendDailyReports(opts: { which?: 'incassi' | 'staff' | 'both'; force?: boolean } = {}): Promise<{ sent: string[] }> {
  const cfg = await getTelegramConfig();
  const sent: string[] = [];
  const which = opts.which || 'both';
  if ((which === 'both' || which === 'incassi') && (opts.force || cfg.reportIncassi)) {
    const r = await sendTelegram(await buildIncassiReport());
    if (r.ok) sent.push('incassi');
  }
  if ((which === 'both' || which === 'staff') && (opts.force || cfg.reportStaff)) {
    const r = await sendTelegram(await buildStaffReport());
    if (r.ok) sent.push('staff');
  }
  return { sent };
}
