import type { ReactNode } from 'react';
import { Card } from './Card';

export function StatCard({
  label,
  value,
  suffix,
  hint,
  accent = 'text-slate-800 dark:text-slate-100',
}: {
  label: string;
  value: number | string;
  suffix?: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-5">
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
      <span className={`text-2xl font-semibold tracking-tight ${accent}`}>
        {value}
        {suffix && <span className="ml-0.5 text-sm font-normal text-slate-400">{suffix}</span>}
      </span>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </Card>
  );
}

export function ProgressBar({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const pct = max <= 0 ? 0 : Math.min(Math.round((value / max) * 100), 100);
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}>
      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function GoalRing({ value, max, size = 120 }: { value: number; max: number; size?: number }) {
  const pct = max <= 0 ? 0 : Math.min(value / max, 1);
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const done = pct >= 1;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="10" className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={done ? 'stroke-emerald-500' : 'stroke-indigo-500'}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        <span className="text-xs text-slate-400">/ {max}</span>
      </div>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <div className="text-3xl text-slate-300 dark:text-slate-600">⌘</div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      {action}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
    </div>
  );
}
