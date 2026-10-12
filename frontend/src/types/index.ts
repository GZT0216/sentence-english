export interface Sentence {
  id: number;
  english: string;
  chinese: string;
  category: string;
  subCategory: string | null;
  difficulty: number;
  tags?: string | null;
  pronunciation?: string | null;
  explanation?: string | null;
  favorite: boolean;
  masteryLevel: number; // 0未学习 1学习中 2熟悉 3掌握 4熟练
  practiceCount?: number;
  correctCount?: number;
  wrongCount?: number;
  consecutiveCorrect?: number;
  lastPracticeAt?: string | null;
  nextReviewAt?: string | null;
  favoritedAt?: string;
}

export interface SentenceListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: Sentence[];
}

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
}

export type PracticeType = 'zh2en' | 'en2zh' | 'order' | 'listening';

export interface PracticeResult {
  correct: boolean;
  result: {
    practiceCount: number;
    correctCount: number;
    wrongCount: number;
    consecutiveCorrect: number;
    masteryLevel: number;
    nextReviewAt: string;
  };
}

export interface DailyResponse {
  date: string;
  requested: number;
  dueCount: number;
  items: Sentence[];
}

export interface StatsSummary {
  today: { practiced: number; correct: number; wrong: number; accuracy: number; goal: number };
  week: { practiced: number; days: number; accuracy: number };
  overall: {
    totalSentences: number;
    newSentences: number;
    studied: number;
    mastered: number;
    learning: number;
    mistakes: number;
    favorites: number;
    dueReview: number;
    streak: number;
    todayStudySeconds?: number;
    totalStudySeconds?: number;
  };
}

export interface StudyPosition {
  userId: number;
  category: string | null;
  difficulty: number | null;
  lastSentenceId: number | null;
  updatedAt: string;
}

export interface TrendPoint {
  date: string;
  practiced: number;
  sentences: number;
  correct: number;
  accuracy: number;
  seconds?: number;
}

export interface MasteryDistribution {
  total: number;
  unlearned: number;
  levels: { level: number; count: number }[];
}

export interface ImportResponse {
  total: number;
  imported: number;
  duplicated: number;
  failed: number;
  errors: string[];
  truncatedErrors: number;
}

export const MASTERY_LABEL: Record<number, string> = {
  0: '未学习',
  1: '学习中',
  2: '熟悉',
  3: '掌握',
  4: '熟练',
};

export const PRACTICE_LABEL: Record<PracticeType, string> = {
  zh2en: '中译英',
  en2zh: '英译中',
  order: '单词拼句',
  listening: '听力模式',
};
