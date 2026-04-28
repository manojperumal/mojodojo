export type Occasion =
  | 'birthday'
  | 'anniversary'
  | 'congratulations'
  | 'thank-you'
  | 'just-because'
  | 'holiday';

export type DeliveryMethod = 'sms' | 'email' | 'link';

export type SignatureMode = 'style' | 'draw' | 'initials';

export type GiftStatus =
  | 'draft'
  | 'scheduled'
  | 'sent'
  | 'opened'
  | 'redeemed'
  | 'recalled';

export interface Brand {
  id: string;
  name: string;
  logoUrl: string;
  accentColor: string;
  category: string;
  recommended: boolean;
  denominations: number[];
  minAmount: number;
  maxAmount: number;
}

export interface CardDesign {
  id: string;
  name: string;
  gradientColors: string[];
  occasion: Occasion;
  previewImageUrl?: string;
}

export interface GiftDraft {
  occasion: Occasion | null;
  brand: Brand | null;
  amount: number | null;
  cardDesign: CardDesign | null;
  recipientName: string;
  message: string;
  signatureMode: SignatureMode;
  signatureStyle: string;
  signatureDataUrl: string;
  signatureInitials: string;
  deliveryMethod: DeliveryMethod;
  recipientPhone: string;
  recipientEmail: string;
  scheduledAt: Date | null;
  sendNow: boolean;
}

export interface Gift {
  id: string;
  senderId: string;
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  brand: Brand;
  amount: number;
  cardDesign: CardDesign;
  message: string;
  signature: string;
  occasion: Occasion;
  deliveryMethod: DeliveryMethod;
  status: GiftStatus;
  giftCode?: string;
  giftUrl: string;
  scheduledAt?: string;
  sentAt?: string;
  openedAt?: string;
  redeemedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface PaymentIntent {
  clientSecret: string;
  amount: number;
  currency: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export type RootStackParamList = {
  Home: undefined;
  BrandPicker: undefined;
  AmountCard: undefined;
  Personalise: undefined;
  Delivery: undefined;
  Preview: undefined;
  Review: undefined;
  Confirmation: undefined;
  GiftDetail: { giftId: string };
  RecipientView: { giftId: string; token?: string };
};
