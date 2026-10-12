import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Sentence } from '../types';
import { SentenceRow } from '../components/sentence/SentenceRow';
import { EmptyState, Spinner } from '../components/ui/Stat';
import { Button } from '../components/ui/Button';

export default function Favorites() {
  const [items, setItems] = useState<Sentence[] | null>(null);

  useEffect(() => {
    api.favorites.list().then(setItems).catch(() => setItems([]));
  }, []);

  if (!items) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">收藏</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">共 {items.length} 个收藏句子</p>
        </div>
        {items.length > 0 && (
          <Link to="/study/session?mode=zh2en&source=favorites">
            <Button>练习收藏句</Button>
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="还没有收藏的句子"
          hint="在句子库或学习页面点击 ☆ 收藏你喜欢的句子"
          action={<Link to="/library" className="text-sm text-indigo-500">去句子库看看</Link>}
        />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <SentenceRow
              key={s.id}
              sentence={s}
              onChanged={(next) =>
                next.favorite ? setItems((a) => a!.map((x) => (x.id === next.id ? next : x))) : setItems((a) => a!.filter((x) => x.id !== next.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
