import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, uid } from '../middleware/auth.js';
import { startOfToday } from '../utils/time.js';

export const dailyRouter = Router();
dailyRouter.use(authRequired);

// GET /api/daily?count=20&category=&mode= — 生成今日学习队列
// 优先级：1 到期复习 2 错题 3 未学习 4 已学但掌握度低
dailyRouter.get('/', async (req, res) => {
  const count = Math.min(Math.max(parseInt(req.query.count as string) || 20, 1), 100);
  const category = req.query.category as string | undefined;
  const source = req.query.source as string | undefined; // 'mistakes' | 'favorites' | undefined(=daily)

  const sentenceWhere: any = {};
  if (category) sentenceWhere.category = category;

  if (source === 'favorites') {
    sentenceWhere.favorites = { some: { userId: uid(req) } };
  }

  const progress = await prisma.userSentenceProgress.findMany({
    where: { userId: uid(req) },
  });
  const progressMap = new Map(progress.map((p) => [p.sentenceId, p]));
  const now = new Date();
  const today = startOfToday();

  // 今日已练过的句子不再进入队列
  const practicedToday = new Set(
    progress.filter((p) => p.lastPracticeAt && p.lastPracticeAt >= today).map((p) => p.sentenceId)
  );

  let sentences = await prisma.sentence.findMany({
    where: sentenceWhere,
    include: { favorites: { where: { userId: uid(req) } } },
  });
  if (source === 'mistakes') {
    sentences = sentences.filter((s) => (progressMap.get(s.id)?.wrongCount ?? 0) > 0);
  }

  const due: typeof sentences = [];
  const wrong: typeof sentences = [];
  const fresh: typeof sentences = [];
  const low: typeof sentences = [];

  for (const s of sentences) {
    if (practicedToday.has(s.id)) continue;
    const p = progressMap.get(s.id);
    if (!p) {
      fresh.push(s);
    } else if (p.nextReviewAt && p.nextReviewAt <= now) {
      due.push(s);
    } else if (p.wrongCount > p.correctCount && p.masteryLevel < 3) {
      wrong.push(s);
    } else if (p.masteryLevel < 2) {
      low.push(s);
    }
  }

  const queue = [...due, ...wrong, ...fresh, ...low].slice(0, count);

  res.json({
    date: today.toISOString(),
    requested: count,
    dueCount: due.length,
    items: queue.map((s) => {
      const p = progressMap.get(s.id);
      return {
        id: s.id,
        english: s.english,
        chinese: s.chinese,
        category: s.category,
        subCategory: s.subCategory,
        difficulty: s.difficulty,
        favorite: (s.favorites?.length ?? 0) > 0,
        masteryLevel: p?.masteryLevel ?? 0,
        wrongCount: p?.wrongCount ?? 0,
        correctCount: p?.correctCount ?? 0,
      };
    }),
  });
});
