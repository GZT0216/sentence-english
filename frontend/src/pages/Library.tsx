import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Sentence } from '../types';
import { SentenceRow } from '../components/sentence/SentenceRow';
import { Spinner, EmptyState } from '../components/ui/Stat';
import { Button } from '../components/ui/Button';
import { MASTERY_LABEL } from '../types';

const PAGE_SIZE = 30;

const selectCls =
  'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

export default function Library() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [mastery, setMastery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Sentence[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    api.sentences.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => setPage(1), [debounced, category, difficulty, mastery, favOnly]);

  const load = useCallback(() => {
    setLoading(true);
    api.sentences
      .list({ search: debounced, category, difficulty: difficulty ? Number(difficulty) : undefined, mastery, favoritesOnly: favOnly, page, pageSize: PAGE_SIZE })
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debounced, category, difficulty, mastery, favOnly, page]);

  useEffect(load, [load]);

  const pageCount = useMemo(() => Math.max(Math.ceil(total / PAGE_SIZE), 1), [total]);

  const updateOne = (s: Sentence) => setItems((arr) => arr.map((x) => (x.id === s.id ? s : x)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">句子库</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">共 {total} 个句子</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索英文 / 中文 / 标签…"
          className={`${selectCls} min-w-52 flex-1`}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
          ))}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={selectCls}>
          <option value="">全部难度</option>
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>难度 {d}</option>
          ))}
        </select>
        {user && (
          <select value={mastery} onChange={(e) => setMastery(e.target.value)} className={selectCls}>
            <option value="">全部状态</option>
            {Object.entries(MASTERY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        )}
        {user && (
          <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} className="accent-indigo-600" />
            仅看收藏
          </label>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="没有匹配的句子" hint="换个筛选条件，或到「导入与管理」页面导入你的句子资料" />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <SentenceRow key={s.id} sentence={s} onChanged={updateOne} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
          <span className="text-sm text-slate-400">{page} / {pageCount}</span>
          <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>下一页</Button>
        </div>
      )}
    </div>
  );
}
