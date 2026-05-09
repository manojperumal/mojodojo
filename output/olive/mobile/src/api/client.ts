import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthResponse,
  Brand,
  CardDesign,
  Gift,
  Occasion,
  PaymentIntent,
  User,
} from '../types';

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ??
  'http://localhost:3001/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      await AsyncStorage.removeItem('auth_token');
    }
    return Promise.reject(error);
  },
);

// Auth
export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  return res.data;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/register', {
    name,
    email,
    password,
  });
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await apiClient.get<User>('/auth/me');
  return res.data;
}

// Brands
export async function getBrands(): Promise<Brand[]> {
  const res = await apiClient.get<Brand[]>('/brands');
  return res.data;
}

// Occasions
export interface OccasionData {
  id: Occasion;
  label: string;
  emoji: string;
  gradients: string[];
}

export async function getOccasions(): Promise<OccasionData[]> {
  const res = await apiClient.get<OccasionData[]>('/occasions');
  return res.data;
}

// Card Designs
export async function getCardDesigns(occasion: Occasion): Promise<CardDesign[]> {
  const res = await apiClient.get<CardDesign[]>(`/card-designs?occasion=${occasion}`);
  return res.data;
}

// Gifts
export interface CreateGiftPayload {
  brandId: string;
  amount: number;
  cardDesignId: string;
  recipientName: string;
  message: string;
  signature: string;
  occasion: Occasion;
  deliveryMethod: string;
  recipientPhone?: string;
  recipientEmail?: string;
  scheduledAt?: string;
}

export async function createGift(payload: CreateGiftPayload): Promise<Gift> {
  const res = await apiClient.post<Gift>('/gifts', payload);
  return res.data;
}

export async function updateGift(
  giftId: string,
  payload: Partial<CreateGiftPayload>,
): Promise<Gift> {
  const res = await apiClient.patch<Gift>(`/gifts/${giftId}`, payload);
  return res.data;
}

export async function payGift(
  giftId: string,
  paymentIntentId: string,
): Promise<Gift> {
  const res = await apiClient.post<Gift>(`/gifts/${giftId}/pay`, {
    paymentIntentId,
  });
  return res.data;
}

export async function recallGift(giftId: string): Promise<Gift> {
  const res = await apiClient.post<Gift>(`/gifts/${giftId}/recall`);
  return res.data;
}

export async function nudgeGift(giftId: string): Promise<{ sent: boolean }> {
  const res = await apiClient.post<{ sent: boolean }>(`/gifts/${giftId}/nudge`);
  return res.data;
}

export async function getRecipientGift(
  giftId: string,
  token?: string,
): Promise<Gift> {
  const params = token ? { token } : {};
  const res = await apiClient.get<Gift>(`/gifts/${giftId}/recipient`, {
    params,
  });
  return res.data;
}

export async function openGift(
  giftId: string,
  token?: string,
): Promise<Gift> {
  const res = await apiClient.post<Gift>(`/gifts/${giftId}/open`, { token });
  return res.data;
}

export async function redeemGift(
  giftId: string,
  token?: string,
): Promise<Gift & { giftCode: string }> {
  const res = await apiClient.post<Gift & { giftCode: string }>(
    `/gifts/${giftId}/redeem`,
    { token },
  );
  return res.data;
}

export async function sendThankYou(
  giftId: string,
  message: string,
  token?: string,
): Promise<{ sent: boolean }> {
  const res = await apiClient.post<{ sent: boolean }>(
    `/gifts/${giftId}/thank-you`,
    { message, token },
  );
  return res.data;
}

export async function createPaymentIntent(
  giftId: string,
): Promise<PaymentIntent> {
  const res = await apiClient.post<PaymentIntent>('/payments/intent', {
    giftId,
  });
  return res.data;
}

export async function getSentGifts(): Promise<Gift[]> {
  const res = await apiClient.get<Gift[]>('/gifts/sent');
  return res.data;
}

export default apiClient;
