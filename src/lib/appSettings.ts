/**
 * Configurazione dell'app clienti, in mano al centro e non al codice.
 *
 * Ogni numero che qualcuno potrebbe voler cambiare — la percentuale di
 * cashback, quanti punti vale un euro, quanto dura un Flash Slot, quale
 * funzione è accesa — sta qui e si modifica dal gestionale. Se cambiare una
 * promozione richiede un rilascio, la promozione non si cambia mai.
 *
 * I valori di partenza sono nel codice come rete di sicurezza: un'installazione
 * nuova funziona subito, e se una configurazione viene salvata a metà l'app non
 * si pianta ma usa il valore di riserva.
 */

import { prisma } from './prisma';

export interface ConfigApp {
  /** Interruttori generali: spegnere una funzione la nasconde nell'app. */
  funzioni: {
    wallet: boolean;
    club: boolean;
    flashSlot: boolean;
    referral: boolean;
    challenge: boolean;
    beautyBox: boolean;
    percorsi: boolean;
    assistente: boolean;
    giftCard: boolean;
    prenotaConAmica: boolean;
  };
  punti: {
    /** Punti riconosciuti per ogni euro speso. */
    perEuro: number;
    /** Punti in regalo per una prenotazione fatta dall'app. */
    prenotazioneApp: number;
    /** Quanti punti valgono un euro di credito, al riscatto. */
    puntiPerEuro: number;
  };
  cashback: {
    attivo: boolean;
    /** Percentuale base; i livelli del Club possono alzarla. */
    percentualeBase: number;
    /** Giorni di validità del cashback maturato. */
    validoGiorni: number;
  };
  flashSlot: {
    /** Sconto proposto in automatico quando si pubblica uno slot. */
    scontoPercentuale: number;
    /** Per quanti minuti resta in vetrina. */
    durataMinuti: number;
    /** Non pubblicare slot che iniziano fra meno di X minuti. */
    anticipoMinimoMinuti: number;
    /** Quante ore avanti guardare quando si cercano buchi da riempire. */
    orizzonteOre: number;
  };
  referral: {
    /** Credito a chi invita, quando l'amica diventa cliente pagante. */
    premioInvitante: number;
    /** Credito di benvenuto all'amica. */
    premioInvitata: number;
    validoGiorni: number;
    /** Quante amiche può portare al massimo, per non aprire la porta agli abusi. */
    maxInviti: number;
  };
  notifiche: {
    attive: boolean;
    /** Non più di N notifiche a settimana per cliente. */
    maxSettimana: number;
    /** Fascia oraria in cui è lecito disturbare. */
    dalleOre: number;
    alleOre: number;
  };
  home: {
    /** Testo sotto il saluto, modificabile per le occasioni speciali. */
    messaggio: string;
    /** Quante proposte al massimo in "Per te oggi". */
    maxProposte: number;
  };
  /** Recapiti e orari del centro, mostrati in fondo alla Home dell'app. */
  centro: {
    nome: string;
    /** Con prefisso, es. "+39 0823 123456": diventa il tasto "Chiama". */
    telefono: string;
    indirizzo: string;
    /** Testo libero, es. "Mar–Sab 9:00–19:00". Vuoto = riga nascosta. */
    orari: string;
  };
  /**
   * Come si comporta la prenotazione online (app clienti e pagina /prenota).
   * I turni delle operatrici restano in Staff → Turni: qui c'è solo la
   * cornice, cioè fin dove il motore può spingersi.
   */
  prenotazione: {
    /** Prima ora proponibile, anche se un'operatrice attacca prima. */
    apertura: string;
    /** Ultima ora entro cui la seduta deve finire. */
    chiusura: string;
    /** Ogni quanti minuti si prova un orario di inizio. */
    passoMinuti: number;
    /** Preavviso minimo per prenotare oggi: senza, alle 16 propone le 16:05. */
    preavvisoMinuti: number;
    /** Quanti giorni in avanti guardare quando la cliente cerca un orario. */
    giorniAvanti: number;
  };
}

export const CONFIG_DI_PARTENZA: ConfigApp = {
  funzioni: {
    wallet: true, club: true, flashSlot: true, referral: true, challenge: true,
    beautyBox: true, percorsi: true, assistente: true, giftCard: false,
    prenotaConAmica: false,
  },
  punti: { perEuro: 1, prenotazioneApp: 10, puntiPerEuro: 100 },
  cashback: { attivo: true, percentualeBase: 3, validoGiorni: 90 },
  flashSlot: { scontoPercentuale: 20, durataMinuti: 120, anticipoMinimoMinuti: 90, orizzonteOre: 72 },
  referral: { premioInvitante: 5, premioInvitata: 5, validoGiorni: 90, maxInviti: 20 },
  notifiche: { attive: true, maxSettimana: 3, dalleOre: 9, alleOre: 20 },
  home: { messaggio: '', maxProposte: 5 },
  centro: {
    nome: 'RevoBeauty',
    telefono: '',
    indirizzo: 'Via Caudina 30, 81024 Maddaloni (CE)',
    orari: '',
  },
  prenotazione: { apertura: '09:00', chiusura: '19:00', passoMinuti: 15, preavvisoMinuti: 60, giorniAvanti: 21 },
};

const CHIAVE = 'app-clienti';

/** Unisce due livelli di oggetti senza perdere le chiavi non salvate. */
function unisci<T>(base: T, salvato: unknown): T {
  if (!salvato || typeof salvato !== 'object') return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(salvato as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object'
      ? unisci(b, v)
      : v;
  }
  return out as T;
}

export async function leggiConfig(): Promise<ConfigApp> {
  const riga = await prisma.appSetting.findUnique({ where: { key: CHIAVE } });
  return unisci(CONFIG_DI_PARTENZA, riga?.data);
}

export async function salvaConfig(parziale: Partial<ConfigApp>): Promise<ConfigApp> {
  const attuale = await leggiConfig();
  const nuova = unisci(attuale, parziale);
  await prisma.appSetting.upsert({
    where: { key: CHIAVE },
    create: { key: CHIAVE, data: nuova as unknown as object, updatedAt: new Date().toISOString() },
    update: { data: nuova as unknown as object, updatedAt: new Date().toISOString() },
  });
  return nuova;
}
