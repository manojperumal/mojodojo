import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { stripe } from '../lib/stripe';
import { requireAuth, signToken } from '../middleware/auth';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── POST /register ───────────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  const { name, email, password } = parse.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Create Stripe customer
  let stripeCustomerId: string | undefined;
  try {
    const customer = await stripe.customers.create({ email, name });
    stripeCustomerId = customer.id;
  } catch (err) {
    console.error('Failed to create Stripe customer:', err);
    // Non-fatal — continue without Stripe customer
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      stripeCustomerId: stripeCustomerId ?? null,
    },
  });

  const token = signToken({ id: user.id, email: user.email });

  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
      notificationsEnabled: user.notificationsEnabled,
      createdAt: user.createdAt,
    },
  });
});

// ─── POST /login ──────────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  const { email, password } = parse.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signToken({ id: user.id, email: user.email });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
      notificationsEnabled: user.notificationsEnabled,
      createdAt: user.createdAt,
    },
  });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    stripeCustomerId: user.stripeCustomerId,
    notificationsEnabled: user.notificationsEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});

export default router;
