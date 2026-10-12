import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { PRACTICE_LABEL, type PracticeType, type StudyPosition } from '../types';
import { Card } from '../components/ui/Card';

const MODE_DESC: Record<PracticeType, { desc: string; icon: string }> = {
  zh2en: { desc: '看中文，写出英文句子', icon: '中→英' },
  en2zh: { desc: '看英文，写出中文翻译并自评', icon: '英→中' },
  order: { desc: '点击打乱的单词，拼出完整句子', icon: '拼句' },
  listening: { desc: '听朗读，默写你听到的句子', icon: '🔊' },
};

export default function Study() {
  const [position, setPosition] = useState<StudyPosition | null>(null);

  useEffect(() => {
    api.progress.getPosition().then(setPosition).catch(() => undefined);
  }, []);

  const resumeUrl = position?.category
    ? `/study/session?mode=zh2en&source=daily&category=${encodeURIComponent(position.category)}`
    : '/study/session?mode=zh2en&source=daily';

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">开始学习</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">选择一种练习模式，每次 20 个句子</p>
      </div>

      {position?.lastSentenceId != null && (
        <Card className="flex items-center justify-between gap-4 border-indigo-200 p-4 dark:border-indigo-900">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            上次学到{position.category ? `「${position.category}」` : '每日任务'}，继续按原节奏练？
          </p>
          <Link to={resumeUrl}>
            <span className="whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500">
              继续上次的
            </span>
          </Link>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(PRACTICE_LABEL) as PracticeType[]).map((m) => (
          <Link key={m} to={`/study/session?mode=${m}&source=daily`}>
            <Card className="flex h-full items-start gap-4 p-5 transition-colors hover:border-indigo-300 dark:hover:border-indigo-700">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 text-sm font-semibold text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300">
                {MODE_DESC[m].icon}
              </span>
              <span>
                <span className="block font-medium">{PRACTICE_LABEL[m]}</span>
                <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">{MODE_DESC[m].desc}</span>
              </span>
            </Card>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-400">按题源练习</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/study/session?mode=zh2en&source=mistakes">
            <Card className="p-5 transition-colors hover:border-rose-300 dark:hover:border-rose-700">
              <span className="block font-medium">错题重练</span>
              <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">集中攻克拉下分数的句子</span>
            </Card>
          </Link>
          <Link to="/study/session?mode=zh2en&source=favorites">
            <Card className="p-5 transition-colors hover:border-amber-300 dark:hover:border-amber-700">
              <span className="block font-medium">收藏句练习</span>
              <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">优先练你标记过的句子</span>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  );
}
