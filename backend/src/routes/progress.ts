import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, uid } from '../middleware/auth.js';
import { dayKey } from '../utils/time.js';

export const progressRouter = Router();
progressRouter.use(authRequired);

// PUT /api/progress/position { category?, difficulty?, lastSentenceId? } — 保存上次学习位置
progressRouter.put('/position', async (req, res) => {
  const userId = uid(req);
  const category = req.body?.category ? String(req.body.category) : null;
  const difficulty = req.body?.difficulty != null ? parseInt(req.body.difficulty) : null;
  const lastSentenceId = req.body?.lastSentenceId != null ? parseInt(req.body.lastSentenceId) : null;

  const position = await prisma.studyPosition.upsert({
    where: { userId },
    create: { userId, category, difficulty, lastSentenceId },
    update: { category, difficulty, lastSentenceId },
  });
  res.json(position);
});

progressRouter.get('/position', async (req, res) => {
  const position = await prisma.studyPosition.findUnique({ where: { userId: uid(req) } });
  res.json(position);
});

// POST /api/progress/study-time { seconds } — 会话结束时上报本次学习时长
progressRouter.post('/study-time', async (req, res) => {
  const seconds = Math.min(Math.max(parseInt(req.body?.seconds) || 0, 0), 6 * 3600);
  if (!seconds) return res.json({ ok: true, seconds: 0 });

  const date = dayKey(new Date());
  const row = await prisma.studyTimeDaily.upsert({
    where: { userId_date: { userId: uid(req), date } },
    create: { userId: uid(req), date, seconds },
    update: { seconds: { increment: seconds } },
  });
  res.json({ ok: true, date, totalToday: row.seconds });
});

// GET /api/progress/study-time?days=14 — 近 N 天每日时长
progressRouter.get('/study-time', async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 14, 1), 60);
  const rows = await prisma.studyTimeDaily.findMany({
    where: { userId: uid(req) },
    orderBy: { date: 'desc' },
    take: days,
  });
  res.json({ total: rows.reduce((s, r) => s + r.seconds, 0), days: rows.map((r) => ({ date: r.date, seconds: r.seconds })) });
});
