import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, uid } from '../middleware/auth.js';
import { isEnglishAnswerCorrect, isChineseAnswerAcceptable } from '../utils/answer.js';
import { nextReviewDate, computeMastery } from '../utils/srs.js';

export const practiceRouter = Router();
practiceRouter.use(authRequired);

export type PracticeType = 'zh2en' | 'en2zh' | 'order' | 'listening';

// POST /api/practice
// { sentenceId, practiceType, userAnswer, selfJudged? } → { correct, sentence(带最新进度) }
practiceRouter.post('/', async (req, res) => {
  const { sentenceId, practiceType, userAnswer, selfJudged } = req.body || {};
  const sid = parseInt(sentenceId);
  const type = String(practiceType) as PracticeType;
  if (!sid || !type) return res.status(400).json({ error: '参数不完整' });
  if (!['zh2en', 'en2zh', 'order', 'listening'].includes(type)) {
    return res.status(400).json({ error: '不支持的练习类型' });
  }

  const sentence = await prisma.sentence.findUnique({ where: { id: sid } });
  if (!sentence) return res.status(404).json({ error: '句子不存在' });

  let correct: boolean;
  if (type === 'zh2en' || type === 'order' || type === 'listening') {
    correct = isEnglishAnswerCorrect(String(userAnswer ?? ''), sentence.english);
  } else {
    // en2zh：优先用户自评；若给出答案且无自评则用宽松匹配
    if (typeof selfJudged === 'boolean') correct = selfJudged;
    else correct = isChineseAnswerAcceptable(String(userAnswer ?? ''), sentence.chinese);
  }

  const progress = await prisma.userSentenceProgress.upsert({
    where: { userId_sentenceId: { userId: uid(req), sentenceId: sid } },
    create: { userId: uid(req), sentenceId: sid },
    update: {},
  });

  const now = new Date();
  const consecutiveCorrect = correct ? progress.consecutiveCorrect + 1 : 0;
  const masteryLevel = computeMastery(progress.masteryLevel, consecutiveCorrect);
  const nextReviewAt = correct ? nextReviewDate(consecutiveCorrect, now) : nextReviewDate(1, now);

  const updated = await prisma.userSentenceProgress.update({
    where: { id: progress.id },
    data: {
      practiceCount: progress.practiceCount + 1,
      correctCount: progress.correctCount + (correct ? 1 : 0),
      wrongCount: progress.wrongCount + (correct ? 0 : 1),
      consecutiveCorrect,
      masteryLevel,
      lastPracticeAt: now,
      nextReviewAt,
    },
  });

  await prisma.practiceRecord.create({
    data: {
      userId: uid(req),
      sentenceId: sid,
      practiceType: type,
      userAnswer: String(userAnswer ?? '').slice(0, 500),
      correct,
    },
  });

  res.json({
    correct,
    result: {
      practiceCount: updated.practiceCount,
      correctCount: updated.correctCount,
      wrongCount: updated.wrongCount,
      consecutiveCorrect: updated.consecutiveCorrect,
      masteryLevel: updated.masteryLevel,
      nextReviewAt: updated.nextReviewAt,
    },
  });
});

// GET /api/practice/mistakes — 错题本
practiceRouter.get('/mistakes', async (req, res) => {
  const rows = await prisma.userSentenceProgress.findMany({
    where: { userId: uid(req), wrongCount: { gt: 0 } },
    include: { sentence: { include: { favorites: { where: { userId: uid(req) } } } } },
    orderBy: [{ wrongCount: 'desc' }, { lastPracticeAt: 'desc' }],
  });
  res.json(
    rows.map((r) => ({
      id: r.sentence.id,
      english: r.sentence.english,
      chinese: r.sentence.chinese,
      category: r.sentence.category,
      subCategory: r.sentence.subCategory,
      difficulty: r.sentence.difficulty,
      favorite: (r.sentence.favorites?.length ?? 0) > 0,
      practiceCount: r.practiceCount,
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
      consecutiveCorrect: r.consecutiveCorrect,
      masteryLevel: r.masteryLevel,
      lastPracticeAt: r.lastPracticeAt,
      nextReviewAt: r.nextReviewAt,
    }))
  );
});

// DELETE /api/practice/mistakes/:sentenceId — 从错题本移除（清除该句进度中的错误计数）
practiceRouter.delete('/mistakes/:sentenceId', async (req, res) => {
  const sid = parseInt(req.params.sentenceId);
  await prisma.userSentenceProgress.updateMany({
    where: { userId: uid(req), sentenceId: sid },
    data: { wrongCount: 0, consecutiveCorrect: 0, nextReviewAt: new Date() },
  });
  res.json({ ok: true });
});
