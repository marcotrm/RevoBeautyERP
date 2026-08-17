/**
 * "Esporta tutto": i dati del centro in un foglio Excel.
 *
 * Non è una funzione da gestionale, è una garanzia. Finché i dati stanno solo
 * dentro a un database su un server, chi ha il centro non li ha in mano: se
 * domani cambia gestionale, se il servizio si ferma, se il commercialista
 * chiede l'elenco degli incassi, non c'è niente da prendere. Con un file
 * scaricabile in ogni momento quel problema non esiste.
 *
 * Un foglio per cosa, i nomi delle colonne in italiano come si leggono a
 * schermo: chi lo apre non deve sapere com'è fatto il database.
 */

import { prisma } from '@/lib/prisma';

/** Un foglio del file: nome della scheda e righe già pronte da scrivere. */
export interface Foglio {
  nome: string;
  righe: Record<string, string | number>[];
}

/** Data ISO → 13/08/2026, che è come si legge un foglio in Italia. */
function dataIt(iso?: string | null): string {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [a, m, g] = s.split('-');
  return `${g}/${m}/${a}`;
}

function si(v: boolean): string {
  return v ? 'sì' : 'no';
}

/**
 * Le righe di un incasso, leggibili: "Acrygel, Pedicure".
 *
 * In archivio `items` è a volte un elenco di nomi ("sopracciglia") e a volte
 * di oggetti con nome e quantità, secondo l'epoca in cui la vendita è stata
 * registrata. Vanno gestiti tutti e due, altrimenti mezza colonna esce vuota.
 */
function descriviRighe(items: unknown): string {
  if (!Array.isArray(items)) return '';
  return (items as unknown[])
    .map(i => {
      if (typeof i === 'string') return i;
      const r = i as { name?: string; treatmentName?: string; productName?: string; qty?: number } | null;
      const nome = r?.name || r?.treatmentName || r?.productName || '';
      return r?.qty && r.qty > 1 ? `${nome} x${r.qty}` : nome;
    })
    .filter(Boolean)
    .join(', ');
}

function statoScontrino(t: { c95Emitted: boolean; c95Status: string | null; total: number }): string {
  if (t.total < 0) return 'reso';
  if (t.c95Status === 'voided') return 'annullato';
  if (t.c95Emitted) return 'emesso';
  if (t.c95Status === 'uncertain') return 'esito incerto';
  return 'non emesso';
}

export interface PeriodoExport {
  /** Data ISO di inizio, compresa. Vuota = dall'inizio. */
  da?: string;
  /** Data ISO di fine, compresa. Vuota = fino a oggi. */
  a?: string;
}

/**
 * Prepara tutti i fogli.
 *
 * Il periodo vale su quello che ha una data di accadimento — appuntamenti e
 * incassi. Anagrafica, magazzino, pacchetti e buoni escono sempre interi: sono
 * lo stato di adesso, tagliarli per data li renderebbe solo incompleti.
 */
export async function fogliExport(periodo: PeriodoExport = {}): Promise<Foglio[]> {
  const da = periodo.da || '0000-01-01';
  const a = periodo.a || '9999-12-31';

  const [clienti, appuntamenti, incassi, prodotti, pacchetti, buoni] = await Promise.all([
    prisma.client.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    prisma.appointment.findMany({ where: { date: { gte: da, lte: a } }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] }),
    prisma.posTransaction.findMany({ where: { date: { gte: da, lte: a } }, orderBy: [{ date: 'asc' }, { time: 'asc' }] }),
    prisma.product.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    prisma.clientPackage.findMany({ orderBy: { purchaseDate: 'desc' } }),
    prisma.giftCard.findMany({ orderBy: { purchaseDate: 'desc' } }),
  ]);

  return [
    {
      nome: 'Clienti',
      righe: clienti.map(c => ({
        Nome: c.firstName,
        Cognome: c.lastName,
        Telefono: c.phone,
        Email: c.email || '',
        'Data di nascita': dataIt(c.birthDate),
        Sesso: c.gender || '',
        Indirizzo: c.address || '',
        Città: c.city || '',
        'Consenso messaggi': si(c.marketingConsent),
        Etichette: (c.tags || []).join(', '),
        'Cliente dal': dataIt(c.createdAt),
        'Ultima visita': dataIt(c.lastVisit),
        Visite: c.visitCount,
        'Totale speso': c.totalSpent,
        'Scontrino medio': c.avgTicket,
        'Punti fedeltà': c.loyaltyPoints,
        Note: c.notes || '',
      })),
    },
    {
      nome: 'Appuntamenti',
      righe: appuntamenti.map(ap => ({
        Data: dataIt(ap.date),
        Dalle: ap.startTime,
        Alle: ap.endTime,
        Cliente: ap.clientName,
        Trattamento: ap.treatmentName,
        Operatrice: ap.operatorName,
        Stato: ap.status,
        Minuti: ap.duration,
        Prezzo: ap.price,
        'Motivo disdetta': ap.cancelReason || '',
        Note: ap.notes || '',
      })),
    },
    {
      nome: 'Incassi',
      righe: incassi.map(t => ({
        Data: dataIt(t.date),
        Ora: t.time,
        Cliente: t.clientName || 'Cliente occasionale',
        Righe: descriviRighe(t.items),
        Totale: t.total,
        Pagamento: t.paymentMethod,
        Operatrice: t.operator,
        Scontrino: statoScontrino(t),
        'Numero documento': t.c95Progressivo || '',
      })),
    },
    {
      nome: 'Magazzino',
      righe: prodotti.map(p => ({
        Prodotto: p.name,
        Marca: p.brand,
        Categoria: p.category,
        Codice: p.sku,
        Giacenza: p.stock,
        'Scorta minima': p.minStock,
        'Prezzo acquisto': p.costPrice,
        'Prezzo vendita': p.price,
        'Valore a magazzino': Math.round(p.stock * p.costPrice * 100) / 100,
        Attivo: si(p.isActive),
      })),
    },
    {
      nome: 'Pacchetti',
      righe: pacchetti.map(p => ({
        Cliente: p.clientName,
        Pacchetto: p.packageName,
        Acquistato: dataIt(p.purchaseDate),
        Scadenza: dataIt(p.expiryDate),
        'Sedute totali': p.totalSessions,
        'Sedute usate': p.usedSessions,
        'Sedute rimaste': Math.max(0, p.totalSessions - p.usedSessions),
        Prezzo: p.pricePaid,
        Pagato: p.totalPaid,
        'Ancora da pagare': p.remainingBalance,
        Stato: p.status,
      })),
    },
    {
      nome: 'Buoni regalo',
      righe: buoni.map(b => ({
        Codice: b.code,
        'Comprato da': b.purchasedBy,
        Intestato: b.recipientName,
        Telefono: b.recipientPhone || '',
        Importo: b.amount,
        Residuo: b.remainingBalance,
        Emesso: dataIt(b.purchaseDate),
        Scadenza: dataIt(b.expiryDate),
        Pagamento: b.paymentMethod,
        Stato: b.status,
      })),
    },
  ];
}

