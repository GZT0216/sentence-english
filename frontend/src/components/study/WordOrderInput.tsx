import { useMemo, useState } from 'react';
import { playStroke } from '../../audio/typingSound';

export function shuffleWords(english: string): string[] {
  const words = english.trim().split(/\s+/);
  const arr = [...words];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // 避免打乱后与原句顺序完全一致
  if (arr.length > 2 && arr.every((w, i) => w === words[i])) return shuffleWords(english);
  return arr;
}

// 单词与附着标点拆分：保持 "don't"、"p.m."、"Friday," 等作为整体 chip
function splitTokens(words: string[]): { token: string; trailing: string }[] {
  return words.map((w) => {
    const m = w.match(/^([\w'’.-]*?)([,.!?;:“”"'])$/);
    if (m && m[1]) return { token: m[1], trailing: m[2] };
    return { token: w, trailing: '' };
  });
}

export function WordOrderInput({
  english,
  onSubmit,
  disabled,
}: {
  english: string;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
}) {
  const tokens = useMemo(() => splitTokens(english.trim().split(/\s+/)), [english]);
  const pool = useMemo(() => {
    const idx = tokens.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }, [tokens]);

  const [remaining, setRemaining] = useState<number[]>(pool);
  const [chosen, setChosen] = useState<number[]>([]);

  const pick = (i: number) => {
    playStroke('key');
    setRemaining((r) => r.filter((x) => x !== i));
    setChosen((c) => [...c, i]);
  };
  const unpick = (i: number) => {
    playStroke('delete');
    setChosen((c) => c.filter((x) => x !== i));
    setRemaining((r) => [...r, i]);
  };
  const answer = chosen.map((i) => tokens[i].token + tokens[i].trailing).join(' ');

  const chipCls =
    'rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500 dark:hover:bg-slate-700';

  return (
    <div className="space-y-4">
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/40">
        {chosen.length === 0 && <span className="text-sm text-slate-400">点击下方单词，按顺序组成句子…</span>}
        {chosen.map((i) => (
          <button key={i} onClick={() => !disabled && unpick(i)} className={`${chipCls} border-indigo-300 bg-indigo-50 dark:border-indigo-500/60 dark:bg-indigo-950/40`}>
            {tokens[i].token}
            {tokens[i].trailing}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {remaining.map((i) => (
          <button key={i} onClick={() => !disabled && pick(i)} disabled={disabled} className={chipCls}>
            {tokens[i].token}
            <span className="text-slate-400">{tokens[i].trailing}</span>
          </button>
        ))}
        {remaining.length === 0 && chosen.length > 0 && (
          <button onClick={() => { playStroke('delete'); setChosen([]); setRemaining(pool); }} disabled={disabled} className="ml-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            清空重排
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { if (answer) playStroke('submit'); onSubmit(answer); }}
          disabled={disabled || remaining.length > 0}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          提交
        </button>
      </div>
    </div>
  );
}
