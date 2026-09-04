/**
 * Nome e icona di ogni categoria di trattamento, nell'ordine in cui il
 * centro le usa. Un posto solo: le usano la prenotazione e il listino,
 * e una categoria nuova compare in tutti e due senza toccare le schermate.
 *
 * Le emoji di prima erano quelle del telefono: cambiano faccia su ogni
 * sistema e non hanno niente a che vedere col marchio. Queste sono disegnate
 * nella stessa famiglia delle icone delle schede.
 */
import type { NomeIcona } from '@/components/ui/Icona';

export const CATEGORIE: { key: string; label: string; icona: NomeIcona }[] = [
  { key: 'nails', label: 'Unghie', icona: 'unghie' },
  { key: 'laser', label: 'Laser', icona: 'laser' },
  { key: 'waxing', label: 'Ceretta', icona: 'ceretta' },
  { key: 'facial', label: 'Viso', icona: 'viso' },
  { key: 'body', label: 'Corpo', icona: 'corpo' },
  { key: 'massage', label: 'Massaggi', icona: 'massaggi' },
  { key: 'makeup', label: 'Trucco', icona: 'trucco' },
  { key: 'consultation', label: 'Consulenza', icona: 'consulenza' },
  { key: 'hair', label: 'Capelli', icona: 'capelli' },
];

export const metaCategoria = (c: string): { key: string; label: string; icona: NomeIcona } =>
  CATEGORIE.find(x => x.key === c) || { key: c, label: c, icona: 'generico' };
