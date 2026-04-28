import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export async function createPaymentIntent(
  amountCents: number,
  currency: string = 'usd',
  customerId?: string,
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const params: Stripe.PaymentIntentCreateParams = {
    amount: amountCents,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      app: 'pensive-post',
    },
  };

  if (customerId) {
    params.customer = customerId;
  }

  const paymentIntent = await stripe.paymentIntents.create(params);

  if (!paymentIntent.client_secret) {
    throw new Error('Failed to create payment intent: no client secret returned');
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}
