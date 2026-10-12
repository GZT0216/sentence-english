import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import type { StatsSummary } from '../types';
import { Card } from '../components/ui/Card';
import { GoalRing, StatCard } from '../components/ui/Stat';
import { Button } from '../components/ui/Button';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return '夜深了，练完早点休息';
  if (h < 12) return '早上好，来几句热身';
  if (h < 14) return '中午好，饭后练几句';
  if (h < 19) return '下午好，继续保持节奏';
  return '晚上好，今天练了吗';
}

export default function Home() {
  const { user, ready } = useAuth();
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setStats(null);
      return;
    }
    api.stats.summary().then(setStats).catch((e) => setError(e.message));
  }, [user]);

  const t = stats?.today;
  const o = stats?.overall;

  return (
    <div className="space-y-8">
      <section className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting()}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            看懂 → 理解 → 翻译 → 默写 → 拼句 → 听懂 → 复习
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/study?source=daily">
            <Button size="lg">开始今日学习</Button>
          </Link>
          <Link to="/study">
            <Button size="lg" variant="secondary">继续学习</Button>
          </Link>
          <Link to="/mistakes">
            <Button size="lg" variant="ghost">错题复习</Button>
          </Link>
        </div>
      </section>

      {ready && !user && (
        <Card className="flex flex-col items-start gap-3 border-indigo-200 bg-indigo-50/50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-900 dark:bg-indigo-950/30">
          <div>
            <p className="font-medium">未登录模式</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              你可以自由浏览句子库。注册登录后，练习记录、复习计划、错题与收藏将独立保存在你自己的账号里。
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/register">
              <Button>注册</Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary">登录</Button>
            </Link>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-4 text-sm text-rose-500">
          无法读取学习数据：{error}。请确认后端已启动（见 README）。
        </Card>
      )}

      {user && (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="今日学习" value={t?.practiced ?? 0} suffix="次" />
        <StatCard label="今日完成" value={t && t.practiced >= (t.goal ?? 20) ? t.practiced : t?.practiced ?? 0} suffix={`/ ${t?.goal ?? 20}`} />
        <StatCard label="今日正确率" value={t?.accuracy ?? 0} suffix="%" accent="text-emerald-500" />
        <StatCard label="连续学习" value={o?.streak ?? 0} suffix="天" accent="text-indigo-500" />
        <StatCard label="累计学习句子" value={o?.studied ?? 0} />
        <StatCard label="已掌握" value={o?.mastered ?? 0} accent="text-emerald-500" />
        <StatCard label="待复习" value={o?.dueReview ?? 0} accent="text-amber-500" />
        <StatCard label="错题" value={o?.mistakes ?? 0} accent="text-rose-500" />
        </section>
      )}

      {t && t.goal > 0 && (
        <Card className="flex flex-col items-center gap-6 p-6 sm:flex-row">
          <GoalRing value={t.practiced} max={t.goal} />
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <p className="font-medium">今日目标</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t.practiced >= t.goal
                ? '目标已完成，今天状态不错。想练可以再来一轮。'
                : `还差 ${t.goal - t.practiced} 次作答即可完成，约 3 分钟。`}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1 sm:justify-start">
              {t.practiced < t.goal && (
                <Link to="/study?source=daily">
                  <Button size="sm">继续今日任务</Button>
                </Link>
              )}
              {(o?.dueReview ?? 0) > 0 && (
                <Link to="/study/session?mode=zh2en&source=daily&count=20">
                  <Button size="sm" variant="secondary">
                    到期复习 {o?.dueReview} 句
                  </Button>
                </Link>
              )}
              {(o?.mistakes ?? 0) > 0 && (
                <Link to="/mistakes">
                  <Button size="sm" variant="ghost">
                    消灭错题 {o?.mistakes}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <QuickLink to="/library" title="句子库" desc="浏览、搜索、筛选你的全部英语句子" />
        {user?.isAdmin && (
          <QuickLink to="/manage" title="导入与管理" desc="从 CSV / Excel 批量导入句子，编辑、删除、分类管理（仅管理员）" />
        )}
      </section>
    </div>
  );
}

function QuickLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="h-full p-5 transition-colors hover:border-indigo-300 dark:hover:border-indigo-700">
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
      </Card>
    </Link>
  );
}
