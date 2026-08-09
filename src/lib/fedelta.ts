/**
 * Cosa matura per la cliente quando incassa la cassa.
 *
 * È il pezzo che fa esistere davvero punti, cashback e referral: senza,
 * resterebbero schermate che mostrano sempre zero. Si chiama da un posto solo
 * — la creazione della transazione — così non ci sono due strade per accreditare
 * la stessa cosa.
 *
 * Tre principi:
 *  - **non blocca mai l'incasso**: se qualcosa qui va storto, la vendita è già
 *    registrata e l'errore finisce nei log. Nessuna cassa deve fermarsi perché
 *    non si riesce a calcolare un cashback;
 *  - **niente premi sui resi**: gli importi negativi non generano nulla, e non
 *    tolgono nulla di già dato (togliere punti già spesi creerebbe saldi
 *    negativi impossibili da spiegare);
 *  - **il credito speso non rigenera cashback**: altrimenti il wallet si
 *    alimenterebbe da solo all'infinito.
 */

import { prisma } from './prisma';
import { leggiConfig } from './appSettings';
import { livelloCliente } from './club';
import { accreditaCredito, muoviPunti } from './wallet';
import { maturaReferral } from './referral';
import { avanzaSfide } from './challenge';

const norm = (s: string | null | undefined) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

export interface EsitoFedelta {
  clientId: string | null;
  punti: number;
  cashback: number;
  referralMaturato: boolean;
}

/**
 * Da eseguire dopo ogni incasso positivo.
 * `metodo` serve per non premiare la spesa di credito già accreditato.
 */
export async function maturaDaIncasso(params: {
  clientName: string | null;
  importo: number;
  metodo: string;
  sourceId: string;
  descrizione?: string;
}): Promise<EsitoFedelta> {
  const vuoto: EsitoFedelta = { clientId: null, punti: 0, cashback: 0, referralMaturato: false };
  if (params.importo <= 0) return vuoto;

  // Pagare col wallet non genera nuovo cashback: sarebbe una moneta che si
  // stampa da sola.
  if (/credito|wallet/i.test(params.metodo)) return vuoto;

  const nome = norm(params.clientName);
  if (!nome) return vuoto; // cliente occasionale: niente da accreditare

  const clienti = await prisma.client.findMany({ select: { id: true, firstName: true, lastName: true, phone: true } });
  const cliente = clienti.find(c => norm(`${c.firstName} ${c.lastName}`) === nome);
  if (!cliente) return vuoto;

  const config = await leggiConfig();
  const livello = config.funzioni.club ? await livelloCliente(cliente.id) : null;

  const esito: EsitoFedelta = { clientId: cliente.id, punti: 0, cashback: 0, referralMaturato: false };

  // ---- Punti: base per euro, moltiplicati dal livello del Club ----
  const fattore = livello?.attuale?.pointsFactor ?? 1;
  const punti = Math.round(params.importo * config.punti.perEuro * fattore);
  if (punti > 0) {
    await muoviPunti({
      clientId: cliente.id,
      punti,
      motivo: params.descrizione || 'Trattamento',
      sourceType: 'pos',
      sourceId: params.sourceId,
    });
    esito.punti = punti;
  }

  // ---- Cashback: percentuale del livello, o quella base ----
  if (config.cashback.attivo) {
    const percentuale = livello?.attuale?.cashbackPct ?? config.cashback.percentualeBase;
    const importo = Math.round(params.importo * (percentuale / 100) * 100) / 100;
    // Sotto i 50 centesimi non si accredita: righe da 0,03 € riempiono lo
    // storico di rumore e non fanno tornare nessuno.
    if (importo >= 0.5) {
      await accreditaCredito({
        clientId: cliente.id,
        importo,
        bucket: 'cashback',
        motivo: `Cashback ${percentuale}%`,
        sourceType: 'pos',
        sourceId: params.sourceId,
        validoGiorni: config.cashback.validoGiorni,
      });
      esito.cashback = importo;
    }
  }

  // ---- Referral: il premio matura al primo incasso vero dell'amica ----
  if (config.funzioni.referral) {
    esito.referralMaturato = await maturaReferral(cliente.id, cliente.phone);
  }

  // ---- Challenge basate sulla spesa ----
  if (config.funzioni.challenge) {
    await avanzaSfide(cliente.id, 'spend', params.importo);
  }

  return esito;
}