/*
  Il permesso di scaricare.

  Il file contiene nome, telefono, indirizzo e data di nascita di tutte le
  clienti: un indirizzo che risponde a chiunque lo digiti sarebbe una fuga di
  dati, non una funzione. E non basta un indirizzo difficile da indovinare —
  finirebbe nella cronologia, in un messaggio, nei log di qualche proxy.

  Quindi: chi ha il gestionale aperto chiede un permesso, valido cinque minuti
  e una volta sola. Il link scaricato ieri oggi non apre più niente.
*/

const KIND_TOKEN = 'export_token';
const VALIDO_MINUTI = 5;

function rigaToken(token: string): string {
  return `export:token:${token}`;
}

/** Crea il permesso usa-e-getta e restituisce il token da mettere nel link. */
export async function creaTokenExport(periodo: PeriodoExport = {}): Promise<string> {
  const token = crypto.randomUUID().replaceAll('-', '');
  const adesso = new Date();
  await prisma.adminEntry.create({
    data: {
      rowId: rigaToken(token),
      kind: KIND_TOKEN,
      entityId: token,
      // Prisma vuole un oggetto JSON semplice: PeriodoExport ha campi
      // facoltativi e non passa il controllo, quindi si appiattisce qui.
      data: {
        da: periodo.da ?? null,
        a: periodo.a ?? null,
        scade: new Date(adesso.getTime() + VALIDO_MINUTI * 60_000).toISOString(),
        usato: false,
      } as object,
      createdAt: adesso.toISOString(),
    },
  });
  return token;
}

/**
 * Verifica il permesso e lo brucia. Torna il periodo richiesto quando è
 * valido, `null` in tutti gli altri casi (mai esistito, scaduto, già usato).
 */
export async function consumaTokenExport(token: string): Promise<PeriodoExport | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const riga = await prisma.adminEntry.findUnique({ where: { rowId: rigaToken(token) } });
  if (!riga) return null;

  const d = (riga.data || {}) as { da?: string | null; a?: string | null; scade?: string; usato?: boolean };
  if (d.usato) return null;
  if (!d.scade || Date.parse(d.scade) < Date.now()) return null;

  // Bruciato subito: se il download si interrompe si chiede un permesso nuovo,
  // che costa un clic. Riusarlo costerebbe molto di più.
  await prisma.adminEntry.update({
    where: { rowId: rigaToken(token) },
    data: { data: { ...d, usato: true, usatoIl: new Date().toISOString() } as object },
  });
  return { da: d.da || undefined, a: d.a || undefined };
}

/** Nome del file, con dentro il periodo: due export non si confondono. */
export function nomeFile(periodo: PeriodoExport = {}): string {
  const pezzo = periodo.da || periodo.a
    ? `${(periodo.da || 'inizio').replaceAll('-', '')}-${(periodo.a || 'oggi').replaceAll('-', '')}`
    : 'tutto';
  return `revobeauty-${pezzo}.xlsx`;
}
