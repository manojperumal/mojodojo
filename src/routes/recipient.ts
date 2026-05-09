import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { decrypt } from '../lib/crypto';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const thankYouSchema = z.object({
  message: z.string().min(1).max(300),
});

// ─── GET /:token ──────────────────────────────────────────────────────────────
// Public — no auth required

router.get('/:token', async (req: Request, res: Response): Promise<void> => {
  const gift = await prisma.gift.findUnique({
    where: { recipientToken: req.params['token'] },
    include: {
      sender: { select: { name: true } },
      brand: { select: { name: true, logoUrl: true } },
      cardDesign: { select: { imageUrl: true, thumbnailUrl: true } },
    },
  });

  if (!gift) {
    res.status(404).json({ error: 'Gift not found' });
    return;
  }

  if (gift.status === 'RECALLED') {
    res.status(410).json({
      error: 'This gift has been recalled by the sender and is no longer available.',
    });
    return;
  }

  // Advance status to DELIVERED if it was SENT
  if (gift.status === 'SENT') {
    await prisma.gift.update({
      where: { id: gift.id },
      data: {
        status: 'DELIVERED',
        deliveredAt: gift.deliveredAt ?? new Date(),
      },
    });
  }

  res.json({
    id: gift.id,
    senderName: gift.sender.name,
    recipientName: gift.recipientName,
    brandName: gift.brand.name,
    brandLogoUrl: gift.brand.logoUrl,
    cardDesignImageUrl: gift.cardDesign.imageUrl,
    cardDesignThumbnailUrl: gift.cardDesign.thumbnailUrl,
    message: gift.message,
    signatureData: gift.signatureData,
    signatureMode: gift.signatureMode,
    deliveryMethod: gift.deliveryMethod,
    amount: gift.amount, // cents
    status: gift.status === 'SENT' ? 'DELIVERED' : gift.status,
    scheduledAt: gift.scheduledAt,
    createdAt: gift.createdAt,
  });
});

// ─── POST /:token/open ────────────────────────────────────────────────────────

router.post('/:token/open', async (req: Request, res: Response): Promise<void> => {
  const gift = await prisma.gift.findUnique({
    where: { recipientToken: req.params['token'] },
    select: { id: true, status: true, openedAt: true },
  });

  if (!gift) {
    res.status(404).json({ error: 'Gift not found' });
    return;
  }

  if (gift.status === 'RECALLED') {
    res.status(410).json({ error: 'This gift has been recalled' });
    return;
  }

  const openableStatuses = ['SENT', 'DELIVERED', 'OPENED', 'REDEEMED'];
  if (!openableStatuses.includes(gift.status)) {
    res.status(409).json({ error: `Cannot open a gift with status ${gift.status}` });
    return;
  }

  // Idempotent — only update if not yet opened
  if (!gift.openedAt) {
    await prisma.gift.update({
      where: { id: gift.id },
      data: {
        status: gift.status === 'REDEEMED' ? 'REDEEMED' : 'OPENED',
        openedAt: new Date(),
      },
    });
  }

  res.json({ opened: true });
});

// ─── POST /:token/redeem ──────────────────────────────────────────────────────

router.post('/:token/redeem', async (req: Request, res: Response): Promise<void> => {
  const gift = await prisma.gift.findUnique({
    where: { recipientToken: req.params['token'] },
    select: {
      id: true,
      status: true,
      giftCardCode: true,
      giftCardPin: true,
      redeemedAt: true,
    },
  });

  if (!gift) {
    res.status(404).json({ error: 'Gift not found' });
    return;
  }

  if (gift.status === 'RECALLED') {
    res.status(410).json({ error: 'This gift has been recalled' });
    return;
  }

  const redeemableStatuses = ['SENT', 'DELIVERED', 'OPENED', 'REDEEMED'];
  if (!redeemableStatuses.includes(gift.status)) {
    res.status(409).json({ error: `Cannot redeem a gift with status ${gift.status}` });
    return;
  }

  if (!gift.giftCardCode) {
    res.status(503).json({ error: 'Gift card code is not yet available. Please try again shortly.' });
    return;
  }

  // Idempotent — mark redeemed if not already
  if (gift.status !== 'REDEEMED') {
    await prisma.gift.update({
      where: { id: gift.id },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
      },
    });
  }

  // Decrypt the gift card code
  let giftCardCode: string;
  try {
    giftCardCode = decrypt(gift.giftCardCode);
  } catch (err) {
    console.error('Failed to decrypt gift card code:', err);
    res.status(500).json({ error: 'Failed to retrieve gift card code. Please contact support.' });
    return;
  }

  res.json({
    giftCardCode,
    giftCardPin: gift.giftCardPin ?? null,
  });
});

// ─── POST /:token/thankyou ────────────────────────────────────────────────────

router.post('/:token/thankyou', async (req: Request, res: Response): Promise<void> => {
  const parse = thankYouSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  const gift = await prisma.gift.findUnique({
    where: { recipientToken: req.params['token'] },
    select: { id: true, status: true },
  });

  if (!gift) {
    res.status(404).json({ error: 'Gift not found' });
    return;
  }

  if (gift.status === 'RECALLED') {
    res.status(410).json({ error: 'This gift has been recalled' });
    return;
  }

  await prisma.gift.update({
    where: { id: gift.id },
    data: { thankYouMessage: parse.data.message },
  });

  res.json({ sent: true });
});

export default router;
