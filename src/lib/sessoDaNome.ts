/**
 * Indovinare il sesso dal nome di battesimo.
 *
 * Serve perché in anagrafica il campo sesso è spesso vuoto (una scheda su tre):
 * senza, una campagna rivolta alle sole donne lascerebbe fuori decine di
 * clienti vere. Sui nomi italiani la desinenza è un indizio forte — in -a
 * femminile, in -o maschile — ma le eccezioni sono tante e famose (Andrea,
 * Luca, Mattia sono uomini; Alice, Agnese, Irene sono donne), quindi le liste
 * vengono prima della regola.
 *
 * È una stima, non un dato: chi non rientra in nessuna delle due resta
 * `null`. Meglio dire "non lo so" che scrivere "signora" a un uomo.
 */

/** Uomini col nome che finisce in -a o -e: la regola da sola sbaglierebbe. */
const MASCHILI = new Set([
  'andrea', 'luca', 'gianluca', 'gianandrea', 'pierluca', 'nicola', 'mattia',
  'elia', 'battista', 'evangelista', 'gianmaria', 'giammaria',
  'simone', 'gabriele', 'raffaele', 'michele', 'daniele', 'emanuele', 'samuele',
  'davide', 'giuseppe', 'salvatore', 'ettore', 'cesare', 'amedeo', 'aime',
  'alessandre', 'felice', 'aniello', 'pasquale', 'vitale', 'natale', 'noe',
  'josè', 'jose', 'ivan', 'igor', 'oscar', 'omar', 'gaspare', 'melchiorre',
]);

/** Donne col nome che non finisce in -a: stessa storia al contrario. */
const FEMMINILI = new Set([
  'alice', 'beatrice', 'agnese', 'irene', 'adele', 'rachele', 'gabriella',
  'ester', 'esther', 'ruth', 'noemi', 'naomi', 'miriam', 'myriam', 'carmen',
  'nives', 'iris', 'dolores', 'lourdes', 'consuelo', 'ines', 'inès', 'agnes',
  'mercedes', 'jennifer', 'jessica', 'michelle', 'nicole', 'rachel', 'sharon',
  'karen', 'kim', 'lisa', 'marie', 'catherine', 'nadine', 'jacqueline',
  'nika', 'rosi', 'marilyn', 'dafne', 'penelope', 'clio',
]);

/** Nomi che vanno bene per entrambi: non si tira a indovinare. */
const AMBIGUI = new Set(['angel', 'alex', 'andre', 'sasha', 'noa', 'niki', 'nikita', 'ariel', 'gianni']);

const pulisci = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // via gli accenti
    .replace(/[^a-z\s'’-]/g, ' ')
    .trim();

/**
 * 'F', 'M' oppure null se il nome non dice abbastanza.
 *
 * Sui nomi doppi ("Maria Giovanna", "Francesca Pia") decide il primo pezzo:
 * è quello che identifica la persona. Se il primo pezzo non basta si prova il
 * secondo, perché "Anna Chiara" scritto "annachiara" o "Pier Luigi" capitano.
 */
export function sessoDaNome(nome: string): 'F' | 'M' | null {
  const pezzi = pulisci(nome).split(/[\s'’-]+/).filter(Boolean);
  for (const pezzo of pezzi) {
    const esito = valuta(pezzo);
    if (esito) return esito;
  }
  return null;
}

function valuta(p: string): 'F' | 'M' | null {
  if (p.length < 3) return null;          // sigle e iniziali non dicono nulla
  if (AMBIGUI.has(p)) return null;
  if (MASCHILI.has(p)) return 'M';
  if (FEMMINILI.has(p)) return 'F';

  const ultima = p.slice(-1);
  if (ultima === 'a') return 'F';
  if (ultima === 'o') return 'M';
  return null;                            // -e, -i, consonanti: troppo incerto
}

/** Il sesso in scheda quando c'è, altrimenti quello dedotto dal nome. */
export function sessoEffettivo(
  genderInScheda: string | null | undefined,
  nome: string,
): { sesso: 'F' | 'M' | null; dedotto: boolean } {
  const g = String(genderInScheda || '').trim().toUpperCase();
  if (g === 'F' || g === 'M') return { sesso: g, dedotto: false };
  return { sesso: sessoDaNome(nome), dedotto: true };
}
