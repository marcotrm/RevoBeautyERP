/**
 * Il modulo dei percorsi di estetica: check-up, consulenze, percorsi
 * personalizzati, foto e riattivazione. Qui vivono le regole condivise
 * fra le API dell'app e il pannello — le route restano sottili.
 *
 * Tre principi non negoziabili, scritti una volta sola:
 * 1. niente diagnosi: il software raccoglie e mostra, le valutazioni le
 *    fa una persona;
 * 2. l'avanzamento è SOLO sedute fatte su pianificate, mai un
 *    "miglioramento" calcolato;
 * 3. quello che è interno (note, flag, foto senza consenso) non esce
 *    MAI dalle API mobile: il filtro sta qui, non nell'interfaccia.
 */

import { prisma } from '@/lib/prisma';
import { soloNome } from '@/lib/nomiPropri';
import type { PercorsoEstetico, SedutaPercorso, FotoPercorso } from '@prisma/client';

const adesso = () => new Date().toISOString();

/** Le aree fra cui la cliente sceglie nella consulenza digitale. */
export const AREE_CONSULENZA = [
  'Viso', 'Corpo', 'Depilazione', 'Cellulite', 'Tonicità', 'Rilassamento', 'Altro',
];

// ------------------------------------------------------------
// Check-up: le domande, configurabili dal pannello
// ------------------------------------------------------------

export interface DomandeCheckup {
  obiettivi: string[];
  aree: string[];
  abitudini: string[];
  /** Le condizioni che, se spuntate, chiedono l'occhio di un'operatrice. */
  condizioni: string[];
}

export const DOMANDE_DI_PARTENZA: DomandeCheckup = {
  obiettivi: [
    'Pelle più luminosa', 'Rassodare e tonificare', 'Ridurre la cellulite',
    'Depilazione duratura', 'Rilassarmi e ritrovare energia', 'Prendermi cura di me con costanza',
  ],
  aree: ['Viso', 'Corpo', 'Gambe', 'Addome', 'Braccia', 'Schiena', 'Mani e piedi'],
  abitudini: [
    'Bevo poca acqua', 'Passo molte ore in piedi', 'Passo molte ore seduta',
    'Faccio sport regolarmente', 'Mi espongo spesso al sole', 'Fumo',
  ],
  condizioni: [
    'Gravidanza o allattamento', 'Allergie o pelle molto reattiva',
    'Terapie farmacologiche in corso', 'Interventi recenti nella zona da trattare',
    'Patologie della pelle diagnosticate', 'Portatrice di pacemaker o protesi metalliche',
  ],
};

const CHIAVE_DOMANDE = 'checkup-domande';

export async function leggiDomandeCheckup(): Promise<DomandeCheckup> {
  const riga = await prisma.appSetting.findUnique({ where: { key: CHIAVE_DOMANDE } });
  const d = riga?.data as Partial<DomandeCheckup> | undefined;
  return {
    obiettivi: Array.isArray(d?.obiettivi) && d.obiettivi.length ? d.obiettivi : DOMANDE_DI_PARTENZA.obiettivi,
    aree: Array.isArray(d?.aree) && d.aree.length ? d.aree : DOMANDE_DI_PARTENZA.aree,
    abitudini: Array.isArray(d?.abitudini) && d.abitudini.length ? d.abitudini : DOMANDE_DI_PARTENZA.abitudini,
    condizioni: Array.isArray(d?.condizioni) && d.condizioni.length ? d.condizioni : DOMANDE_DI_PARTENZA.condizioni,
  };
}

export async function salvaDomandeCheckup(d: DomandeCheckup): Promise<void> {
  const pulisci = (v: unknown) =>
    (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 30);
  const dati: DomandeCheckup = {
    obiettivi: pulisci(d.obiettivi), aree: pulisci(d.aree),
    abitudini: pulisci(d.abitudini), condizioni: pulisci(d.condizioni),
  };
  await prisma.appSetting.upsert({
    where: { key: CHIAVE_DOMANDE },
    create: { key: CHIAVE_DOMANDE, data: dati as unknown as object, updatedAt: adesso() },
    update: { data: dati as unknown as object, updatedAt: adesso() },
  });
}

// ------------------------------------------------------------
// Consensi: revocabili, con il testo accettato salvato per sempre
// ------------------------------------------------------------

export const TESTI_CONSENSI: Record<string, string> = {
  'checkup':
    'Acconsento a che le risposte del check-up estetico siano conservate nella mia scheda '
    + 'e usate dal centro solo per costruire il mio percorso. Posso revocare quando voglio.',
  'foto-percorso':
    'Acconsento a che le fotografie del mio percorso siano conservate in un\'area privata, '
    + 'visibili solo a me e alle operatrici del centro. Non saranno pubblicate né condivise '
    + 'senza un mio consenso separato. Posso revocare quando voglio.',
  'riattivazione':
    'Acconsento a ricevere dal centro promemoria di cortesia se non prenoto da tempo. '
    + 'Posso disattivarli quando voglio.',
};

