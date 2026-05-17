import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { isFuture } from 'date-fns';
import prisma from '../lib/prisma';
import { stripe, createPaymentIntent } from '../lib/stripe';
import { placeOrder, voidOrder } from '../lib/tango';
import { sendSMS, sendEmail } from '../lib/delivery';
import { encrypt } from '../lib/crypto';
import { requireAuth } from '../middleware/auth';
import type { GiftStatus } from '@prisma/client';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createGiftSchema = z.object({
  recipientName: z.string().min(1).max(120),
  brandId: z.string().min(1),
  cardDesignId: z.string().min(1),
  amount: z.number().positive().max(500), // dollars
  message: z.string().min(1).max(1000),
  signatureMode: z.enum(['STYLE', 'DRAW', 'INITIALS']),
  signatureData: z.string().min(1),
  deliveryMethod: z.enum(['SMS', 'EMAIL', 'LINK']),
  scheduledAt: z.string().datetime().optional().nullable(),
  recipientPhone: z.string().optional().nullable(),
  recipientEmail: z.string().email().optional().nullable(),
});

const updateGiftSchema = createGiftSchema.partial();

const payGiftSchema = z.object({
  paymentIntentId: z.string().min(1),
});

const nudgeSchema = z.object({}).optional();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildGiftUrl(recipientToken: string): string {
  const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  return `${base}/gift/${recipientToken}`;
}

// Full gift select shape used across multiple routes
const giftSelect = {
  id: true,
  senderId: true,
  recipientName: true,
  recipientPhone: true,
  recipientEmail: true,
  brandId: true,
  cardDesignId: true,
  amount: true,
  message: true,
  signatureMode: true,
  signatureData: true,
  deliveryMethod: true,
  scheduledAt: true,
  sentAt: true,
  deliveredAt: true,
  openedAt: true,
  redeemedAt: true,
  nudgeSentAt: true,
  status: true,
  recipientToken: true,
  aggregatorOrderId: true,
  stripePaymentIntentId: true,
  thankYouMessage: true,
  createdAt: true,
  updatedAt: true,
  brand: {
    select: { id: true, slug: true, name: true, logoUrl: true, category: true },
  },
  cardDesign: {
    select: { id: true, slug: true, occasion: true, imageUrl: true, thumbnailUrl: true },
  },
} as const;

// ─── GET /payment-intent ──────────────────────────────────────────────────────
// Must be before /:id to avoid route conflict

router.get(
  '/payment-intent',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const amountDollars = parseFloat(req.query['amount'] as string);
    const brandId = req.query['brandId'] as string;

    if (isNaN(amountDollars) || amountDollars <= 0) {
      res.status(400).json({ error: 'amount query param is required and must be a positive number' });
      return;
    }

    if (!brandId) {
      res.status(400).json({ error: 'brandId query param is required' });
      return;
    }

    // Gift amount in cents + $1.50 platform fee
    const totalCents = Math.round(amountDollars * 100) + 150;

    // Get user's Stripe customer ID if available
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { stripeCustomerId: true },
    });

    const { clientSecret, paymentIntentId } = await createPaymentIntent(
      totalCents,
      'usd',
      user?.stripeCustomerId ?? undefined,
    );

    res.json({ clientSecret, paymentIntentId, totalCents });
  },
);

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parse = createGiftSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  const data = parse.data;

  // Verify brand exists
  const brand = await prisma.brand.findFirst({
    where: { id: data.brandId, active: true },
  });
  if (!brand) {
    res.status(404).json({ error: 'Brand not found' });
    return;
  }

  // Verify card design exists
  const cardDesign = await prisma.cardDesign.findFirst({
    where: { id: data.cardDesignId, active: true },
  });
  if (!cardDesign) {
    res.status(404).json({ error: 'Card design not found' });
    return;
  }

  // Validate delivery contact info
  if (data.deliveryMethod === 'SMS' && !data.recipientPhone) {
    res.status(400).json({ error: 'recipientPhone is required for SMS delivery' });
    return;
  }
  if (data.deliveryMethod === 'EMAIL' && !data.recipientEmail) {
    res.status(400).json({ error: 'recipientEmail is required for EMAIL delivery' });
    return;
  }

  const recipientToken = uuidv4();

  const gift = await prisma.gift.create({
    data: {
      senderId: req.user!.id,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone ?? null,
      recipientEmail: data.recipientEmail ?? null,
      brandId: data.brandId,
      cardDesignId: data.cardDesignId,
      amount: Math.round(data.amount * 100), // store cents
      message: data.message,
      signatureMode: data.signatureMode,
      signatureData: data.signatureData,
      deliveryMethod: data.deliveryMethod,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      status: 'DRAFT',
      recipientToken,
    },
    select: giftSelect,
  });

  res.status(201).json({ gift });
});

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const gifts = await prisma.gift.findMany({
    where: { senderId: req.user!.id },
    select: giftSelect,
    orderBy: { createdAt: 'desc' },
  });

  res.json({ gifts });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const gift = await prisma.gift.findFirst({
    where: { id: req.params['id'], senderId: req.user!.id },
    select: giftSelect,
  });

  if (!gift) {
    res.status(404).json({ error: 'Gift not found' });
    return;
  }

  res.json({ gift });
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────

