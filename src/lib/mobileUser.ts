/**
 * La scheda cliente come la vede l'app.
 *
 * Sta in un posto solo perché ogni endpoint mobile che restituisce "chi sono"
 * deve restituire esattamente gli stessi campi: se login e /me rispondessero in
 * due forme diverse, l'app mostrerebbe dati diversi a seconda che tu abbia
 * appena fatto l'accesso o riaperto l'app il giorno dopo.
 *
 * Fuori restano i campi che riguardano il centro e non la cliente: note
 * private, scheda tecnica, quanto ha speso, valutazioni interne.
 */

export interface UtenteApp {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string | null;
  gender: 'F' | 'M' | null;
  loyaltyPoints: number;
  cashback: number;
  vipLevel: number;
  createdAt: string;
}

export function utenteApp(c: {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  loyaltyPoints?: number | null;
  cashback?: number | null;
  vipLevel?: number | null;
  createdAt?: string | null;
}): UtenteApp {
  const g = String(c.gender || '').trim().toUpperCase();
  return {
    id: c.id,
    nome: c.firstName,
    cognome: c.lastName,
    email: c.email || '',
    telefono: c.phone || null,
    gender: g === 'F' ? 'F' : g === 'M' ? 'M' : null,
    loyaltyPoints: c.loyaltyPoints ?? 0,
    cashback: Math.round((c.cashback ?? 0) * 100) / 100,
    vipLevel: c.vipLevel ?? 0,
    createdAt: c.createdAt || '',
  };
}
