import type { TrendPoint } from '../../types';

// 手写 SVG 图表，零第三方依赖
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const w = 640;
  const h = 180;
  const pad = { l: 8, r: 8, t: 12, b: 22 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.practiced), 5);
  const x = (i: number) => pad.l + (iw * i) / Math.max(data.length - 1, 1);
  const y = (v: number) => pad.t + ih - (ih * v) / max;
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.practiced)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="学习趋势图">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad.l} x2={w - pad.r} y1={pad.t + ih * f} y2={pad.t + ih * f} stroke="currentColor" strokeOpacity="0.08" />
      ))}
      <path d={area} fill="url(#trendFill)" />
      <path d={line} fill="none" stroke="rgb(99 102 241)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={d.date} cx={x(i)} cy={y(d.practiced)} r="2.5" fill="rgb(99 102 241)">
          <title>{`${d.date}：练习 ${d.practiced} 次，正确率 ${d.accuracy}%`}</title>
        </circle>
      ))}
      {data.map((d, i) =>
        i % Math.ceil(data.length / 5) === 0 || i === data.length - 1 ? (
          <text key={d.date} x={x(i)} y={h - 6} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.4">
            {d.date.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  );
}

export function AccuracyBars({ data }: { data: TrendPoint[] }) {
  return (
    <div className="flex h-24 items-end gap-1">
      {data.map((d) => (
        <div key={d.date} className="group relative flex-1" title={`${d.date} 正确率 ${d.accuracy}%`}>
          <div
            className={`w-full rounded-t-sm transition-colors ${
              d.practiced === 0
                ? 'bg-slate-100 dark:bg-slate-800'
                : d.accuracy >= 80
                  ? 'bg-emerald-400/80 dark:bg-emerald-500/70'
                  : d.accuracy >= 50
                    ? 'bg-amber-400/80 dark:bg-amber-500/70'
                    : 'bg-rose-400/80 dark:bg-rose-500/70'
            }`}
            style={{ height: `${Math.max(d.practiced === 0 ? 4 : d.accuracy, 6)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

const LEVEL_COLORS = [
  'bg-slate-200 dark:bg-slate-700',
  'bg-sky-400',
  'bg-amber-400',
  'bg-emerald-400',
  'bg-violet-400',
];
const LEVEL_LABELS = ['未学习', '学习中', '熟悉', '掌握', '熟练'];

export function MasteryBar({ levels, unlearned }: { levels: { level: number; count: number }[]; unlearned: number }) {
  const countAt = (level: number) => levels.find((l) => l.level === level)?.count ?? 0;
  // 掌握度 0 的句子（练过但一次都没答对）与从未接触的句子都是"未学习"，合并为一组，避免图例出现两个同名标签
  const groups = [
    { label: LEVEL_LABELS[0], count: unlearned + countAt(0) },
    ...[1, 2, 3, 4].map((level) => ({ label: LEVEL_LABELS[level], count: countAt(level) })),
  ];
  const total = Math.max(groups.reduce((s, g) => s + g.count, 0), 1);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {groups.map(
          (g, i) =>
            g.count > 0 ? (
              <div key={g.label} className={LEVEL_COLORS[i]} style={{ width: `${(g.count / total) * 100}%` }} title={`${g.label} ${g.count}`} />
            ) : null
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {groups.map((g, i) => (
          <span key={g.label} className="flex items-center gap-1.5">
            <i className={`h-2.5 w-2.5 rounded-sm ${LEVEL_COLORS[i]}`} />
            {g.label} {g.count}
          </span>
        ))}
      </div>
    </div>
  );
}
