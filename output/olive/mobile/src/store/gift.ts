import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GiftDraft, Occasion, Brand, CardDesign, SignatureMode, DeliveryMethod } from '../types';

interface GiftStore {
  draft: GiftDraft;
  createdGiftId: string | null;

  setOccasion: (occasion: Occasion) => void;
  setBrand: (brand: Brand) => void;
  setAmount: (amount: number) => void;
  setCardDesign: (cardDesign: CardDesign) => void;
  setRecipientName: (name: string) => void;
  setMessage: (message: string) => void;
  setSignatureMode: (mode: SignatureMode) => void;
  setSignatureStyle: (style: string) => void;
  setSignatureDataUrl: (dataUrl: string) => void;
  setSignatureInitials: (initials: string) => void;
  setDeliveryMethod: (method: DeliveryMethod) => void;
  setRecipientPhone: (phone: string) => void;
  setRecipientEmail: (email: string) => void;
  setScheduledAt: (date: Date | null) => void;
  setSendNow: (sendNow: boolean) => void;
  setCreatedGiftId: (id: string | null) => void;
  resetDraft: () => void;
}

const defaultDraft: GiftDraft = {
  occasion: null,
  brand: null,
  amount: null,
  cardDesign: null,
  recipientName: '',
  message: '',
  signatureMode: 'style',
  signatureStyle: 'cursive-1',
  signatureDataUrl: '',
  signatureInitials: '',
  deliveryMethod: 'sms',
  recipientPhone: '',
  recipientEmail: '',
  scheduledAt: null,
  sendNow: true,
};

export const useGiftStore = create<GiftStore>()(
  persist(
    (set) => ({
      draft: { ...defaultDraft },
      createdGiftId: null,

      setOccasion: (occasion) =>
        set((state) => ({ draft: { ...state.draft, occasion } })),
      setBrand: (brand) =>
        set((state) => ({ draft: { ...state.draft, brand } })),
      setAmount: (amount) =>
        set((state) => ({ draft: { ...state.draft, amount } })),
      setCardDesign: (cardDesign) =>
        set((state) => ({ draft: { ...state.draft, cardDesign } })),
      setRecipientName: (recipientName) =>
        set((state) => ({ draft: { ...state.draft, recipientName } })),
      setMessage: (message) =>
        set((state) => ({ draft: { ...state.draft, message } })),
      setSignatureMode: (signatureMode) =>
        set((state) => ({ draft: { ...state.draft, signatureMode } })),
      setSignatureStyle: (signatureStyle) =>
        set((state) => ({ draft: { ...state.draft, signatureStyle } })),
      setSignatureDataUrl: (signatureDataUrl) =>
        set((state) => ({ draft: { ...state.draft, signatureDataUrl } })),
      setSignatureInitials: (signatureInitials) =>
        set((state) => ({ draft: { ...state.draft, signatureInitials } })),
      setDeliveryMethod: (deliveryMethod) =>
        set((state) => ({ draft: { ...state.draft, deliveryMethod } })),
      setRecipientPhone: (recipientPhone) =>
        set((state) => ({ draft: { ...state.draft, recipientPhone } })),
      setRecipientEmail: (recipientEmail) =>
        set((state) => ({ draft: { ...state.draft, recipientEmail } })),
      setScheduledAt: (scheduledAt) =>
        set((state) => ({ draft: { ...state.draft, scheduledAt } })),
      setSendNow: (sendNow) =>
        set((state) => ({ draft: { ...state.draft, sendNow } })),
      setCreatedGiftId: (createdGiftId) => set({ createdGiftId }),
      resetDraft: () =>
        set({ draft: { ...defaultDraft }, createdGiftId: null }),
    }),
    {
      name: 'olive-gift-draft',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
