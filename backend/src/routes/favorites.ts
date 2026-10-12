import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, uid } from '../middleware/auth.js';

export const favoritesRouter = Router();
favoritesRouter.use(authRequired);

// GET /api/favorites
favoritesRouter.get('/', async (req, res) => {
  const rows = await prisma.favorite.findMany({
    where: { userId: uid(req) },
    include: { sentence: { include: { progress: { where: { userId: uid(req) } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    rows.map((r) => ({
      id: r.sentence.id,
      english: r.sentence.english,
      chinese: r.sentence.chinese,
      category: r.sentence.category,
      subCategory: r.sentence.subCategory,
      difficulty: r.sentence.difficulty,
      masteryLevel: r.sentence.progress[0]?.masteryLevel ?? 0,
      favorite: true,
      favoritedAt: r.createdAt,
    }))
  );
});

// POST /api/favorites/toggle { sentenceId } → { favorite: boolean }
favoritesRouter.post('/toggle', async (req, res) => {
  const sentenceId = parseInt(req.body?.sentenceId);
  if (!sentenceId) return res.status(400).json({ error: '缺少 sentenceId' });
  const existing = await prisma.favorite.findUnique({
    where: { userId_sentenceId: { userId: uid(req), sentenceId } },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return res.json({ favorite: false });
  }
  await prisma.favorite.create({ data: { userId: uid(req), sentenceId } });
  res.json({ favorite: true });
});
