import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { MasteryDistribution, StatsSummary, TrendPoint } from '../types';
import { Card } from '../components/ui/Card';
import { StatCard, Spinner } from '../components/ui/Stat';
import { AccuracyBars, MasteryBar, TrendChart } from '../components/charts/Charts';

function fmtDuration(seconds?: number): string {
  const s = seconds ?? 0;
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

export default function Stats() {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [mastery, setMastery] = useState<MasteryDistribution | null>(null);

  useEffect(() => {
    api.stats.summary().then(setSummary).catch(() => {});
    api.stats.trend(14).then(setTrend).catch(() => {});
    api.stats.mastery().then(setMastery).catch(() => {});
  }, []);

  if (!summary) return <Spinner />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">学习统计</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">最近 14 天的学习趋势与掌握分布</p>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-medium text-slate-400">练习次数趋势</h2>
            <TrendChart data={trend} />
          </Card>
        </div>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-medium text-slate-400">每日正确率</h2>
          <AccuracyBars data={trend} />
          <p className="mt-2 text-xs text-slate-400">柱高 = 当日正确率，颜色分级：≥80% / ≥50% / &lt;50%</p>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-medium text-slate-400">掌握分布</h2>
          {mastery && <MasteryBar levels={mastery.levels} unlearned={mastery.unlearned} />}
          <p className="mt-3 text-xs text-slate-400">共 {mastery?.total ?? 0} 个句子</p>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-400">今日</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="学习次数" value={summary.today.practiced} />
          <StatCard label="今日时长" value={fmtDuration(summary.overall.todayStudySeconds)} />
          <StatCard label="正确" value={summary.today.correct} accent="text-emerald-500" />
          <StatCard label="错误" value={summary.today.wrong} accent="text-rose-500" />
          <StatCard label="正确率" value={summary.today.accuracy} suffix="%" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-400">本周</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="学习次数" value={summary.week.practiced} />
          <StatCard label="学习天数" value={summary.week.days} suffix="天" />
          <StatCard label="正确率" value={summary.week.accuracy} suffix="%" />
          <StatCard label="连续学习" value={summary.overall.streak} suffix="天" accent="text-indigo-500" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-400">累计</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="总句子" value={summary.overall.totalSentences} />
          <StatCard label="已学习" value={summary.overall.studied} />
          <StatCard label="已掌握" value={summary.overall.mastered} accent="text-emerald-500" />
          <StatCard label="累计时长" value={fmtDuration(summary.overall.totalStudySeconds)} accent="text-indigo-500" />
          <StatCard label="错题" value={summary.overall.mistakes} accent="text-rose-500" />
          <StatCard label="收藏" value={summary.overall.favorites} accent="text-amber-500" />
          <StatCard label="待复习" value={summary.overall.dueReview} />
          <StatCard label="未学习" value={summary.overall.newSentences} />
        </div>
      </section>
    </div>
  );
}
