import { create } from 'zustand'
import type { Brand, DeliveryMethod, GiftDraft, Occasion, SignatureMode } from '../types'

interface GiftStore extends GiftDraft {
  setOccasion: (occasion: Occasion) => void
  setBrand: (brand: Brand) => void
  setCardDesignIndex: (index: number) => void
  setAmount: (amount: number) => void
  setRecipientName: (name: string) => void
  setMessage: (message: string) => void
  setSignatureMode: (mode: SignatureMode) => void
  setSignatureData: (data: string) => void
  setDeliveryMethod: (method: DeliveryMethod) => void
  setRecipientPhone: (phone: string) => void
  setRecipientEmail: (email: string) => void
  setScheduledAt: (date: Date | null) => void
  setGiftId: (id: string) => void
  reset: () => void
}

const defaultDraft: GiftDraft = {
  occasion: null,
  brand: null,
  cardDesignIndex: 0,
  amount: null,
  recipientName: '',
  message: '',
  signatureMode: 'STYLE',
  signatureData: 'Caveat',
  deliveryMethod: null,
  recipientPhone: '',
  recipientEmail: '',
  scheduledAt: null,
  giftId: null,
}

export const useGiftStore = create<GiftStore>((set) => ({
  ...defaultDraft,

  setOccasion: (occasion) => set({ occasion }),
  setBrand: (brand) => set({ brand }),
  setCardDesignIndex: (cardDesignIndex) => set({ cardDesignIndex }),
  setAmount: (amount) => set({ amount }),
  setRecipientName: (recipientName) => set({ recipientName }),
  setMessage: (message) => set({ message }),
  setSignatureMode: (signatureMode) => set({ signatureMode }),
  setSignatureData: (signatureData) => set({ signatureData }),
  setDeliveryMethod: (deliveryMethod) => set({ deliveryMethod }),
  setRecipientPhone: (recipientPhone) => set({ recipientPhone }),
  setRecipientEmail: (recipientEmail) => set({ recipientEmail }),
  setScheduledAt: (scheduledAt) => set({ scheduledAt }),
  setGiftId: (giftId) => set({ giftId }),
  reset: () => set({ ...defaultDraft }),
}))