router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.gift.findFirst({
    where: { id: req.params['id'], senderId: req.user!.id },
    select: { id: true, status: true },
  });

  if (!existing) {
    res.status(404).json({ error: 'Gift not found' });
    return;
  }

  if (existing.status !== 'DRAFT') {
    res.status(409).json({ error: 'Only DRAFT gifts can be edited' });
    return;
  }

  const parse = updateGiftSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  const data = parse.data;
  const updateData: Record<string, unknown> = {};

  if (data.recipientName !== undefined) updateData['recipientName'] = data.recipientName;
  if (data.recipientPhone !== undefined) updateData['recipientPhone'] = data.recipientPhone;
  if (data.recipientEmail !== undefined) updateData['recipientEmail'] = data.recipientEmail;
  if (data.brandId !== undefined) updateData['brandId'] = data.brandId;
  if (data.cardDesignId !== undefined) updateData['cardDesignId'] = data.cardDesignId;
  if (data.amount !== undefined) updateData['amount'] = Math.round(data.amount * 100);
  if (data.message !== undefined) updateData['message'] = data.message;
  if (data.signatureMode !== undefined) updateData['signatureMode'] = data.signatureMode;
  if (data.signatureData !== undefined) updateData['signatureData'] = data.signatureData;
  if (data.deliveryMethod !== undefined) updateData['deliveryMethod'] = data.deliveryMethod;
  if (data.scheduledAt !== undefined) {
    updateData['scheduledAt'] = data.scheduledAt ? new Date(data.scheduledAt) : null;
  }

  const gift = await prisma.gift.update({
    where: { id: existing.id },
    data: updateData,
    select: giftSelect,
  });

  res.json({ gift });
});

// ─── POST /:id/pay ────────────────────────────────────────────────────────────

router.post('/:id/pay', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parse = payGiftSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  const { paymentIntentId } = parse.data;

  const existing = await prisma.gift.findFirst({
    where: { id: req.params['id'], senderId: req.user!.id },
    include: {
      sender: { select: { name: true, email: true } },
      brand: { select: { name: true, slug: true } },
    },
  });

  if (!existing) {
    res.status(404).json({ error: 'Gift not found' });
    return;
  }

  if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
    res.status(409).json({ error: 'Gift has already been paid and processed' });
    return;
  }

  // Verify payment intent succeeded with Stripe (skip in mock mode)
  if (stripe && !paymentIntentId.startsWith('mock_')) {
    let pi: import('stripe').Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (err) {
      console.error('Failed to retrieve payment intent:', err);
      res.status(400).json({ error: 'Invalid payment intent ID' });
      return;
    }

    if (pi.status !== 'succeeded') {
      res.status(402).json({
        error: `Payment not completed. Payment intent status: ${pi.status}`,
      });
      return;
    }
  }

  // Determine if scheduled for the future
  const isScheduled =
    existing.scheduledAt !== null && isFuture(existing.scheduledAt);

  const newStatus: GiftStatus = isScheduled ? 'SCHEDULED' : 'SENT';

  // Update gift with payment info first
  const updatedGift = await prisma.gift.update({
    where: { id: existing.id },
    data: {
      stripePaymentIntentId: paymentIntentId,
      status: newStatus,
      sentAt: isScheduled ? null : new Date(),
    },
    select: giftSelect,
  });

  // If sending now, fulfil the gift
  if (!isScheduled) {
    try {
      // Place Tango order — use recipient email or a placeholder
      const recipientEmailForTango =
        existing.recipientEmail ?? `gift+${existing.id}@sendolive.com`;

      const order = await placeOrder(
        existing.brand.slug.toUpperCase() + '-U',
        existing.amount / 100,
        recipientEmailForTango,
      );

      // Encrypt gift card code before storing
      const encryptedCode = encrypt(order.token);

      // Deliver the gift
      const giftUrl = buildGiftUrl(existing.recipientToken);

      if (existing.deliveryMethod === 'SMS' && existing.recipientPhone) {
        await sendSMS(
          existing.recipientPhone,
          giftUrl,
          existing.sender.name,
          existing.recipientName,
        );
      } else if (existing.deliveryMethod === 'EMAIL' && existing.recipientEmail) {
        await sendEmail(
          existing.recipientEmail,
          giftUrl,
          existing.sender.name,
          existing.recipientName,
          existing.brand.name,
        );
      }
      // LINK delivery — no outbound message, user shares manually

      // Update with gift card data
      const finalGift = await prisma.gift.update({
        where: { id: existing.id },
        data: {
          giftCardCode: encryptedCode,
          giftCardPin: order.utid, // store utid as pin reference
          aggregatorOrderId: order.utid,
          status: 'SENT',
          sentAt: new Date(),
        },
        select: giftSelect,
      });

      res.json({ gift: finalGift });
      return;
    } catch (err) {
      console.error('Gift fulfilment error (after payment):', err);
      // Payment succeeded but fulfilment failed — still return updated gift
      // In production you'd queue this for retry
      res.json({
        gift: updatedGift,
        warning: 'Payment succeeded but gift delivery encountered an error. Our team will follow up.',
      });
      return;
    }
  }

  res.json({ gift: updatedGift });
});

