import https from 'https';
import http from 'http';

const TANGO_BASE_URL = 'https://integration-api.tangocard.com/raas/v2';

export interface TangoBrand {
  brandKey: string;
  brandName: string;
  description: string;
  shortDescription: string;
  disclaimer: string;
  terms: string;
  imageUrls: { '278w-326h': string };
  items: TangoItem[];
}

export interface TangoItem {
  utid: string;
  rewardName: string;
  faceValue: number;
  currencyCode: string;
  countries: string[];
}

export interface TangoOrderResult {
  utid: string;
  token: string;
  redemptionInstructions: string;
}

interface TangoOrderResponse {
  referenceOrderID: string;
  createdAt: string;
  reward: {
    utid: string;
    token: string;
    redemptionInstructions: string;
    credentials?: {
      CardNumber?: string;
      Pin?: string;
    };
  };
}

function getTangoAuthHeader(): string {
  const platformName = process.env.TANGO_PLATFORM_NAME ?? '';
  const platformKey = process.env.TANGO_PLATFORM_KEY ?? '';
  const encoded = Buffer.from(`${platformName}:${platformKey}`).toString('base64');
  return `Basic ${encoded}`;
}

async function tangoRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${TANGO_BASE_URL}${path}`);
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: getTangoAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    const bodyStr = body ? JSON.stringify(body) : undefined;
    if (bodyStr) {
      options.headers = {
        ...options.headers,
        'Content-Length': Buffer.byteLength(bodyStr),
      };
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`Failed to parse Tango response: ${data}`));
          }
        } else {
          reject(new Error(`Tango API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function getMockCatalog(): TangoBrand[] {
  return [
    {
      brandKey: 'STARBUCKS-U',
      brandName: 'Starbucks',
      description: 'Starbucks gift cards for coffee lovers.',
      shortDescription: 'Coffee & more',
      disclaimer: 'Redeemable at US Starbucks locations.',
      terms: 'No expiration date.',
      imageUrls: { '278w-326h': 'https://logo.clearbit.com/starbucks.com' },
      items: [
        { utid: 'U869586', rewardName: 'Starbucks $10', faceValue: 10, currencyCode: 'USD', countries: ['US'] },
        { utid: 'U869587', rewardName: 'Starbucks $25', faceValue: 25, currencyCode: 'USD', countries: ['US'] },
      ],
    },
    {
      brandKey: 'DOORDASH-U',
      brandName: 'DoorDash',
      description: 'DoorDash gift cards for food delivery.',
      shortDescription: 'Food delivery',
      disclaimer: 'Redeemable on DoorDash app.',
      terms: 'No expiration date.',
      imageUrls: { '278w-326h': 'https://logo.clearbit.com/doordash.com' },
      items: [
        { utid: 'U123456', rewardName: 'DoorDash $15', faceValue: 15, currencyCode: 'USD', countries: ['US'] },
        { utid: 'U123457', rewardName: 'DoorDash $25', faceValue: 25, currencyCode: 'USD', countries: ['US'] },
      ],
    },
    {
      brandKey: 'AMAZON-U',
      brandName: 'Amazon',
      description: 'Amazon gift cards — shop millions of products.',
      shortDescription: 'Shop everything',
      disclaimer: 'Redeemable on Amazon.com.',
      terms: 'No expiration date.',
      imageUrls: { '278w-326h': 'https://logo.clearbit.com/amazon.com' },
      items: [
        { utid: 'U654321', rewardName: 'Amazon $25', faceValue: 25, currencyCode: 'USD', countries: ['US'] },
        { utid: 'U654322', rewardName: 'Amazon $50', faceValue: 50, currencyCode: 'USD', countries: ['US'] },
      ],
    },
  ];
}

function generateMockToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function getMockOrder(brandKey: string, faceValue: number): TangoOrderResult {
  return {
    utid: `${brandKey}-${faceValue}-MOCK`,
    token: generateMockToken(),
    redemptionInstructions: `To redeem your ${brandKey} gift card worth $${faceValue}, visit the brand's website or app and enter your code at checkout.`,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getCatalog(): Promise<TangoBrand[]> {
  if (process.env.TANGO_MOCK === 'true') {
    return getMockCatalog();
  }

  const response = await tangoRequest<{ brands: TangoBrand[] }>('GET', '/catalog');
  return response.brands;
}

export async function placeOrder(
  brandKey: string,
  faceValue: number,
  recipientEmail: string,
): Promise<TangoOrderResult> {
  if (process.env.TANGO_MOCK === 'true') {
    return getMockOrder(brandKey, faceValue);
  }

  const body = {
    accountIdentifier: process.env.TANGO_PLATFORM_NAME,
    amount: faceValue,
    brandKey,
    sendEmail: false,
    recipient: {
      email: recipientEmail,
    },
    sender: {
      email: process.env.FROM_EMAIL ?? 'noreply@sendolive.com',
      firstName: 'Olive',
      lastName: 'Post',
    },
  };

  const response = await tangoRequest<TangoOrderResponse>('POST', '/orders', body);

  return {
    utid: response.reward.utid,
    token: response.reward.token,
    redemptionInstructions: response.reward.redemptionInstructions,
  };
}

export async function voidOrder(referenceOrderId: string): Promise<boolean> {
  if (process.env.TANGO_MOCK === 'true') {
    console.log(`[Tango Mock] Voiding order ${referenceOrderId}`);
    return true;
  }

  try {
    await tangoRequest('DELETE', `/orders/${referenceOrderId}`);
    return true;
  } catch (err) {
    console.error('Tango void order failed:', err);
    return false;
  }
}

// Keep http import used for potential future non-TLS usage
void http;
