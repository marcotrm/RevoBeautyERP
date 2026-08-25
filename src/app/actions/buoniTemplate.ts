'use server';

/**
 * Il template dell'avviso "ti hanno regalato un buono", da far approvare.
 *
 * Si crea da qui e non a mano su Meta perché il testo deve restare identico a
 * quello che il gestionale manda: se le due versioni divergono, Meta rifiuta
 * l'invio e il messaggio non parte senza che nessuno capisca perché.
 */

import { createD360Template } from '@/lib/whatsapp360';
import { WA_TEMPLATES } from '@/lib/wa-templates';

export async function creaTemplateBuonoRegalo(): Promise<{ ok: boolean; stato?: string; error?: string }> {
  const t = WA_TEMPLATES.buonoRegalo;
  const res = await createD360Template({
    name: t.name,
    category: t.category as 'UTILITY' | 'MARKETING',
    language: t.language,
    body: t.body,
    // Gli esempi servono a Meta per capire cosa finisce nei segnaposto:
    // senza, l'approvazione viene rifiutata quasi sempre.
    example: ['Maria', 'Giulia', '50,00 €', 'RB-2026-AB12', '31/12/2027'],
  });
  return res.ok ? { ok: true, stato: res.status } : { ok: false, error: res.error };
}
