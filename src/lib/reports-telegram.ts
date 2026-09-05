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

function meseSuccessivo(mese: string): string {
  const [y, m] = mese.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

function virgola(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

function nomeMese(mese: string): string {
  const [, m] = mese.split('-').map(Number);
  return MESI[m - 1] || mese;
}

export async function buildClientiNuoviReport(date?: string): Promise<string> {
  const d = date || todayRome();
  const mese = d.slice(0, 7);
  const scorso = mesePrecedente(mese);
  const giorno = Number(d.slice(8, 10)) || 1;

  /*
    Si prendono le date grezze dei due mesi e si conta qui.

    Serve perché ogni numero va guardato "allo stesso punto del mese": venti
    giorni di settembre contro trentuno di agosto direbbero sempre che si sta
    andando peggio, anche in un mese ottimo.
  */
  const giorniDi = async (m: string): Promise<number[]> => {
    const righe = await prisma.client.findMany({
      where: { createdAt: { gte: `${m}-01`, lt: `${meseSuccessivo(m)}-01` } },
      select: { createdAt: true },
    });
    return righe.map(r => Number(r.createdAt.slice(8, 10))).filter(n => n >= 1 && n <= 31);
  };

  const [oggi, questoMese, meseScorso] = await Promise.all([
    prisma.client.findMany({
      where: { createdAt: { startsWith: d } },
      select: { firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }],
    }),
    giorniDi(mese),
    giorniDi(scorso),
  ]);

  const delMese = questoMese.filter(g => g <= giorno).length;
  const scorsoAdOggi = meseScorso.filter(g => g <= giorno).length;
  const scorsoTutto = meseScorso.length;

  const [anno, numMese] = mese.split('-').map(Number);
  const giorniDelMese = new Date(Date.UTC(anno, numMese, 0)).getUTCDate();
  const media = delMese / giorno;
  const proiezione = Math.round(media * giorniDelMese);

  const lines: string[] = [];
  lines.push(`\u{1F331} <b>Clienti nuove \u2014 ${fmtDay(d)}</b>`);
  lines.push('');
  if (oggi.length === 0) {
    lines.push('<b>Oggi: nessuna</b>');
  } else {
    lines.push(`<b>Oggi: ${oggi.length}</b>`);
    // Sopra la quindicina l'elenco diventa un muro: resta il numero.
    for (const c of oggi.slice(0, 15)) lines.push(`\u2022 ${`${c.firstName} ${c.lastName}`.trim()}`);
    if (oggi.length > 15) lines.push(`\u2026 e altre ${oggi.length - 15}`);
  }
  lines.push('');
  lines.push(`\u{1F4C5} <b>${nomeMese(mese)}: ${delMese}</b> nei primi ${giorno} giorni`);
  lines.push(`\u{1F4C8} Media ${virgola(media)} al giorno \u2014 di questo passo si chiude a ${proiezione}`);

  lines.push('');
  lines.push(`<b>Contro ${nomeMese(scorso)}</b>`);
  if (scorsoAdOggi === 0) {
    lines.push(`Ai primi ${giorno} giorni di ${nomeMese(scorso)}: nessuna`);
  } else {
    const diff = delMese - scorsoAdOggi;
    const perc = Math.round((diff / scorsoAdOggi) * 100);
    const segno = diff > 0 ? '\u{1F53C}' : diff < 0 ? '\u{1F53D}' : '\u27A1\uFE0F';
    const parola = diff > 0 ? 'in più' : 'in meno';
    lines.push(`Ai primi ${giorno} giorni erano ${scorsoAdOggi}`);
    lines.push(diff === 0
      ? `${segno} Stesso passo`
      : `${segno} ${Math.abs(diff)} ${parola} (${perc > 0 ? '+' : ''}${perc}%)`);
  }
  if (scorsoTutto > 0) lines.push(`Tutto ${nomeMese(scorso)}: ${scorsoTutto}`);

  /*
    L'andamento dentro al mese, settimana per settimana: dice se la crescita
    sta rallentando o accelerando, cosa che il totale da solo nasconde.
  */
  const settimane: number[] = [];
  for (let s = 0; s * 7 < giorno; s++) {
    const da = s * 7 + 1;
    const a = Math.min(da + 6, giorno);
    settimane.push(questoMese.filter(g => g >= da && g <= a).length);
  }
  if (settimane.length > 1 && delMese > 0) {
    lines.push('');
    lines.push(`\u{1F4CA} Settimana per settimana: ${settimane.join(' \u00B7 ')}`);
  }

  return lines.join('\n');
}

// Invia i report abilitati. `force` ignora i toggle (usato dal tasto "Invia ora").
/**
 * Le variazioni dell'agenda di oggi, la sera.
 *
 * Non e' una lista di sospetti: e' il conto di cosa e' uscito dall'agenda
 * mentre il centro lavorava. Gli spostamenti si contano a parte perche' non
 * sono perdite — annullare e rifare subito e' quello che succede quando una
 * cliente chiede di cambiare giorno — e confonderli farebbe suonare un
 * allarme per niente, che e' il modo migliore per farlo ignorare.
 *
 * Le eliminazioni si scrivono per ultime e per nome: un appuntamento tolto
 * dall'archivio e' l'unica cosa che, prima, non lasciava alcuna traccia.
 */
async function buildVariazioniReport(): Promise<string> {
  const { riepilogoVariazioniDiOggi } = await import('@/app/actions/diario');
  const r = await riepilogoVariazioniDiOggi();
  const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

  if (r.annullati.length === 0 && r.eliminati.length === 0 && r.spostati.length === 0) {
    return '📋 <b>Agenda</b>\nOggi nessun appuntamento tolto o spostato.';
  }

  const righe: string[] = ['📋 <b>Variazioni dell\'agenda di oggi</b>'];

  if (r.annullati.length > 0) {
    righe.push(`\n❌ <b>Annullati (${r.annullati.length})</b>`);
    for (const v of r.annullati) {
      righe.push(`• ${v.data.split('-').reverse().slice(0, 2).join('/')} ${v.ora} · ${v.clientName} · ${eur(v.prezzo)}`
        + `\n   ${v.motivo || 'nessun motivo'} — ${v.chi}`);
    }
  }

  if (r.eliminati.length > 0) {
    righe.push(`\n🗑 <b>ELIMINATI dall'archivio (${r.eliminati.length})</b>`);
    for (const v of r.eliminati) {
      righe.push(`• ${v.data.split('-').reverse().slice(0, 2).join('/')} ${v.ora} · ${v.clientName} · ${v.trattamento} · ${eur(v.prezzo)}`
        + `\n   tolto da ${v.chi}`);
    }
  }

  if (r.spostati.length > 0) {
    righe.push(`\n🔄 <b>Spostati (${r.spostati.length})</b> — rifatti subito, non sono perdite`);
    for (const v of r.spostati) righe.push(`• ${v.clientName} · ${v.ora}`);
  }

  if (r.persiEuro > 0) {
    righe.push(`\n💸 Valore uscito dall'agenda: <b>${eur(r.persiEuro)}</b>`);
  }
  return righe.join('\n');
}

export async function sendDailyReports(opts: { which?: 'incassi' | 'staff' | 'clienti' | 'variazioni' | 'both'; force?: boolean } = {}): Promise<{ sent: string[] }> {
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
  /*
    Le variazioni partono sempre, senza un interruttore che le spenga.

    E' l'unico avviso che serve proprio a chi non era in centro, e un
    interruttore in Impostazioni lo puo' spegnere chiunque ci arrivi. Se non
    c'e' niente da dire, il messaggio lo dice in una riga.
  */
  if (which === 'both' || which === 'variazioni') {
    const r = await sendTelegram(await buildVariazioniReport());
    if (r.ok) sent.push('variazioni');
  }
  return { sent };
}
