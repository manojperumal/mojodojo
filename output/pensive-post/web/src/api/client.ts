import axios from 'axios'
import type {
  AuthResponse,
  Brand,
  Gift,
  GiftDraft,
  GiftStatus,
  Occasion,
  PaymentIntentResponse,
  RecipientGift,
  User,
} from '../types'

// ── Axios instance ────────────────────────────────────────────────────────────

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pp_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>('/auth/login', { email, password })
  return data
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>('/auth/register', { name, email, password })
  return data
}

export async function getMe(): Promise<User> {
  const { data } = await client.get<User>('/auth/me')
  return data
}

// ── Catalogue ─────────────────────────────────────────────────────────────────

export async function getBrands(): Promise<Brand[]> {
  const { data } = await client.get<Brand[]>('/brands')
  return data
}

export async function getOccasions(): Promise<Occasion[]> {
  const { data } = await client.get<Occasion[]>('/occasions')
  return data
}

// ── Gifts (sender) ────────────────────────────────────────────────────────────

type GiftDraftPayload = Omit<GiftDraft, 'giftId' | 'occasion' | 'brand' | 'scheduledAt'> & {
  occasionId: string
  brandId: string
  scheduledAt: string | null
}

function draftToPayload(draft: GiftDraft): GiftDraftPayload {
  return {
    occasionId: draft.occasion?.id ?? '',
    brandId: draft.brand?.id ?? '',
    cardDesignIndex: draft.cardDesignIndex,
    amount: draft.amount ?? 0,
    recipientName: draft.recipientName,
    message: draft.message,
    signatureMode: draft.signatureMode,
    signatureData: draft.signatureData,
    deliveryMethod: draft.deliveryMethod ?? 'LINK',
    recipientPhone: draft.recipientPhone,
    recipientEmail: draft.recipientEmail,
    scheduledAt: draft.scheduledAt ? draft.scheduledAt.toISOString() : null,
  }
}

export async function createGift(draft: GiftDraft): Promise<Gift> {
  const { data } = await client.post<Gift>('/gifts', draftToPayload(draft))
  return data
}

export async function updateGift(id: string, draft: GiftDraft): Promise<Gift> {
  const { data } = await client.patch<Gift>(`/gifts/${id}`, draftToPayload(draft))
  return data
}

export async function getGifts(): Promise<Gift[]> {
  const { data } = await client.get<Gift[]>('/gifts')
  return data
}

export async function getGift(id: string): Promise<Gift> {
  const { data } = await client.get<Gift>(`/gifts/${id}`)
  return data
}

// ── Payment ───────────────────────────────────────────────────────────────────

export async function createPaymentIntent(
  amount: number,
  brandId: string,
): Promise<PaymentIntentResponse> {
  const { data } = await client.post<PaymentIntentResponse>('/payments/intent', {
    amount,
    brandId,
  })
  return data
}

export async function payGift(id: string, paymentIntentId: string): Promise<Gift> {
  const { data } = await client.post<Gift>(`/gifts/${id}/pay`, { paymentIntentId })
  return data
}

// ── Gift lifecycle ────────────────────────────────────────────────────────────

export async function recallGift(id: string): Promise<Gift> {
  const { data } = await client.post<Gift>(`/gifts/${id}/recall`)
  return data
}

export async function nudgeGift(id: string): Promise<Gift> {
  const { data } = await client.post<Gift>(`/gifts/${id}/nudge`)
  return data
}

// ── Recipient ─────────────────────────────────────────────────────────────────

export async function getRecipientGift(token: string): Promise<RecipientGift> {
  const { data } = await client.get<RecipientGift>(`/r/${token}`)
  return data
}

export async function openGift(token: string): Promise<void> {
  await client.post(`/r/${token}/open`)
}

export async function redeemGift(token: string): Promise<RecipientGift> {
  const { data } = await client.post<RecipientGift>(`/r/${token}/redeem`)
  return data
}

export async function sendThankYou(token: string, message: string): Promise<void> {
  await client.post(`/r/${token}/thank-you`, { message })
}

// Re-export GiftStatus for convenience without direct import from types
export type { GiftStatus }
