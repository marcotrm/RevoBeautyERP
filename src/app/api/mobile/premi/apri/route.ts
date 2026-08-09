/**
 * Apertura della Beauty Box.
 *
 * Il premio è già stato estratto quando la box è stata assegnata: qui si apre
 * soltanto. Estrarlo al momento dell'apertura sembrerebbe più bello ma vuol
 * dire che due tocchi ravvicinati potrebbero estrarre due volte.
 */
import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { accreditaCredito, muoviPunti } from '@/lib/wallet';
import { traccia } from '@/lib/appEvents';

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const winId = String(body?.winId || '');

  const win = await prisma.prizeWin.findUnique({ where: { id: winId }, include: { prize: true } });
  if (!win || win.clientId !== cliente.id) {
    return Response.json({ error: 'Premio non trovato.', code: 'NOT_FOUND' }, { status: 404 });
  }
  if (Date.parse(win.expiresAt) < Date.now()) {
    return Response.json({ error: 'Questo premio è scaduto.', code: 'NOT_FOUND' }, { status: 409 });
  }

  // Già aperta: si restituisce lo stesso premio invece di un errore, così un
  // tocco doppio o una rete lenta non spaventano la cliente.
  if (win.openedAt) {
    return Response.json({ ok: true, giaAperta: true, premio: { nome: win.prize.name, kind: win.prize.kind, valore: win.prize.value } });
  }

  const adesso = new Date().toISOString();
  await prisma.prizeWin.update({ where: { id: win.id }, data: { openedAt: adesso } });

  // I premi in credito o punti si accreditano subito; quelli in trattamento
  // restano da usare in negozio e li segna l'operatrice.
  if (win.prize.kind === 'credit' && win.prize.value > 0) {
    const giorni = Math.max(1, Math.ceil((Date.parse(win.expiresAt) - Date.now()) / 86400000));
    await accreditaCredito({
      clientId: cliente.id, importo: win.prize.value, bucket: 'prize',
      motivo: `Premio: ${win.prize.name}`, sourceType: 'prize', sourceId: win.id, validoGiorni: giorni,
    });
    await prisma.prizeWin.update({ where: { id: win.id }, data: { usedAt: adesso } });
  } else if (win.prize.kind === 'points' && win.prize.value > 0) {
    await muoviPunti({
      clientId: cliente.id, punti: win.prize.value,
      motivo: `Premio: ${win.prize.name}`, sourceType: 'prize', sourceId: win.id,
    });
    await prisma.prizeWin.update({ where: { id: win.id }, data: { usedAt: adesso } });
  }

  await traccia({ clientId: cliente.id, type: 'click', surface: 'box', itemId: win.id, value: win.prize.value });

  return Response.json({
    ok: true,
    premio: { nome: win.prize.name, kind: win.prize.kind, valore: win.prize.value, scade: win.expiresAt },
  });
}
