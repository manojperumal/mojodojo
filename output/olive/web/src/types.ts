// ── Enums ────────────────────────────────────────────────────────────────────

export type SignatureMode = 'STYLE' | 'DRAW' | 'INITIALS'

export type DeliveryMethod = 'SMS' | 'EMAIL' | 'LINK'

export enum GiftStatus {
  DRAFT = 'DRAFT',
  PAID = 'PAID',
  SENT = 'SENT',
  OPENED = 'OPENED',
  REDEEMED = 'REDEEMED',
  RECALLED = 'RECALLED',
}

// ── Domain types ──────────────────────────────────────────────────────────────

export interface Occasion {
  id: string
  slug: string
  label: string
  emoji: string
  description: string
}

export interface Brand {
  id: string
  name: string
  logoUrl: string
  redeemUrl: string
  category: string
  occasions: string[]          // occasion slugs
  minAmount: number
  maxAmount: number
  suggestedAmounts: number[]
}

export interface CardDesign {
  id: string
  occasionSlug: string
  index: number                // 0-3
  name: string
  previewImageUrl?: string
  gradientFrom: string
  gradientTo: string
  accentColor: string
  emoji: string
}

// ── Gift ──────────────────────────────────────────────────────────────────────

export interface Gift {
  id: string
  status: GiftStatus
  occasion: Occasion
  brand: Brand
  cardDesignIndex: number
  amount: number
  recipientName: string
  message: string
  signatureMode: SignatureMode
  signatureData: string
  deliveryMethod: DeliveryMethod
  recipientPhone: string | null
  recipientEmail: string | null
  scheduledAt: string | null   // ISO 8601
  sentAt: string | null
  openedAt: string | null
  redeemedAt: string | null
  nudgeSentAt: string | null
  recalledAt: string | null
  giftCardCode: string | null  // only returned after redeem
  shareToken: string
  shareUrl: string
  createdAt: string
  updatedAt: string
  senderId: string
}

// ── Draft (Zustand store shape) ───────────────────────────────────────────────

export interface GiftDraft {
  occasion: Occasion | null
  brand: Brand | null
  cardDesignIndex: number
  amount: number | null
  recipientName: string
  message: string
  signatureMode: SignatureMode
  signatureData: string
  deliveryMethod: DeliveryMethod | null
  recipientPhone: string
  recipientEmail: string
  scheduledAt: Date | null
  giftId: string | null
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  createdAt: string
}

export interface AuthResponse {
  user: User
  token: string
}

// ── API helpers ───────────────────────────────────────────────────────────────

export interface PaymentIntentResponse {
  clientSecret: string
  paymentIntentId: string
  amount: number               // cents
}

export interface RecipientGift {
  id: string
  status: GiftStatus
  senderName: string
  occasion: Occasion
  brand: Brand
  cardDesignIndex: number
  amount: number
  recipientName: string
  message: string
  signatureMode: SignatureMode
  signatureData: string
  giftCardCode: string | null  // present only after redeem
  shareToken: string
}
