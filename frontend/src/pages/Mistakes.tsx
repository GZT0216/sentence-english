import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Sentence } from '../types';
import { SentenceRow } from '../components/sentence/SentenceRow';
import { EmptyState, Spinner } from '../components/ui/Stat';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function Mistakes() {
  const [items, setItems] = useState<Sentence[] | null>(null);

  const load = () => api.practice.mistakes().then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
  }, []);

  if (!items) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">错题本</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            答错的句子自动记录在这里；连续答对后复习优先级会自动降低
          </p>
        </div>
        {items.length > 0 && (
          <Link to="/study/session?mode=zh2en&source=mistakes">
            <Button>重新练习全部错题</Button>
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState title="错题本是空的" hint="去练习吧，答错的句子会自动出现在这里" action={<Link to="/study" className="text-sm text-indigo-500">开始学习</Link>} />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <SentenceRow
              key={s.id}
              sentence={s}
              onChanged={(next) => setItems((arr) => arr!.map((x) => (x.id === next.id ? next : x)))}
              onDelete={async (target) => {
                await api.practice.clearMistake(target.id);
                setItems((arr) => arr!.filter((x) => x.id !== target.id));
              }}
              deleteLabel="移出错题本"
            />
          ))}
        </div>
      )}

      <Card className="p-4 text-xs leading-5 text-slate-400">
        复习优先级：连续答对后按 1 / 3 / 7 / 14 / 30 天间隔进入复习队列；答错则次日重新进入短期复习。
      </Card>
    </div>
  );
}
