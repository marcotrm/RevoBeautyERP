'use server';

/**
 * Il ponte fra la cassa e il wallet dell'app.
 *
 * Nel wallet vivono i crediti "guadagnati" (invito di un'amica, cashback,
 * premi): finora la cliente li vedeva nell'app ma al banco non c'era un
 * tasto per spenderli — soldi promessi che non si potevano usare. Queste
 * due azioni chiudono il giro: la cassa mostra il saldo e lo scala,
 * consumando prima ciò che scade prima (la logica sta in lib/wallet).
 */

import { saldoWallet, spendiCredito } from '@/lib/wallet';

export async function saldoWalletApp(clientId: string): Promise<number> {
  if (!clientId) return 0;
  const s = await saldoWallet(clientId).catch(() => null);
  return s?.totale ?? 0;
}

export async function usaWalletApp(params: {
  clientId: string;
  importo: number;
  txId?: string;
  operatore?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const esito = await spendiCredito({
    clientId: params.clientId,
    importo: params.importo,
    motivo: 'Usato in cassa',
    sourceType: 'pos',
    sourceId: params.txId,
    operator: params.operatore,
  });
  return esito.ok ? { ok: true } : { ok: false, error: esito.error };
}
