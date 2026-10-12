import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, uid } from '../middleware/auth.js';
import { startOfToday, startOfDaysAgo, dayKey } from '../utils/time.js';

export const statsRouter = Router();
statsRouter.use(authRequired);

statsRouter.get('/summary', async (req, res) => {
  const userId = uid(req);
  const today = startOfToday();
  const weekAgo = startOfDaysAgo(6);
  const now = new Date();

  const [todayRecords, weekRecords, allRecords, totalSentences, mastered, learning, favoriteCount, wrongCount, dueCount, newCount, todayTime, totalTime] =
    await Promise.all([
      prisma.practiceRecord.findMany({ where: { userId, createdAt: { gte: today } } }),
      prisma.practiceRecord.findMany({ where: { userId, createdAt: { gte: weekAgo } } }),
      prisma.practiceRecord.findMany({ where: { userId }, select: { createdAt: true } }),
      prisma.sentence.count(),
      prisma.userSentenceProgress.count({ where: { userId, masteryLevel: { gte: 3 } } }),
      prisma.userSentenceProgress.count({ where: { userId, masteryLevel: { gte: 1, lte: 2 } } }),
      prisma.favorite.count({ where: { userId } }),
      prisma.userSentenceProgress.count({ where: { userId, wrongCount: { gt: 0 } } }),
      prisma.userSentenceProgress.count({ where: { userId, nextReviewAt: { lte: now } } }),
      totalNewSentenceCount(userId),
      prisma.studyTimeDaily.findUnique({ where: { userId_date: { userId, date: dayKey(now) } } }),
      prisma.studyTimeDaily.aggregate({ where: { userId }, _sum: { seconds: true } }),
    ]);

  const pct = (r: { length: number }, c: number) =>
    r.length === 0 ? 0 : Math.round((c / r.length) * 100);

  const todayCorrect = todayRecords.filter((r) => r.correct).length;
  const weekCorrect = weekRecords.filter((r) => r.correct).length;

  res.json({
    today: {
      practiced: todayRecords.length,
      correct: todayCorrect,
      wrong: todayRecords.length - todayCorrect,
      accuracy: pct(todayRecords, todayCorrect),
      goal: 20,
    },
    week: {
      practiced: weekRecords.length,
      days: countActiveDays([todayRecords, weekRecords, allRecords][2]),
      accuracy: pct(weekRecords, weekCorrect),
    },
    overall: {
      totalSentences,
      newSentences: newCount,
      studied: Math.max(totalSentences - newCount, 0),
      mastered,
      learning,
      mistakes: wrongCount,
      favorites: favoriteCount,
      dueReview: dueCount,
      streak: computeStreak(allRecords.map((r) => r.createdAt)),
      todayStudySeconds: todayTime?.seconds ?? 0,
      totalStudySeconds: totalTime._sum.seconds ?? 0,
    },
  });
});

async function totalNewSentenceCount(userId: number): Promise<number> {
  const [total, studied] = await Promise.all([
    prisma.sentence.count(),
    prisma.userSentenceProgress.count({ where: { userId } }),
  ]);
  return Math.max(total - studied, 0);
}

statsRouter.get('/trend', async (req, res) => {
  const userId = uid(req);
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 14, 7), 60);
  const from = startOfDaysAgo(days - 1);
  const [records, times] = await Promise.all([
    prisma.practiceRecord.findMany({
      where: { userId, createdAt: { gte: from } },
      select: { createdAt: true, correct: true, sentenceId: true },
    }),
    prisma.studyTimeDaily.findMany({ where: { userId, date: { gte: dayKey(from) } } }),
  ]);
  const secondsMap = new Map(times.map((t) => [t.date, t.seconds]));
  const buckets = new Map<string, { total: number; correct: number; sentences: Set<number> }>();
  for (let i = 0; i < days; i++) {
    const d = startOfDaysAgo(days - 1 - i);
    buckets.set(dayKey(d), { total: 0, correct: 0, sentences: new Set() });
  }
  for (const r of records) {
    const b = buckets.get(dayKey(r.createdAt));
    if (b) {
      b.total += 1;
      if (r.correct) b.correct += 1;
      b.sentences.add(r.sentenceId);
    }
  }
  res.json(
    [...buckets.entries()].map(([date, b]) => ({
      date,
      practiced: b.total,
      sentences: b.sentences.size,
      correct: b.correct,
      accuracy: b.total === 0 ? 0 : Math.round((b.correct / b.total) * 100),
      seconds: secondsMap.get(date) ?? 0,
    }))
  );
});

statsRouter.get('/mastery', async (req, res) => {
  const userId = uid(req);
  const rows = await prisma.userSentenceProgress.groupBy({
    by: ['masteryLevel'],
    where: { userId },
    _count: { _all: true },
  });
  const total = await prisma.sentence.count();
  const studied = rows.reduce((s, r) => s + r._count._all, 0);
  res.json({
    total,
    unlearned: Math.max(total - studied, 0),
    levels: [0, 1, 2, 3, 4].map((l) => ({
      level: l,
      count: rows.find((r) => r.masteryLevel === l)?._count._all ?? 0,
    })),
  });
});

function countActiveDays(records: { createdAt: Date }[]): number {
  return new Set(records.map((r) => dayKey(r.createdAt))).size;
}

function computeStreak(dates: Date[]): number {
  const days = new Set(dates.map((d) => dayKey(d)));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
