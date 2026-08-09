/**
 * Tracciamento di quello che succede nell'app.
 *
 * Serve a rispondere alla sola domanda che conta davvero: quanto porta ogni
 * funzione. Contare le prenotazioni non basta — dice quante ne sono arrivate,
 * non quante occasioni sono passate senza che nessuno le guardasse. Per questo
 * si registra tutta la catena: **visto → toccato → prenotato → svolto →
 * incassato**.
 *
 * Il tracciamento non deve mai far fallire l'azione vera: se scrivere l'evento
 * va storto, la prenotazione si fa lo stesso e l'errore resta nei log.
 */

import { prisma } from './prisma';

export type TipoEvento = 'view' | 'click' | 'booking' | 'completed' | 'revenue';
export type Superficie =
  | 'home' | 'per_te' | 'cosa_oggi' | 'flash_slot' | 'referral'
  | 'challenge' | 'push' | 'wallet' | 'box' | 'percorsi' | 'prenota' | 'assistente';

export async function traccia(params: {
  clientId?: string | null;
  type: TipoEvento;
  surface: Superficie;
  itemId?: string | null;
  value?: number | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.appEvent.create({
      data: {
        clientId: params.clientId ?? null,
        type: params.type,
        surface: params.surface,
        itemId: params.itemId ?? null,
        value: params.value ?? null,
        meta: (params.meta ?? undefined) as object | undefined,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('[app] evento non registrato:', e);
  }
}

/** Più eventi in un colpo solo: una schermata mostra più proposte insieme. */
export async function tracciaMolti(
  eventi: Parameters<typeof traccia>[0][]
): Promise<void> {
  if (!eventi.length) return;
  try {
    const adesso = new Date().toISOString();
    await prisma.appEvent.createMany({
      data: eventi.map(e => ({
        clientId: e.clientId ?? null,
        type: e.type,
        surface: e.surface,
        itemId: e.itemId ?? null,
        value: e.value ?? null,
        meta: (e.meta ?? undefined) as object | undefined,
        createdAt: adesso,
      })),
    });
  } catch (e) {
    console.error('[app] eventi non registrati:', e);
  }
}
