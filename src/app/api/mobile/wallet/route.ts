/** Saldo del Beauty Credit e storico completo dei movimenti. */

import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { saldoWallet, saldoPunti, storicoMovimenti } from '@/lib/wallet';
import { leggiConfig } from '@/lib/appSettings';
import { traccia } from '@/lib/appEvents';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const config = await leggiConfig();
  if (!config.funzioni.wallet) {
    return Response.json({ error: 'Funzione non attiva.', code: 'NOT_FOUND' }, { status: 404 });
  }

  const [saldo, punti, movimenti] = await Promise.all([
    saldoWallet(cliente.id),
    saldoPunti(cliente.id),
    storicoMovimenti(cliente.id),
  ]);

  await traccia({ clientId: cliente.id, type: 'view', surface: 'wallet' });

  return Response.json({
    totale: saldo.totale,
    perTasca: saldo.perTasca,
    inScadenza: saldo.inScadenza,
    punti,
    puntiPerEuro: config.punti.puntiPerEuro,
    movimenti,
  });
}
