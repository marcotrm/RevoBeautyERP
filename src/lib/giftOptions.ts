// I tre omaggi dell'inaugurazione: 1 seduta gratis del trattamento scelto.
// Sta in un file senza prisma così lo può usare anche l'interfaccia.

export interface GiftOption {
  key: string;
  label: string;
  name: string; // nome del pacchetto omaggio, contiene il trattamento del catalogo
  color: string;
  sessions: number;
}

export const GIFT_OPTIONS: GiftOption[] = [
  { key: 'lampada', label: 'Lampada Total Body', name: 'Lampada Total Body (Omaggio Inaugurazione)', color: '#F59E0B', sessions: 1 },
  { key: 'pressoterapia', label: 'Pressoterapia Infrarossi', name: 'Pressoterapia Infrarossi (Omaggio Inaugurazione)', color: '#14B8A6', sessions: 1 },
  { key: 'body_sculpting', label: 'Fast Tonic (Body Sculpting)', name: 'Fast Tonic (Omaggio Inaugurazione)', color: '#A855F7', sessions: 1 },
];

export const FREE_PACKAGES: Record<string, { name: string; color: string; sessions: number }> =
  Object.fromEntries(GIFT_OPTIONS.map(o => [o.key, { name: o.name, color: o.color, sessions: o.sessions }]));

/** true se il pacchetto è uno dei tre omaggi dell'inaugurazione. */
export function isGiftPackage(packageName: string): boolean {
  return /omaggio inaugurazione/i.test(packageName);
}

/** Opzione omaggio corrispondente al nome del pacchetto, se c'è. */
export function giftOptionFromName(packageName: string): GiftOption | undefined {
  return GIFT_OPTIONS.find(o => o.name.toLowerCase() === packageName.toLowerCase());
}
