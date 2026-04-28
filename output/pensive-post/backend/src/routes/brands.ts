import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

// ─── Mock seed data ───────────────────────────────────────────────────────────

interface MockBrand {
  slug: string;
  name: string;
  logoUrl: string;
  category: string;
}

const MOCK_BRANDS: MockBrand[] = [
  { slug: 'starbucks', name: 'Starbucks', logoUrl: 'https://logo.clearbit.com/starbucks.com', category: 'Coffee & Drinks' },
  { slug: 'doordash', name: 'DoorDash', logoUrl: 'https://logo.clearbit.com/doordash.com', category: 'Food Delivery' },
  { slug: 'uber-eats', name: 'Uber Eats', logoUrl: 'https://logo.clearbit.com/ubereats.com', category: 'Food Delivery' },
  { slug: 'amazon', name: 'Amazon', logoUrl: 'https://logo.clearbit.com/amazon.com', category: 'Shopping' },
  { slug: 'nordstrom', name: 'Nordstrom', logoUrl: 'https://logo.clearbit.com/nordstrom.com', category: 'Fashion' },
  { slug: 'target', name: 'Target', logoUrl: 'https://logo.clearbit.com/target.com', category: 'Shopping' },
  { slug: 'whole-foods', name: 'Whole Foods', logoUrl: 'https://logo.clearbit.com/wholefoodsmarket.com', category: 'Grocery' },
  { slug: '1800flowers', name: '1-800-Flowers', logoUrl: 'https://logo.clearbit.com/1800flowers.com', category: 'Flowers & Gifts' },
  { slug: 'sephora', name: 'Sephora', logoUrl: 'https://logo.clearbit.com/sephora.com', category: 'Beauty' },
  { slug: 'apple', name: 'Apple', logoUrl: 'https://logo.clearbit.com/apple.com', category: 'Technology' },
  { slug: 'nike', name: 'Nike', logoUrl: 'https://logo.clearbit.com/nike.com', category: 'Sports & Apparel' },
  { slug: 'netflix', name: 'Netflix', logoUrl: 'https://logo.clearbit.com/netflix.com', category: 'Entertainment' },
];

async function ensureBrandsSeeded(): Promise<void> {
  const count = await prisma.brand.count();
  if (count > 0) return;

  await prisma.brand.createMany({
    data: MOCK_BRANDS.map((b) => ({ ...b, active: true })),
    skipDuplicates: true,
  });

  console.log('[Brands] Seeded 12 mock brands');
}

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  await ensureBrandsSeeded();

  const brands = await prisma.brand.findMany({
    where: { active: true },
    select: { id: true, slug: true, name: true, logoUrl: true, category: true },
    orderBy: { name: 'asc' },
  });

  res.json({ brands });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const brand = await prisma.brand.findFirst({
    where: {
      OR: [{ id: req.params.id }, { slug: req.params.id }],
      active: true,
    },
    select: { id: true, slug: true, name: true, logoUrl: true, category: true },
  });

  if (!brand) {
    res.status(404).json({ error: 'Brand not found' });
    return;
  }

  res.json({ brand });
});

export default router;