export type TipoConsenso = keyof typeof TESTI_CONSENSI;

export async function consensoAttivo(clientId: string, tipo: string): Promise<boolean> {
  const c = await prisma.consensoApp.findUnique({
    where: { clientId_tipo: { clientId, tipo } },
  });
  return Boolean(c?.concesso);
}

export async function impostaConsenso(clientId: string, tipo: string, concesso: boolean): Promise<void> {
  const testo = TESTI_CONSENSI[tipo];
  if (!testo) throw new Error(`Consenso sconosciuto: ${tipo}`);
  const ora = adesso();
  await prisma.consensoApp.upsert({
    where: { clientId_tipo: { clientId, tipo } },
    create: {
      clientId, tipo, concesso, testo,
      concessoIl: concesso ? ora : null, revocatoIl: concesso ? null : ora, updatedAt: ora,
    },
    update: concesso
      ? { concesso: true, testo, concessoIl: ora, revocatoIl: null, updatedAt: ora }
      : { concesso: false, revocatoIl: ora, updatedAt: ora },
  });
}

// ------------------------------------------------------------
// Audit: chi ha toccato cosa. Solo id, mai contenuti.
// ------------------------------------------------------------

export async function registraAccesso(
  chi: string, clientId: string | null, azione: string, dettaglio?: string
): Promise<void> {
  // Se l'audit fallisce non deve far fallire l'operazione: si registra, non si blocca.
  await prisma.accessoSensibile
    .create({ data: { chi, clientId, azione, dettaglio: dettaglio ?? null, createdAt: adesso() } })
    .catch(() => null);
}

// ------------------------------------------------------------
// La vista della cliente: il filtro sta QUI, una volta sola
// ------------------------------------------------------------

/** La seduta come la vede la cliente: solo se condivisa, mai le note interne. */
export function sedutaPerCliente(s: SedutaPercorso) {
  return {
    id: s.id,
    numero: s.numero,
    data: s.data,
    ora: s.ora,
    operatrice: soloNome(s.operatrice),
    trattamento: s.trattamento,
    area: s.area,
    durataMinuti: s.durataMinuti,
    osservazioni: s.condivisa ? s.osservazioni : null,
    indicazioniDopo: s.condivisa ? s.indicazioniDopo : null,
    misurazioni: s.condivisa ? s.misurazioni : null,
  };
}

export function fotoPerCliente(f: FotoPercorso) {
  return {
    id: f.id, area: f.area, immagine: f.immagine,
    scattataIl: f.scattataIl, origine: f.origine, sedutaId: f.sedutaId,
  };
}

/** Il percorso come lo vede la cliente: note interne fuori, avanzamento = sedute. */
export function percorsoPerCliente(
  p: PercorsoEstetico,
  sedute: SedutaPercorso[],
  foto: FotoPercorso[],
  conFoto: boolean,
) {
  const fatte = sedute.length;
  const tappe = (Array.isArray(p.tappe) ? p.tappe : []) as { titolo?: string; dopoSeduta?: number }[];
  return {
    id: p.id,
    nome: p.nome,
    descrizione: p.descrizione,
    obiettivo: p.obiettivo,
    trattamenti: p.trattamenti,
    seduteTotali: p.seduteTotali,
    seduteFatte: fatte,
    frequenza: p.frequenza,
    dataInizio: p.dataInizio,
    stato: p.stato,
    noteCliente: p.noteCliente,
    mantenimento: p.mantenimento,
    tappe: tappe
      .filter((t) => t.titolo)
      .map((t) => ({
        titolo: String(t.titolo),
        dopoSeduta: Number(t.dopoSeduta) || 0,
        raggiunta: fatte >= (Number(t.dopoSeduta) || 0),
      })),
    sedute: sedute.map(sedutaPerCliente),
    foto: conFoto ? foto.map(fotoPerCliente) : [],
    fotoTotali: foto.length,
  };
}

// ------------------------------------------------------------
// Preparazione al trattamento
// ------------------------------------------------------------

export interface PreTrattamento {
  comePrepararsi: string;
  cosaEvitare: string;
  cosaPortare: string;
  oreAnticipo: number;
  avvertenze: string;
}

/** Legge e valida il JSON `preTrattamento` di un trattamento. */
export function leggiPreTrattamento(raw: unknown): PreTrattamento | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<PreTrattamento>;
  const testo = (v: unknown) => String(v ?? '').trim();
  const dati: PreTrattamento = {
    comePrepararsi: testo(p.comePrepararsi),
    cosaEvitare: testo(p.cosaEvitare),
    cosaPortare: testo(p.cosaPortare),
    oreAnticipo: Math.max(0, Math.min(168, Number(p.oreAnticipo) || 0)),
    avvertenze: testo(p.avvertenze),
  };
  const vuoto = !dati.comePrepararsi && !dati.cosaEvitare && !dati.cosaPortare && !dati.avvertenze;
  return vuoto ? null : dati;
}

