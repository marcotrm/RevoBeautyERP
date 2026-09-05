'use server';

/**
 * La postazione: il tablet del centro, con due modalita' separate.
 *
 * Lo stesso dispositivo passa di mano decine di volte al giorno — l'operatrice
 * lo usa per la scheda della seduta, la cliente per firmare o fare il
 * check-in — e le due cose non possono vedere le stesse informazioni. Non e'
 * una questione di menu piu' corti: chi tiene il tablet mentre aspetta non
 * deve poter arrivare all'agenda, ai numeri di telefono o alla scheda della
 * persona di prima.
 *
 * Tre stati, e si passa dall'uno all'altro solo da qui:
 *
 *  - POSTAZIONE: nessuno l'ha in mano. Si vede solo il nome del centro.
 *  - CLIENTE: una persona identificata, per il tempo di fare la sua cosa. La
 *    sessione porta dentro il suo id: le pagine non lo chiedono e non lo
 *    accettano da fuori, cosi' cambiare un numero nell'indirizzo non porta da
 *    nessuna parte.
 *  - OPERATRICE: si entra con le proprie credenziali, come nel gestionale.
 *    Non c'e' nessuna scorciatoia nascosta — un tasto segreto lo trova
 *    chiunque tenga premuto a caso, e su un tablet che gira in sala d'attesa
 *    e' questione di giorni.
 *
 * Il dispositivo, per contare come postazione, deve conoscere la chiave gia'
 * usata dal tablet della firma: e' la stessa, si genera in Impostazioni e si
 * rigenera se il tablet si perde.
 */

import { prisma } from '@/lib/prisma';
import { authenticate } from '@/app/actions/accounts';
import { apriSessione, chiudiSessione, sessioneCorrente, operatriceCorrente } from '@/lib/sessione';

const RIGA_CHIAVE = 'integration:tablet';

/** Di serie: mezz'ora di inattivita' e la sessione della cliente finisce. */
const TIMEOUT_MINUTI_DEFAULT = 5;

interface DatiTablet {
  chiave: string;
  creata: string;
  ultimoContatto?: string;
  /** Dopo quanti minuti senza toccare lo schermo si torna alla schermata iniziale. */
  timeoutMinuti?: number;
}

async function datiTablet(): Promise<DatiTablet | null> {
  const r = await prisma.adminEntry.findUnique({ where: { rowId: RIGA_CHIAVE } });
  const d = (r?.data || null) as DatiTablet | null;
  return d?.chiave ? d : null;
}

/** La chiave del dispositivo e' quella del centro? */
async function chiaveValida(chiave: string): Promise<boolean> {
  const d = await datiTablet();
  return Boolean(d && chiave && d.chiave === chiave);
}

export interface StatoPostazione {
  /** Il dispositivo e' riconosciuto come postazione del centro. */
  autorizzata: boolean;
  modalita: 'postazione' | 'cliente' | 'operatrice';
  /** In modalita' operatrice: chi sta lavorando. */
  operatrice?: string;
  ruolo?: string;
  /** In modalita' cliente: solo il suo nome, niente altro. */
  cliente?: string;
  clientId?: string;
  appointmentId?: string;
  /** Minuti di inattivita' dopo i quali la sessione cliente si chiude. */
  timeoutMinuti: number;
}

/**
 * Che cosa e' aperto adesso su questo dispositivo.
 *
 * Torna il minimo indispensabile: in modalita' cliente il nome e basta. Tutto
 * il resto lo chiedono le pagine, una alla volta, e ognuna verifica da capo
 * chi sta chiedendo.
 */
export async function statoPostazione(chiave: string): Promise<StatoPostazione> {
  const d = await datiTablet();
  const autorizzata = Boolean(d && chiave && d.chiave === chiave);
  const timeoutMinuti = Math.max(1, Number(d?.timeoutMinuti) || TIMEOUT_MINUTI_DEFAULT);
  if (!autorizzata) return { autorizzata: false, modalita: 'postazione', timeoutMinuti };

  const s = await sessioneCorrente();
  if (s?.tipo === 'operatrice') {
    return { autorizzata, modalita: 'operatrice', operatrice: s.nome, ruolo: s.roleId, timeoutMinuti };
  }
  if (s?.tipo === 'cliente-tablet' && s.clientId) {
    return {
      autorizzata, modalita: 'cliente', cliente: s.nome,
      clientId: s.clientId, appointmentId: s.appointmentId, timeoutMinuti,
    };
  }
  return { autorizzata, modalita: 'postazione', timeoutMinuti };
}

/**
 * L'operatrice entra sul tablet con le sue credenziali.
 *
 * Le stesse del gestionale: un account per persona, come chiedono le regole e
 * come serve quando bisogna sapere chi ha scritto una cosa. La chiave del
 * dispositivo si controlla lo stesso — una password rubata non deve bastare a
 * far diventare postazione il telefono di qualcun altro.
 */
export async function entraComeOperatrice(
  chiave: string, email: string, password: string,
): Promise<{ ok: boolean; errore?: string; nome?: string }> {
  if (!(await chiaveValida(chiave))) {
    return { ok: false, errore: 'Questo dispositivo non è collegato al centro.' };
  }
  const acc = await authenticate(email, password);
  if (!acc) return { ok: false, errore: 'Email o password non corrette.' };
  // `authenticate` ha gia' aperto la sessione da operatrice.
  return { ok: true, nome: `${acc.firstName} ${acc.lastName}`.trim() };
}

