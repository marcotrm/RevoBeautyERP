/**
 * Il campanello della chat: quante risposte non lette, condiviso tra
 * la barra delle schede (il pallino rosso) e la schermata Chat (che lo
 * azzera quando la conversazione viene aperta).
 *
 * Un micro-store a mano invece di un contesto React: lo leggono due punti
 * lontani dell'albero e non deve rimontare nulla — solo avvisare chi ascolta.
 */
import { chatService } from '@/api';

let conteggio = 0;
const ascoltatori = new Set<(n: number) => void>();

function avvisa() {
  for (const fn of ascoltatori) fn(conteggio);
}

export function nonLettiChat(): number {
  return conteggio;
}

export function ascoltaNonLetti(fn: (n: number) => void): () => void {
  ascoltatori.add(fn);
  fn(conteggio);
  return () => ascoltatori.delete(fn);
}

/** Chiede al server il conteggio fresco. Gli errori non fanno rumore. */
export async function aggiornaNonLetti(token: string): Promise<void> {
  try {
    const n = await chatService.nonLetti(token);
    if (n !== conteggio) {
      conteggio = n;
      avvisa();
    }
  } catch {
    // rete assente o sessione scaduta: il pallino resta com'è
  }
}

/** La chat è stata aperta (il server ha già segnato tutto letto). */
export function azzeraNonLetti(): void {
  if (conteggio !== 0) {
    conteggio = 0;
    avvisa();
  }
}
