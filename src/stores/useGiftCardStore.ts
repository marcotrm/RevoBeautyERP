'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `RB-${new Date().getFullYear()}-${code}`;
}

const defaultGiftCards: GiftCard[] = [
  {
    id: 'gc-1', code: 'RB-2026-K7M3', purchasedBy: 'Marco Rossi', recipientName: 'Giulia Rossi',
    amount: 150, remainingBalance: 150, purchaseDate: '2026-05-10', expiryDate: '2027-05-10',
    paymentMethod: 'Carta', purchaseOperator: 'Sara Rossi', status: 'active',
    message: 'Buon compleanno amore! ❤️', transactions: [],
  },
  {
    id: 'gc-2', code: 'RB-2026-P9R2', purchasedBy: 'Elena Bianchi', recipientName: 'Francesca Verdi',
    amount: 100, remainingBalance: 35, purchaseDate: '2026-04-15', expiryDate: '2027-04-15',
    paymentMethod: 'Contanti', purchaseOperator: 'Valentina Bianchi', status: 'partial',
    message: 'Per la tua festa! 🎉', transactions: [
      { id: 'gct-1', date: '2026-04-28', amount: 65, service: 'Pulizia Viso Profonda', operator: 'Sara Rossi' },
    ],
  },
  {
    id: 'gc-3', code: 'RB-2026-W5T1', purchasedBy: 'Anna Colombo', recipientName: 'Laura Ferrari',
    amount: 200, remainingBalance: 0, purchaseDate: '2026-02-14', expiryDate: '2027-02-14',
    paymentMethod: 'Carta', purchaseOperator: 'Chiara Moretti', status: 'used',
    message: 'San Valentino 💕', transactions: [
      { id: 'gct-2', date: '2026-03-01', amount: 95, service: 'Trattamento Anti-Age Premium', operator: 'Sara Rossi' },
      { id: 'gct-3', date: '2026-03-20', amount: 70, service: 'Radiofrequenza Viso', operator: 'Chiara Moretti' },
      { id: 'gct-4', date: '2026-04-10', amount: 35, service: 'Manicure Semipermanente', operator: 'Francesca Romano' },
    ],
  },
];

interface GiftCardStore {
  giftCards: GiftCard[];

  createGiftCard: (data: {
    purchasedBy: string;
    recipientName: string;
    recipientPhone?: string;
    amount: number;
    paymentMethod: GiftCard['paymentMethod'];
    operator: string;
    validityMonths: number;
    message?: string;
  }) => GiftCard;

  redeemGiftCard: (gcId: string, amount: number, service: string, operator: string) => void;
  deleteGiftCard: (gcId: string) => void;

  findByCode: (code: string) => GiftCard | undefined;
  findByRecipient: (name: string) => GiftCard[];
  getActiveGiftCards: () => GiftCard[];
  getTotalActiveBalance: () => number;
}

export const useGiftCardStore = create<GiftCardStore>()(
  persist(
    (set, get) => ({
      giftCards: defaultGiftCards,

      createGiftCard: (data) => {
        const now = new Date();
        const exp = new Date(now);
        exp.setMonth(exp.getMonth() + data.validityMonths);
        const gc: GiftCard = {
          id: `gc-${Date.now()}`,
          code: generateCode(),
          purchasedBy: data.purchasedBy,
          recipientName: data.recipientName,
          recipientPhone: data.recipientPhone,
          amount: data.amount,
          remainingBalance: data.amount,
          purchaseDate: now.toISOString().split('T')[0],
          expiryDate: exp.toISOString().split('T')[0],
          paymentMethod: data.paymentMethod,
          purchaseOperator: data.operator,
          status: 'active',
          message: data.message,
          transactions: [],
        };
        set((s) => ({ giftCards: [gc, ...s.giftCards] }));
        return gc;
      },

      redeemGiftCard: (gcId, amount, service, operator) => {
        const today = new Date().toISOString().split('T')[0];
        set((s) => ({
          giftCards: s.giftCards.map(gc => {
            if (gc.id !== gcId) return gc;
            const newBalance = Math.max(0, gc.remainingBalance - amount);
            return {
              ...gc,
              remainingBalance: newBalance,
              status: newBalance <= 0 ? 'used' : 'partial',
              transactions: [...gc.transactions, {
                id: `gct-${Date.now()}`,
                date: today,
                amount,
                service,
                operator,
              }],
            };
          }),
        }));
      },

      deleteGiftCard: (gcId) => set((s) => ({
        giftCards: s.giftCards.filter(gc => gc.id !== gcId),
      })),

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
    }),
    { name: 'revo_giftcards_store' }
  )
);
