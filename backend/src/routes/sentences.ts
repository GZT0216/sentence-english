import { Router } from 'express';
import { prisma } from '../db.js';
import { adminRequired, optionalAuth } from '../middleware/auth.js';

export const sentencesRouter = Router();
sentencesRouter.use(optionalAuth);

// GET /api/sentences?search=&category=&difficulty=&mastery=&favoritesOnly=&page=&pageSize=&sort=
sentencesRouter.get('/', async (req, res) => {
  const { search, category, difficulty, mastery, favoritesOnly } = req.query as Record<string, string>;
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize as string) || 50, 1), 500);
  const userId = req.userId;
  const favoritesOnlyFlag = favoritesOnly === '1' || favoritesOnly === 'true';
  if (favoritesOnlyFlag && !userId) return res.status(401).json({ error: '请先登录' });

  const where: any = {};
  if (search) {
    where.OR = [
      { english: { contains: search } },
      { chinese: { contains: search } },
      { tags: { contains: search } },
    ];
  }
  if (category) where.category = category;
  if (difficulty) where.difficulty = parseInt(difficulty);
  if (favoritesOnlyFlag) {
    where.favorites = { some: { userId } };
  }

  const include: any = userId
    ? { progress: { where: { userId } }, favorites: { where: { userId } } }
    : {};
  let rows: any[] = await prisma.sentence.findMany({
    where,
    include,
    orderBy: { id: 'asc' },
  });

  if (mastery !== undefined && mastery !== '') {
    const levels = mastery.split(',').map(Number);
    rows = rows.filter((r) => {
      const level = r.progress[0]?.masteryLevel ?? 0;
      return levels.includes(level);
    });
  }

  const total = rows.length;
  const items = rows.slice((page - 1) * pageSize, page * pageSize);
  res.json({
    total,
    page,
    pageSize,
    items: items.map(toSentenceDto),
  });
});

sentencesRouter.get('/:id', async (req, res) => {
  const userId = req.userId;
  const row = await prisma.sentence.findUnique({
    where: { id: parseInt(req.params.id) },
    include: userId
      ? { progress: { where: { userId } }, favorites: { where: { userId } } }
      : {},
  });
  if (!row) return res.status(404).json({ error: '句子不存在' });
  res.json(toSentenceDto(row));
});

sentencesRouter.post('/', adminRequired, async (req, res) => {
  const { english, chinese, category, subCategory, difficulty, tags, pronunciation, explanation } = req.body || {};
  if (!english?.trim()) return res.status(400).json({ error: '英文不能为空' });
  if (!chinese?.trim()) return res.status(400).json({ error: '中文不能为空' });
  try {
    const created = await prisma.sentence.create({
      data: {
        english: english.trim(),
        chinese: chinese.trim(),
        category: category?.trim() || '其他',
        subCategory: subCategory?.trim() || null,
        difficulty: clampDifficulty(difficulty),
        tags: tags?.trim() || null,
        pronunciation: pronunciation?.trim() || null,
        explanation: explanation?.trim() || null,
      },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: '该英文句子已存在' });
    throw e;
  }
});

sentencesRouter.put('/:id', adminRequired, async (req, res) => {
  const id = parseInt(req.params.id);
  const { english, chinese, category, subCategory, difficulty, tags, pronunciation, explanation } = req.body || {};
  if (english !== undefined && !english.trim()) return res.status(400).json({ error: '英文不能为空' });
  if (chinese !== undefined && !chinese.trim()) return res.status(400).json({ error: '中文不能为空' });
  try {
    const updated = await prisma.sentence.update({
      where: { id },
      data: {
        ...(english !== undefined ? { english: english.trim() } : {}),
        ...(chinese !== undefined ? { chinese: chinese.trim() } : {}),
        ...(category !== undefined ? { category: category.trim() || '其他' } : {}),
        ...(subCategory !== undefined ? { subCategory: subCategory?.trim() || null } : {}),
        ...(difficulty !== undefined ? { difficulty: clampDifficulty(difficulty) } : {}),
        ...(tags !== undefined ? { tags: tags?.trim() || null } : {}),
        ...(pronunciation !== undefined ? { pronunciation: pronunciation?.trim() || null } : {}),
        ...(explanation !== undefined ? { explanation: explanation?.trim() || null } : {}),
      },
    });
    res.json(updated);
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: '该英文句子已存在' });
    if (e?.code === 'P2025') return res.status(404).json({ error: '句子不存在' });
    throw e;
  }
});

sentencesRouter.delete('/:id', adminRequired, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.sentence.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: '句子不存在' });
    throw e;
  }
});

// GET /api/sentences/categories — 句子库中实际存在的分类及数量
sentencesRouter.get('/meta/categories', async (_req, res) => {
  const rows = await prisma.sentence.groupBy({ by: ['category'], _count: { _all: true } });
  res.json(rows.map((r) => ({ name: r.category, count: r._count._all })).sort((a, b) => b.count - a.count));
});

function clampDifficulty(v: unknown): number {
  const n = parseInt(String(v));
  if (Number.isNaN(n)) return 1;
  return Math.min(Math.max(n, 1), 5);
}

function toSentenceDto(row: any) {
  const p = row.progress?.[0];
  return {
    id: row.id,
    english: row.english,
    chinese: row.chinese,
    category: row.category,
    subCategory: row.subCategory,
    difficulty: row.difficulty,
    tags: row.tags,
    pronunciation: row.pronunciation,
    explanation: row.explanation,
    createdAt: row.createdAt,
    favorite: (row.favorites?.length ?? 0) > 0,
    masteryLevel: p?.masteryLevel ?? 0,
    practiceCount: p?.practiceCount ?? 0,
    correctCount: p?.correctCount ?? 0,
    wrongCount: p?.wrongCount ?? 0,
    nextReviewAt: p?.nextReviewAt ?? null,
  };
}