// ─── POST /:id/recall ─────────────────────────────────────────────────────────

router.post('/:id/recall', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.gift.findFirst({
    where: { id: req.params['id'], senderId: req.user!.id },
    select: {
      id: true,
      status: true,
      aggregatorOrderId: true,
      giftCardCode: true,
    },
  });

  if (!existing) {
    res.status(404).json({ error: 'Gift not found' });
    return;
  }

  if (existing.status === 'REDEEMED') {
    res.status(409).json({ error: 'Gift has already been redeemed and cannot be recalled' });
    return;
  }

  if (existing.status === 'RECALLED') {
    res.status(409).json({ error: 'Gift is already recalled' });
    return;
  }

  // Attempt Tango void if we have an order ID
  if (existing.aggregatorOrderId) {
    const voided = await voidOrder(existing.aggregatorOrderId);
    if (!voided) {
      console.warn(`[Gifts] Tango void failed for order ${existing.aggregatorOrderId}`);
    }
  }

  const gift = await prisma.gift.update({
    where: { id: existing.id },
    data: { status: 'RECALLED' },
    select: giftSelect,
  });

  res.json({ gift });
});

// ─── POST /:id/nudge ──────────────────────────────────────────────────────────

router.post('/:id/nudge', requireAuth, async (req: Request, res: Response): Promise<void> => {
  // Satisfy unused parameter lint requirement
  void (nudgeSchema && req.body);

  const existing = await prisma.gift.findFirst({
    where: { id: req.params['id'], senderId: req.user!.id },
    include: {
      sender: { select: { name: true } },
      brand: { select: { name: true } },
    },
  });

  if (!existing) {
    res.status(404).json({ error: 'Gift not found' });
    return;
  }

  const nudgeable: GiftStatus[] = ['SENT', 'DELIVERED', 'OPENED'];
  if (!nudgeable.includes(existing.status)) {
    res.status(409).json({
      error: `Cannot nudge a gift with status ${existing.status}. Must be SENT, DELIVERED, or OPENED.`,
    });
    return;
  }

  if (existing.nudgeSentAt !== null) {
    res.status(409).json({ error: 'A nudge has already been sent for this gift' });
    return;
  }

  const giftUrl = buildGiftUrl(existing.recipientToken);

  // Re-send delivery
  if (existing.deliveryMethod === 'SMS' && existing.recipientPhone) {
    await sendSMS(
      existing.recipientPhone,
      giftUrl,
      existing.sender.name,
      existing.recipientName,
    );
  } else if (existing.deliveryMethod === 'EMAIL' && existing.recipientEmail) {
    await sendEmail(
      existing.recipientEmail,
      giftUrl,
      existing.sender.name,
      existing.recipientName,
      existing.brand.name,
    );
  }

  const gift = await prisma.gift.update({
    where: { id: existing.id },
    data: { nudgeSentAt: new Date() },
    select: giftSelect,
  });

  res.json({ gift });
});

export default router;
