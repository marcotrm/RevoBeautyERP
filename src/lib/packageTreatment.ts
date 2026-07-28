// Capisce quale trattamento corrisponde a un pacchetto della cliente.
// Serve quando in agenda si clicca "Usa seduta"/"Usa omaggio": il trattamento
// deve essere quello del pacchetto, non uno a caso.

const STOP_WORDS = new Set([
  'pacchetto', 'pacchetti', 'seduta', 'sedute', 'omaggio', 'regalo', 'gratis',
  'inaugurazione', 'promo', 'promozione', 'abbonamento', 'card', 'da',
]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Toglie dal nome del pacchetto le parole che non sono il trattamento:
 * "Pressoterapia 5 Sedute" -> "pressoterapia"
 * "Lampada Total Body (Omaggio Inaugurazione)" -> "lampada total body"
 */
export function packageCoreName(packageName: string): string {
  return norm(packageName)
    .split(' ')
    .filter((w) => w && !STOP_WORDS.has(w) && !/^\d+$/.test(w) && !/^x\d+$/.test(w))
    .join(' ');
}

/**
 * Trova il trattamento del pacchetto. Restituisce null se il nome è ambiguo
 * (es. "Total Body 10 sedute"): meglio far scegliere all'operatrice che
 * inserire un trattamento sbagliato.
 */
export function resolveTreatmentForPackage<T extends { id: string; name: string }>(params: {
  packageName: string;
  /** trattamento indicato nel pacchetto a catalogo, se collegato */
  catalogTreatmentName?: string | null;
  treatments: T[];
}): T | null {
  const { packageName, catalogTreatmentName, treatments } = params;
  const byExactName = (name: string) => treatments.find((t) => norm(t.name) === norm(name));

  // 1) il pacchetto a catalogo dice già qual è il trattamento
  if (catalogTreatmentName) {
    const t = byExactName(catalogTreatmentName);
    if (t) return t;
  }

  // 2) il nome del pacchetto è esattamente un trattamento
  const exact = byExactName(packageName);
  if (exact) return exact;

  const core = packageCoreName(packageName);
  if (!core) return null;

  // 3) il nome ripulito è esattamente un trattamento
  //    (più risultati = stesso trattamento duplicato a listino, va bene il primo)
  const coreExact = treatments.filter((t) => norm(t.name) === core);
  if (coreExact.length > 0) return coreExact[0];

  // 4) match parziale: solo se porta a un unico trattamento
  const partial = treatments.filter((t) => {
    const n = norm(t.name);
    return n.includes(core) || core.includes(n);
  });
  const distinct = new Set(partial.map((t) => norm(t.name)));
  if (partial.length > 0 && distinct.size === 1) return partial[0];

  return null;
}
