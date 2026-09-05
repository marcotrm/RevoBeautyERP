/**
 * Invio delle notifiche push all'app clienti, via Expo Push.
 *
 * Una sola porta d'ingresso: `inviaNotifica`. Prima di toccare la rete si
 * scrive la riga in `app_notifications` — il vincolo unico su
 * (clientId, tipo, refId) è il lucchetto contro i doppioni, e regge anche
 * con due processi accesi insieme durante un deploy: il secondo trova la
 * riga (errore P2002) e si ferma lì.
 *
 * La riga si scrive anche quando la cliente non ha token: così il giro
 * successivo non riprova all'infinito, e il pannello vede comunque che
 * l'avviso c'è stato "in spirito".
 */

import { prisma } from '@/lib/prisma';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface NotificaDaInviare {
  clientId: string;
  /** es. 'promemoria-24h' | 'promemoria-2h' | 'waitlist' */
  tipo: string;
  /** L'oggetto dell'avviso (id appuntamento, desiderio…): chiave anti-doppione. */
  refId: string;
  titolo: string;
  corpo: string;
  /** Arriva all'app nel payload: es. { rotta: '/appuntamenti' } */
  dati?: Record<string, string>;
}

export type EsitoInvio = 'inviata' | 'doppione' | 'no-token' | 'errore';

/**
 * Che famiglia è questa notifica, per le preferenze della cliente.
 * I promemoria dei PROPRI appuntamenti e la chat non si spengono: sono
 * servizio, non pubblicità. Il resto sì, famiglia per famiglia.
 */
function famigliaDi(tipo: string): 'promo' | 'auguri' | 'occasioni' | null {
  if (tipo === 'post') return 'promo';
  if (tipo === 'compleanno') return 'auguri';
  if (['autopilot', 'drop', 'riattivazione'].includes(tipo)) return 'occasioni';
  return null; // promemoria-24h/2h, preparazione, waitlist, chat, percorso-creato…
}

export async function inviaNotifica(n: NotificaDaInviare): Promise<EsitoInvio> {
  // 0. Le preferenze della cliente: chi ha spento una famiglia non la riceve.
  //    Si controlla PRIMA del lucchetto: una riga "silenziata" nel registro
  //    bloccherebbe per sempre l'invio anche se lei riaccende domani.
  const famiglia = famigliaDi(n.tipo);
  if (famiglia) {
    const account = await prisma.mobileAccount.findUnique({
      where: { clientId: n.clientId },
      select: { notifichePreferenze: true },
    });
    const pref = account?.notifichePreferenze as Record<string, boolean> | null;
    if (pref && pref[famiglia] === false) return 'no-token';
  }

  // 1. Lucchetto: la riga nasce prima dell'invio.
  let rigaId: string;
  try {
    const riga = await prisma.appNotification.create({
      data: {
        clientId: n.clientId,
        tipo: n.tipo,
        refId: n.refId,
        titolo: n.titolo,
        corpo: n.corpo,
        dati: n.dati ?? {},
        inviataAt: new Date().toISOString(),
        esito: 'in-corso',
      },
    });
    rigaId = riga.id;
  } catch (err) {
    // P2002 = esiste già: qualcuno l'ha già mandata (o ci sta provando ora)
    if ((err as { code?: string })?.code === 'P2002') return 'doppione';
    throw err;
  }

  // 2. I telefoni della cliente.
  const tokens = await prisma.deviceToken.findMany({ where: { clientId: n.clientId } });
  if (tokens.length === 0) {
    await prisma.appNotification.update({ where: { id: rigaId }, data: { esito: 'no-token' } });
    return 'no-token';
  }

  // 3. Invio a Expo. Un solo blocco: una cliente ha 1-3 dispositivi, non 100.
  try {
    const risposta = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        tokens.map((t) => ({
          to: t.token,
          title: n.titolo,
          body: n.corpo,
          data: n.dati ?? {},
          sound: 'default',
        }))
      ),
    });
    const corpo = (await risposta.json().catch(() => null)) as
      | { data?: { status: string; details?: { error?: string } }[] }
      | null;

    // Token morti (app disinstallata): via subito, non riproveremo domani.
    const esiti = corpo?.data ?? [];
    for (let i = 0; i < esiti.length; i++) {
      if (esiti[i]?.details?.error === 'DeviceNotRegistered') {
        await prisma.deviceToken.delete({ where: { id: tokens[i].id } }).catch(() => null);
      }
    }

    const almenoUna = esiti.some((e) => e?.status === 'ok');
    await prisma.appNotification.update({
      where: { id: rigaId },
      data: { esito: almenoUna ? 'ok' : 'errore' },
    });
    return almenoUna ? 'inviata' : 'errore';
  } catch (err) {
    console.error('[push] invio fallito:', err);
    await prisma.appNotification.update({ where: { id: rigaId }, data: { esito: 'errore' } });
    return 'errore';
  }
}
