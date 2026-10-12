// 简单复习间隔（第一版，非完整 SRS）：
// 连续答对 1/2/3/4/5+ 次 → 1/3/7/14/30 天后复习；答错 → 次日重新进入短期复习

const INTERVALS_DAYS = [1, 3, 7, 14, 30];

export function nextReviewDate(consecutiveCorrectAfter: number, from: Date = new Date()): Date {
  const idx = Math.min(Math.max(consecutiveCorrectAfter - 1, 0), INTERVALS_DAYS.length - 1);
  const d = new Date(from);
  d.setDate(d.getDate() + INTERVALS_DAYS[idx]);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function computeMastery(prevMastery: number, consecutiveCorrect: number): number {
  if (consecutiveCorrect <= 0) return Math.min(prevMastery, 1);
  // 0 未学习 1 学习中 2 熟悉 3 掌握 4 熟练
  if (consecutiveCorrect >= 5) return 4;
  if (consecutiveCorrect >= 3) return 3;
  if (consecutiveCorrect >= 2) return Math.max(2, prevMastery);
  return Math.max(1, prevMastery);
}
