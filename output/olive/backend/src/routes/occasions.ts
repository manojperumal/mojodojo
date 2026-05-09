import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// ─── Seed data ────────────────────────────────────────────────────────────────

interface MockOccasion {
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
}

const MOCK_OCCASIONS: MockOccasion[] = [
  { slug: 'birthday', label: 'Birthday', emoji: '🎂', sortOrder: 1 },
  { slug: 'graduation', label: 'Graduation', emoji: '🎓', sortOrder: 2 },
  { slug: 'celebration', label: 'Celebration', emoji: '🥳', sortOrder: 3 },
  { slug: 'thank-you', label: 'Thank You', emoji: '🙏', sortOrder: 4 },
  { slug: 'thinking-of-you', label: 'Thinking of You', emoji: '💭', sortOrder: 5 },
  { slug: 'just-because', label: 'Just Because', emoji: '💝', sortOrder: 6 },
];

async function ensureOccasionsSeeded(): Promise<void> {
  const count = await prisma.occasion.count();
  if (count > 0) return;

  await prisma.occasion.createMany({
    data: MOCK_OCCASIONS.map((o) => ({ ...o, active: true })),
    skipDuplicates: true,
  });

  console.log('[Occasions] Seeded 6 occasions');
}

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  await ensureOccasionsSeeded();

  const occasions = await prisma.occasion.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      slug: true,
      label: true,
      emoji: true,
      sortOrder: true,
    },
  });

  res.json({ occasions });
});

export default router;
