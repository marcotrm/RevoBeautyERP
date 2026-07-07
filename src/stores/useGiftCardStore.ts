'use client';

import { create } from 'zustand';
import {
  getGiftCards, createGiftCard as createGiftCardAction, redeemGiftCard as redeemGiftCardAction,
  deleteGiftCard as deleteGiftCardAction,
} from '@/app/actions/giftcards';

export interface GiftCardTransaction {
  id: string;
  date: string;
  amount: number;
  service: string;
  operator: string;
}

export interface GiftCard {
  id: string;
  code: string; // es. RB-2026-A4F8
  purchasedBy: string; // chi compra
  recipientName: string; // chi lo riceve (festeggiata)
  recipientPhone?: string;
  amount: number; // valore totale
  remainingBalance: number; // saldo rimanente
  purchaseDate: string;
  expiryDate: string;
  paymentMethod: 'Carta' | 'Contanti' | 'Satispay' | 'Bonifico';
  purchaseOperator: string;
  status: 'active' | 'used' | 'expired' | 'partial';
  message?: string; // messaggio personalizzato
  transactions: GiftCardTransaction[];
}

interface GiftCardStore {
  giftCards: GiftCard[];
  isLoading: boolean;

  fetchGiftCards: () => Promise<void>;

  createGiftCard: (data: {
    purchasedBy: string;
    recipientName: string;
    recipientPhone?: string;
    amount: number;
    paymentMethod: GiftCard['paymentMethod'];
    operator: string;
    validityMonths: number;
    message?: string;
  }) => Promise<GiftCard>;

  redeemGiftCard: (gcId: string, amount: number, service: string, operator: string) => Promise<void>;
  deleteGiftCard: (gcId: string) => Promise<void>;

  findByCode: (code: string) => GiftCard | undefined;
  findByRecipient: (name: string) => GiftCard[];
  getActiveGiftCards: () => GiftCard[];
  getTotalActiveBalance: () => number;
}

export const useGiftCardStore = create<GiftCardStore>()((set, get) => ({
  giftCards: [],
  isLoading: false,

  fetchGiftCards: async () => {
    set({ isLoading: true });
    try {
      const data = await getGiftCards();
      set({ giftCards: data, isLoading: false });
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  createGiftCard: async (data) => {
    try {
      const gc = await createGiftCardAction(data);
      set((s) => ({ giftCards: [gc, ...s.giftCards] }));
      return gc;
    } catch (error) {
      console.error('Failed to create gift card', error);
      throw error;
    }
  },

  redeemGiftCard: async (gcId, amount, service, operator) => {
    try {
      const updated = await redeemGiftCardAction(gcId, amount, service, operator);
      set((s) => ({
        giftCards: s.giftCards.map(gc => gc.id === gcId ? updated : gc),
      }));
    } catch (error) {
      console.error('Failed to redeem gift card', error);
      throw error;
    }
  },

  deleteGiftCard: async (gcId) => {
    try {
      await deleteGiftCardAction(gcId);
      set((s) => ({ giftCards: s.giftCards.filter(gc => gc.id !== gcId) }));
    } catch (error) {
      console.error('Failed to delete gift card', error);
      throw error;
    }
  },

  findByCode: (code) => get().giftCards.find(gc =>
    gc.code.toLowerCase() === code.toLowerCase() && gc.status !== 'expired'
  ),

  findByRecipient: (name) => {
    const q = name.toLowerCase();
    return get().giftCards.filter(gc =>
      gc.recipientName.toLowerCase().includes(q) &&
      (gc.status === 'active' || gc.status === 'partial')
    );
  },

  getActiveGiftCards: () => get().giftCards.filter(gc =>
    gc.status === 'active' || gc.status === 'partial'
  ),

  getTotalActiveBalance: () => get().giftCards
    .filter(gc => gc.status === 'active' || gc.status === 'partial')
    .reduce((s, gc) => s + gc.remainingBalance, 0),
}));