// ------------------------------------------------------------
// Riattivazione: il sistema propone, una persona decide
// ------------------------------------------------------------

const GIORNO = 86400000;
/** Quanto deve passare prima di riproporre la stessa cliente. */
const GIORNI_DI_PACE = 60;

/**
 * Rigenera la coda delle proposte di riattivazione. Idempotente: una cliente
 * già in coda (o contattata/scartata di recente) non viene riproposta.
 * Non invia NULLA: riempie solo l'elenco che l'operatrice approva a mano.
 */
export async function generaRiattivazioni(): Promise<{ nuove: number }> {
  // Import qui per evitare cicli: churn usa prisma, non estetica.
  const { clientiARischio } = await import('@/lib/engines/churn');

  const recenti = await prisma.riattivazioneProposta.findMany({
    where: { createdAt: { gte: new Date(Date.now() - GIORNI_DI_PACE * GIORNO).toISOString() } },
    select: { clientId: true },
  });
  const inPace = new Set(recenti.map((r) => r.clientId));
  const aperte = await prisma.riattivazioneProposta.findMany({
    where: { stato: 'proposta' },
    select: { clientId: true },
  });
  for (const a of aperte) inPace.add(a.clientId);

  let nuove = 0;
  const ora = adesso();

  // 1) Il ritmo interrotto: la cliente veniva ogni X giorni e non si vede.
  const aRischio = await clientiARischio();
  for (const c of aRischio) {
    if (inPace.has(c.clientId)) continue;
    if (!(await consensoOkPerRiattivazione(c.clientId))) continue;
    await prisma.riattivazioneProposta.create({
      data: {
        clientId: c.clientId, nome: c.nome, motivo: 'ritmo-interrotto',
        dettaglio: `Veniva ogni ${c.ritmoGiorni} giorni, non si vede da ${c.giorniDaUltima}.`,
        messaggio: `Ciao! È un po' che non ci vediamo 💛 Se ti va, possiamo fissare un controllo o una consulenza senza impegno: ci farebbe piacere rivederti.`,
        stato: 'proposta', createdAt: ora,
      },
    });
    inPace.add(c.clientId);
    nuove++;
  }

  // 2) Il percorso interrotto: sedute rimaste a metà.
  const interrotti = await prisma.percorsoEstetico.findMany({
    where: { stato: { in: ['in_pausa', 'interrotto'] } },
    select: { clientId: true, clientName: true, nome: true, seduteTotali: true, sedute: { select: { id: true } } },
  });
  for (const p of interrotti) {
    if (inPace.has(p.clientId)) continue;
    if (!(await consensoOkPerRiattivazione(p.clientId))) continue;
    await prisma.riattivazioneProposta.create({
      data: {
        clientId: p.clientId, nome: p.clientName, motivo: 'percorso-interrotto',
        dettaglio: `Percorso «${p.nome}» fermo a ${p.sedute.length} sedute su ${p.seduteTotali}.`,
        messaggio: `Ciao! Il tuo percorso «${p.nome}» è rimasto a metà: se ti va di riprenderlo, o anche solo di parlarne, scrivici quando vuoi 💛`,
        stato: 'proposta', createdAt: ora,
      },
    });
    inPace.add(p.clientId);
    nuove++;
  }

  // 3) Il mantenimento mai partito: percorso completato con un piano, ma
  //    nessun appuntamento futuro in agenda.
  const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const completati = await prisma.percorsoEstetico.findMany({
    where: { stato: 'completato', mantenimento: { not: null } },
    select: { clientId: true, clientName: true, nome: true, mantenimento: true },
  });
  for (const p of completati) {
    if (inPace.has(p.clientId)) continue;
    const futuro = await prisma.appointment.findFirst({
      where: { clientId: p.clientId, date: { gte: oggi }, status: { in: ['confirmed', 'pending'] } },
      select: { id: true },
    });
    if (futuro) continue;
    if (!(await consensoOkPerRiattivazione(p.clientId))) continue;
    await prisma.riattivazioneProposta.create({
      data: {
        clientId: p.clientId, nome: p.clientName, motivo: 'mantenimento',
        dettaglio: `Percorso «${p.nome}» completato; piano di mantenimento previsto ma nessuna prenotazione.`,
        messaggio: `Ciao! Hai completato il percorso «${p.nome}» 🎉 Per non perdere quello che hai costruito, ti va di fissare la seduta di mantenimento?`,
        stato: 'proposta', createdAt: ora,
      },
    });
    inPace.add(p.clientId);
    nuove++;
  }

  return { nuove };
}

/**
 * Il consenso alla riattivazione: chi l'ha revocato esplicitamente non entra
 * in coda. Chi non si è mai espresso entra (l'invio resta comunque una
 * decisione umana, e il messaggio contiene come disattivarsi).
 */
async function consensoOkPerRiattivazione(clientId: string): Promise<boolean> {
  const c = await prisma.consensoApp.findUnique({
    where: { clientId_tipo: { clientId, tipo: 'riattivazione' } },
  });
  return c ? c.concesso : true;
}
