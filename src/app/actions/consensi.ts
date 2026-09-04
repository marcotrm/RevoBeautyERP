'use server';

/**
 * Tutti i consensi firmati, in un posto solo.
 *
 * Finora un consenso si poteva guardare solo aprendo la scheda di quella
 * cliente: per sapere chi ce l'aveva e chi no bisognava aprirle una per una,
 * quattrocentotrentacinque volte. Cosi' non lo sapeva nessuno.
 *
 * La domanda che conta pero' non e' «chi ha firmato»: e' il suo contrario —
 * chi ha fatto una seduta laser SENZA aver firmato niente. Quello e' l'elenco
 * che va guardato, ed e' l'ultima cosa in fondo a questa pagina.
 */

import { prisma } from '@/lib/prisma';
import { DOMANDE_STORICO } from '@/lib/consensoLaserTesto';

const TITOLO = 'Consenso Laser/Epilazione';

export interface ConsensoInElenco {
  id: string;
  clientId: string;
  cliente: string;
  quando: string;
  titolo: string;
  laser: boolean;
  /** Le zone concordate, se scritte. */
  zone?: string;
  /** Ha allegato un documento? */
  conDocumento: boolean;
  /** Cose dichiarate che vanno guardate prima della seduta. */
  daGuardare: string[];
}

/** I consensi firmati, dal piu' recente. Si cerca per nome della cliente. */
export async function elencoConsensi(cerca = ''): Promise<ConsensoInElenco[]> {
  const q = cerca.trim().toLowerCase();
  const righe = await prisma.clientConsent.findMany({
    orderBy: { signedAt: 'desc' },
    take: 500,
    select: {
      id: true, clientId: true, title: true, signedAt: true, data: true,
      client: { select: { firstName: true, lastName: true } },
    },
  });

  const daGuardare = new Set(['ormonale', 'farmaci', 'herpes']);
  const testoDi = new Map(DOMANDE_STORICO.map(d => [d.id, d.testo]));

  return righe
    .map(r => {
      const d = (r.data || {}) as { zone?: string; eraLaser?: boolean; storico?: Record<string, string>; documento?: { numero?: string } | null };
      const storico = d.storico || {};
      const avvisi: string[] = [];
      for (const [id, v] of Object.entries(storico)) {
        if (daGuardare.has(id) && v === 'si') avvisi.push(testoDi.get(id) || id);
      }
      // La dichiarazione sulla gravidanza vale al contrario: e' un «NON sono»,
      // quindi la cosa da guardare e' quando NON e' stata confermata.
      if (storico.gravidanza && storico.gravidanza !== 'si') avvisi.push('Gravidanza non esclusa');

      return {
        id: r.id,
        clientId: r.clientId,
        cliente: `${r.client?.firstName || ''} ${r.client?.lastName || ''}`.trim() || 'Cliente eliminata',
        quando: r.signedAt,
        titolo: r.title,
        laser: Boolean(d.eraLaser) || /laser|epilazione/i.test(r.title),
        zone: d.zone,
        conDocumento: Boolean(d.documento?.numero),
        daGuardare: avvisi,
      };
    })
    .filter(c => !q || c.cliente.toLowerCase().includes(q));
}

export interface SedutaSenzaConsenso {
  clientId: string;
  cliente: string;
  quando: string;
  trattamento: string;
  operatrice: string;
}

export interface RiepilogoConsensi {
  totale: number;
  clientiConConsenso: number;
  conDocumento: number;
  daGuardare: number;
  /** Chi ha fatto il laser senza aver mai firmato: e' la lista che conta. */
  senzaConsenso: SedutaSenzaConsenso[];
}

export async function riepilogoConsensi(): Promise<RiepilogoConsensi> {
  const [consensi, sedute] = await Promise.all([
    prisma.clientConsent.findMany({ select: { clientId: true, title: true, data: true } }),
    /*
      Le sedute laser fatte davvero, negli ultimi sei mesi.

      Piu' indietro non serve: il consenso di due anni fa non lo si va a
      rincorrere piu', e una lista lunga non la guarda nessuno.
    */
    prisma.appointment.findMany({
      where: {
        status: 'completed',
        date: { gte: new Date(Date.now() - 182 * 86_400_000).toISOString().slice(0, 10) },
      },
      select: {
        clientId: true, clientName: true, date: true, startTime: true,
        treatmentName: true, treatmentCategory: true, operatorName: true, services: true,
      },
      orderBy: { date: 'desc' },
    }),
  ]);

  const conConsenso = new Set(
    consensi
      .filter(c => c.title === TITOLO || /laser|epilazione/i.test(c.title))
      .map(c => c.clientId),
  );

  const eLaser = (a: { treatmentName: string; treatmentCategory: string; services: unknown }) => {
    if (a.treatmentCategory === 'laser' || /laser/i.test(a.treatmentName)) return true;
    const sv = Array.isArray(a.services) ? (a.services as { treatmentName?: string; treatmentCategory?: string }[]) : [];
    return sv.some(s => s?.treatmentCategory === 'laser' || /laser/i.test(s?.treatmentName || ''));
  };

  // Una riga per cliente, la seduta piu' recente: l'elenco serve a chiamarla,
  // non a contare quante volte e' successo.
  const viste = new Set<string>();
  const senzaConsenso: SedutaSenzaConsenso[] = [];
  for (const a of sedute) {
    if (!eLaser(a) || conConsenso.has(a.clientId) || viste.has(a.clientId)) continue;
    viste.add(a.clientId);
    senzaConsenso.push({
      clientId: a.clientId,
      cliente: a.clientName,
      quando: `${a.date} ${a.startTime}`,
      trattamento: a.treatmentName,
      operatrice: a.operatorName,
    });
  }

  const daGuardare = new Set(['ormonale', 'farmaci', 'herpes']);
  const conAvvisi = consensi.filter(c => {
    const st = ((c.data || {}) as { storico?: Record<string, string> }).storico || {};
    return Object.entries(st).some(([id, v]) => daGuardare.has(id) && v === 'si')
      || (st.gravidanza && st.gravidanza !== 'si');
  }).length;

  return {
    totale: consensi.length,
    clientiConConsenso: new Set(consensi.map(c => c.clientId)).size,
    conDocumento: consensi.filter(c => Boolean(((c.data || {}) as { documento?: { numero?: string } }).documento?.numero)).length,
    daGuardare: conAvvisi,
    senzaConsenso,
  };
}

/** Un consenso per intero, per riaprirlo dall'elenco senza passare dalla scheda. */
export async function consensoPerId(id: string): Promise<{
  id: string; title: string; signedAt: string; notes: string | null;
  signatureData: string | null; data: unknown; clientId: string; cliente: string;
} | null> {
  const c = await prisma.clientConsent.findUnique({
    where: { id },
    select: {
      id: true, title: true, signedAt: true, notes: true, signatureData: true, data: true,
      clientId: true, client: { select: { firstName: true, lastName: true } },
    },
  });
  if (!c) return null;
  return {
    id: c.id, title: c.title, signedAt: c.signedAt, notes: c.notes,
    signatureData: c.signatureData, data: c.data, clientId: c.clientId,
    cliente: `${c.client?.firstName || ''} ${c.client?.lastName || ''}`.trim(),
  };
}
