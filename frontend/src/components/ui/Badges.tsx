import type { ReactNode } from 'react';
import { MASTERY_LABEL, type Sentence } from '../../types';

const masteryColors: Record<number, string> = {
  0: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  1: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300',
  2: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
  3: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
  4: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300',
};

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function MasteryBadge({ level }: { level: number }) {
  return <Badge className={masteryColors[level] ?? masteryColors[0]}>{MASTERY_LABEL[level] ?? '未学习'}</Badge>;
}

export function CategoryBadge({ sentence }: { sentence: Pick<Sentence, 'category' | 'subCategory'> }) {
  return (
    <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {sentence.category}
      {sentence.subCategory ? ` · ${sentence.subCategory}` : ''}
    </Badge>
  );
}

export function FavoriteButton({
  favorite,
  onToggle,
  size = 'md',
}: {
  favorite: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={favorite ? '取消收藏' : '收藏'}
      title={favorite ? '已收藏' : '收藏'}
      className={`shrink-0 rounded-full text-amber-400 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/40 ${
        size === 'sm' ? 'p-1 text-base' : 'p-1.5 text-xl'
      }`}
    >
      {favorite ? '★' : <span className="text-slate-300 dark:text-slate-600">☆</span>}
    </button>
  );
}
