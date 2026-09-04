/**
 * ══════════════════════════════════════════════════════════════════
 *  PUNTO DI SWAP DEI SERVIZI API
 * ══════════════════════════════════════════════════════════════════
 *
 * Tutta l'app ottiene i servizi da questo modulo. Oggi sono collegati
 * alle API reali del gestionale (/api/mobile/*). Per tornare ai dati
 * finti in sviluppo basta ri-esportare qui i Mock corrispondenti.
 *
 * L'URL del server si configura in ./config.ts (EXPO_PUBLIC_API_URL).
 */
import { AppointmentsProvider, RealAppointmentsService } from './AppointmentsProvider';
import { AuthProvider } from './AuthProvider';
import { BookingProvider, RealBookingService } from './BookingProvider';
import { CatalogProvider, RealCatalogService } from './CatalogProvider';
import { ChatProvider, RealChatService } from './ChatProvider';
import { RealAuthService } from './RealAuthService';

export const authService: AuthProvider = new RealAuthService();
export const catalogService: CatalogProvider = new RealCatalogService();
export const appointmentsService: AppointmentsProvider = new RealAppointmentsService();
export const chatService: ChatProvider = new RealChatService();
export const bookingService: BookingProvider = new RealBookingService();

export type { AuthProvider } from './AuthProvider';
export type { CatalogProvider } from './CatalogProvider';
export type { AppointmentsProvider } from './AppointmentsProvider';
export type { ChatProvider, ChatMessage } from './ChatProvider';
export type {
  BookingProvider, BookingTreatment, BookingSlot, BookingResult,
  BookingOperator, ServizioRichiesto, Assegnazione, GiornoDisponibile, RicercaOrari,
} from './BookingProvider';
export { homeService } from './HomeProvider';
export { waitlistService } from './WaitlistProvider';
export type { DesiderioAttesa, NuovoDesiderio } from './WaitlistProvider';
export type { DatiHome, DatiWallet, Proposta, Percorso, FlashSlotApp, DatiReferral, MovimentoWallet } from './HomeProvider';
export * from './types';
