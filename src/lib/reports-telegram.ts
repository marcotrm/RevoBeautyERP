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

// ── Report clienti nuove della giornata (e da inizio mese) ──
/*
  Quante facce nuove sono entrate.

  L'incasso della sera dice come è andata oggi; questo dice se il centro sta
  crescendo, che è un'altra domanda. Il conto del mese riparte dal primo:
  serve a confrontare agosto con luglio, non a vedere un numero che sale per
  sempre e non vuol dire più niente.
*/
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function mesePrecedente(mese: string): string {
  const [y, m] = mese.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function nomeMese(mese: string): string {
  const [, m] = mese.split('-').map(Number);
  return MESI[m - 1] || mese;
}

export async function buildClientiNuoviReport(date?: string): Promise<string> {
  const d = date || todayRome();
  const mese = d.slice(0, 7);
  const scorso = mesePrecedente(mese);

  /*
    Il mese si conta fino a stasera, non fino alla fine del mese: se il report
    lo si rilancia per un giorno passato deve dire quello che si sapeva quella
    sera. La data è scritta in due formati (dal gestionale solo il giorno, dal
    sito l'istante intero), quindi il confine è "prima di domani" e non "fino
    a oggi": se no le schede nate oggi dal sito resterebbero fuori.
  */
  const domani = new Date(`${d}T12:00:00Z`);
  domani.setUTCDate(domani.getUTCDate() + 1);
  const finestra = { gte: `${mese}-01`, lt: domani.toISOString().slice(0, 10) };

  const [oggi, delMese, delMesePrima] = await Promise.all([
    prisma.client.findMany({
      where: { createdAt: { startsWith: d } },
      select: { firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }],
    }),
    prisma.client.count({ where: { createdAt: finestra } }),
    prisma.client.count({ where: { createdAt: { startsWith: scorso } } }),
  ]);

  const giorno = Number(d.slice(8, 10)) || 1;
  const media = delMese / giorno;

  const lines: string[] = [];
  lines.push(`🌱 <b>Clienti nuove — ${fmtDay(d)}</b>`);
  lines.push('');
  if (oggi.length === 0) {
    lines.push('<b>Oggi: nessuna</b>');
  } else {
    lines.push(`<b>Oggi: ${oggi.length}</b>`);
    // Sopra la quindicina l'elenco diventa un muro: resta il numero.
    for (const c of oggi.slice(0, 15)) lines.push(`• ${`${c.firstName} ${c.lastName}`.trim()}`);
    if (oggi.length > 15) lines.push(`… e altre ${oggi.length - 15}`);
  }
  lines.push('');
  lines.push(`📅 <b>${nomeMese(mese)}: ${delMese}</b> dal primo del mese`);
  lines.push(`📈 Media: ${media.toFixed(1).replace('.', ',')} al giorno`);
  if (delMesePrima > 0) {
    const segno = delMese > delMesePrima ? '🔼' : delMese < delMesePrima ? '🔽' : '➡️';
    lines.push(`${segno} ${nomeMese(scorso).charAt(0).toUpperCase()}${nomeMese(scorso).slice(1)}: ${delMesePrima} in tutto il mese`);
  }
  return lines.join('\n');
}

// Invia i report abilitati. `force` ignora i toggle (usato dal tasto "Invia ora").
export async function sendDailyReports(opts: { which?: 'incassi' | 'staff' | 'clienti' | 'both'; force?: boolean } = {}): Promise<{ sent: string[] }> {
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
  if ((which === 'both' || which === 'clienti') && (opts.force || cfg.reportClientiNuovi)) {
    const r = await sendTelegram(await buildClientiNuoviReport());
    if (r.ok) sent.push('clienti');
  }
  return { sent };
}