/**
 * Il tablet passa in mano alla cliente.
 *
 * Lo decide l'operatrice, che e' l'unica a poter scegliere di chi si tratta:
 * da qui in avanti la sessione porta dentro quell'unica scheda, e la modalita'
 * operatrice si chiude. Per tornare indietro serve rifare l'accesso.
 */
export async function passaAllaCliente(dati: {
  chiave: string;
  clientId: string;
  appointmentId?: string;
}): Promise<{ ok: boolean; errore?: string; cliente?: string }> {
  if (!(await chiaveValida(dati.chiave))) {
    return { ok: false, errore: 'Questo dispositivo non è collegato al centro.' };
  }
  try {
    await operatriceCorrente();
  } catch {
    return { ok: false, errore: 'Serve una sessione da operatrice per passare il tablet.' };
  }

  const c = await prisma.client.findUnique({
    where: { id: dati.clientId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!c) return { ok: false, errore: 'Cliente non trovata.' };

  const nome = `${c.firstName} ${c.lastName}`.trim();
  await apriSessione({
    tipo: 'cliente-tablet',
    clientId: c.id,
    appointmentId: dati.appointmentId,
    nome,
  });
  return { ok: true, cliente: nome };
}

/**
 * Fine: si torna alla schermata iniziale e non resta niente.
 *
 * Si chiama quando la cliente ha finito, quando scade il tempo di inattivita'
 * e quando qualcuno preme «ho finito». La sessione si cancella qui: la pagina
 * poi butta anche il suo stato, ma la difesa vera e' questa, perche' e'
 * l'unica che vale anche se il browser resta aperto sulla stessa schermata.
 */
export async function chiudiPostazione(): Promise<{ ok: boolean }> {
  await chiudiSessione();
  return { ok: true };
}

/** Il tempo di inattivita', deciso dal centro in Impostazioni. */
export async function salvaTimeoutPostazione(minuti: number): Promise<{ ok: boolean }> {
  await operatriceCorrente();
  const d = await datiTablet();
  if (!d) return { ok: false };
  await prisma.adminEntry.update({
    where: { rowId: RIGA_CHIAVE },
    data: { data: { ...d, timeoutMinuti: Math.max(1, Math.min(60, Math.round(minuti))) } as unknown as object },
  });
  return { ok: true };
}

// ============================================================
// Chi c'e' oggi, e come si trova una cliente dal tablet.
// Servono solo in modalita' operatrice: la modalita' cliente non deve poter
// cercare nessuno, ed e' il motivo per cui queste due chiedono la sessione
// prima di guardare qualsiasi cosa.
// ============================================================

export interface RigaOggi {
  appointmentId: string;
  clientId: string;
  cliente: string;
  ora: string;
  trattamento: string;
  operatrice: string;
  stato: string;
  /** Vero se e' gia' entrata in cabina: al banco non serve piu'. */
  giaDentro: boolean;
}

/** Gli appuntamenti di oggi: e' la lista che serve davvero al banco. */
export async function appuntamentiDiOggi(): Promise<RigaOggi[]> {
  await operatriceCorrente();
  const oggi = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
  const righe = await prisma.appointment.findMany({
    where: { date: oggi, status: { notIn: ['cancelled', 'no_show'] } },
    orderBy: { startTime: 'asc' },
    select: {
      id: true, clientId: true, clientName: true, startTime: true,
      treatmentName: true, operatorName: true, status: true,
    },
  });
  return righe.map(a => ({
    appointmentId: a.id,
    clientId: a.clientId,
    cliente: a.clientName,
    ora: a.startTime,
    trattamento: a.treatmentName,
    operatrice: a.operatorName,
    stato: a.status,
    giaDentro: a.status === 'in_cabin' || a.status === 'in_progress' || a.status === 'completed',
  }));
}

export interface RigaCliente {
  clientId: string;
  nome: string;
  /** Solo le ultime tre cifre: serve a distinguere due omonime, non a leggere la rubrica. */
  telefonoCoda: string;
}

/**
 * La ricerca dal tablet, volutamente povera.
 *
 * Torna nome e le ultime tre cifre del numero: bastano a capire quale delle
 * due Maria Esposito e' quella davanti, e non fanno del tablet una rubrica da
 * sfogliare. Serve almeno mezza parola: senza filtro non si scarica l'elenco.
 */
export async function cercaClienteDaTablet(q: string): Promise<RigaCliente[]> {
  await operatriceCorrente();
  const testo = q.trim();
  if (testo.length < 2) return [];
  const righe = await prisma.client.findMany({
    where: {
      OR: [
        { firstName: { contains: testo, mode: 'insensitive' } },
        { lastName: { contains: testo, mode: 'insensitive' } },
        { phone: { contains: testo } },
      ],
    },
    orderBy: [{ lastName: 'asc' }],
    take: 12,
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  return righe.map(c => ({
    clientId: c.id,
    nome: `${c.firstName} ${c.lastName}`.trim(),
    telefonoCoda: (c.phone || '').slice(-3),
  }));
}
