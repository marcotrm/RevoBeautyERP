/**
 * Capire se un appuntamento è coperto da un pacchetto già pagato.
 *
 * In agenda un trattamento incluso in un pacchetto ha prezzo 0, perché la
 * cliente ha già pagato: senza una scritta accanto, però, "0,00 €" si legge
 * come "gratis" o come un errore di listino. Qui si ricostruisce il legame —
 * che nel database non esiste — e si ottiene la frase da mostrare, con le
 * sedute che restano.
 *
 * Il collegamento è per nome, perché l'appuntamento non porta l'id del
 * pacchetto: prima si prova a far combaciare il nome del trattamento con
 * quello del pacchetto; se non combacia e la cliente ha un solo pacchetto
 * aperto, è quello. Se ne ha più di uno e nessuno combacia non si indovina:
 * meglio nessuna scritta che una sbagliata.
 */

const norm = (s: string | null | undefined) =>
  (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

export interface PacchettoCliente {
  clientId?: string | null;
  clientName: string;
  packageName: string;
  totalSessions: number;
  usedSessions: number;
  status: string;
}

export interface Copertura {
  packageName: string;
  rimaste: number;
  totali: number;
  /** Testo pronto: "Scalata dal pacchetto · 3 sedute rimaste" */
  etichetta: string;
}

export function coperturaPacchetto(
  appuntamento: { clientId?: string | null; clientName?: string; treatmentName?: string; price?: number },
  pacchetti: PacchettoCliente[],
): Copertura | null {
  // Se il trattamento ha un prezzo, la cliente lo paga: non c'è nulla da scalare
  if ((appuntamento.price ?? 0) > 0) return null;

  const suoi = pacchetti.filter(p => {
    if (p.status !== 'active') return false;
    if (p.totalSessions - p.usedSessions <= 0) return false;
    return appuntamento.clientId && p.clientId
      ? p.clientId === appuntamento.clientId
      : norm(p.clientName) === norm(appuntamento.clientName);
  });
  if (!suoi.length) return null;

  const tratt = norm(appuntamento.treatmentName);
  const combacia = suoi.find(p => {
    const nome = norm(p.packageName);
    return !!tratt && (nome.includes(tratt) || tratt.includes(nome));
  });

  const scelto = combacia || (suoi.length === 1 ? suoi[0] : null);
  if (!scelto) return null;

  const rimaste = scelto.totalSessions - scelto.usedSessions;
  return {
    packageName: scelto.packageName,
    rimaste,
    totali: scelto.totalSessions,
    etichetta: `Scalata dal pacchetto · ${rimaste} ${rimaste === 1 ? 'seduta rimasta' : 'sedute rimaste'}`,
  };
}
