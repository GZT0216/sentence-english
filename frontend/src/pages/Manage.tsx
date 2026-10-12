import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '../api/client';
import type { Category, ImportResponse, Sentence } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState, Spinner } from '../components/ui/Stat';
import { SentenceRow } from '../components/sentence/SentenceRow';

const CSV_TEMPLATE = 'id,category,sub_category,english,chinese,difficulty,tags\n1,日常交流,打招呼,Nice to meet you.,很高兴认识你。,1,greeting\n2,工作,日常工作,I will check it later.,我稍后检查一下。,1,work\n';

export default function Manage() {
  const [tab, setTab] = useState<'import' | 'sentences' | 'categories'>('import');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">导入与管理</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">批量导入你的句子资料，管理句子与分类</p>
      </div>
      <div className="flex gap-1 text-sm">
        {([
          ['import', '导入'],
          ['sentences', '句子管理'],
          ['categories', '分类管理'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              tab === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'import' && <ImportTab />}
      {tab === 'sentences' && <SentencesTab />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  );
}

// ---------------- 导入 ----------------
function ImportTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState('');

  const upload = async (file: File) => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.importer.upload(file));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        className="flex flex-col items-center gap-3 border-dashed p-10 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void upload(f);
        }}
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          将 <b>.csv</b> 或 <b>.xlsx / .xls</b> 文件拖到此处，或
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = '';
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? '导入中…' : '选择文件'}
        </Button>
        <p className="text-xs text-slate-400">
          建议表头：id, category, sub_category, english, chinese, difficulty, tags（也支持中文表头：分类、子分类、英文、中文、难度、标签）。
          英文为空的行会被跳过；与库中已有句子重复的会自动去重。
        </p>
        <button
          className="text-xs text-indigo-500 hover:underline"
          onClick={() => {
            const blob = new Blob(['\uFEFF' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'sentences-template.csv';
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          下载 CSV 模板
        </button>
      </Card>

      {error && <Card className="p-4 text-sm text-rose-500">{error}</Card>}

      {result && (
        <Card className="space-y-2 p-5 text-sm">
          <p className="font-medium">导入结果</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <span>总行数 {result.total}</span>
            <span className="text-emerald-500">成功 {result.imported}</span>
            <span className="text-amber-500">重复跳过 {result.duplicated}</span>
            <span className="text-rose-500">失败 {result.failed}</span>
          </div>
          {result.errors.length > 0 && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer">查看失败原因（{result.errors.length + result.truncatedErrors} 条）</summary>
              <ul className="mt-2 max-h-60 list-disc space-y-1 overflow-y-auto pl-5">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------- 句子管理 ----------------
const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900';

function SentencesTab() {
  const [items, setItems] = useState<Sentence[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Sentence | null>(null);
  const [creating, setCreating] = useState(false);

  const pageSize = 30;

  const load = () => {
    setLoading(true);
    api.sentences
      .list({ search: search.trim() || undefined, page, pageSize })
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [page]);
  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const pageCount = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索句子…" className={`${inputCls} max-w-xs`} />
        <Button size="sm" onClick={() => setCreating(true)}>+ 新增句子</Button>
        <span className="ml-auto text-sm text-slate-400">共 {total} 句</span>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="没有句子" hint="先到「导入」标签页批量导入你的资料" />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <SentenceRow
              key={s.id}
              sentence={s}
              onChanged={(next) => setItems((a) => a.map((x) => (x.id === next.id ? next : x)))}
              onEdit={(t) => setEditing(t)}
              onDelete={async (t) => {
                if (!confirm(`确定删除这句吗？学习记录会一并删除：\n${t.english}`)) return;
                await api.sentences.remove(t.id);
                setItems((a) => a.filter((x) => x.id !== t.id));
                setTotal((n) => n - 1);
              }}
            />
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

      {(editing || creating) && (
        <SentenceForm
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function SentenceForm({ initial, onClose, onSaved }: { initial: Sentence | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    english: initial?.english ?? '',
    chinese: initial?.chinese ?? '',
    category: initial?.category ?? '其他',
    subCategory: initial?.subCategory ?? '',
    difficulty: initial?.difficulty ?? 1,
    tags: initial?.tags ?? '',
    explanation: initial?.explanation ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'difficulty' ? Number(e.target.value) : e.target.value }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const data = { ...form, subCategory: form.subCategory || null, tags: form.tags || null, explanation: form.explanation || null };
      if (initial) await api.sentences.update(initial.id, data);
      else await api.sentences.create(data);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-lg space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-medium">{initial ? '编辑句子' : '新增句子'}</h3>
        <textarea rows={2} className={`${inputCls} resize-none`} placeholder="英文句子 *" value={form.english} onChange={set('english')} />
        <input className={inputCls} placeholder="中文翻译 *" value={form.chinese} onChange={set('chinese')} />
        <div className="grid grid-cols-2 gap-3">
          <input className={inputCls} placeholder="分类" value={form.category} onChange={set('category')} />
          <input className={inputCls} placeholder="子分类" value={form.subCategory ?? ''} onChange={set('subCategory')} />
          <select className={inputCls} value={form.difficulty} onChange={set('difficulty')}>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>难度 {d}</option>
            ))}
          </select>
          <input className={inputCls} placeholder="标签" value={form.tags ?? ''} onChange={set('tags')} />
        </div>
        <input className={inputCls} placeholder="讲解（可选）" value={form.explanation ?? ''} onChange={set('explanation')} />
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save} disabled={busy || !form.english.trim() || !form.chinese.trim()}>
            {busy ? '保存中…' : '保存'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ---------------- 分类管理 ----------------
function CategoriesTab() {
  const [rows, setRows] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');

  const load = () => {
    api.categories.list().then(setRows).catch(() => {});
    api.sentences.categories().then((c) => setCounts(Object.fromEntries(c.map((x) => [x.name, x.count])))).catch(() => {});
  };
  useEffect(load, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="新分类名称" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          size="sm"
          disabled={!name.trim()}
          onClick={async () => {
            await api.categories.create(name.trim());
            setName('');
            load();
          }}
        >
          添加
        </Button>
      </div>
      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.length === 0 && <p className="p-4 text-sm text-slate-400">暂无分类</p>}
        {rows.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span>{c.name}</span>
            <span className="flex items-center gap-3 text-slate-400">
              {counts[c.name] ?? 0} 句
              <button
                className="text-xs text-slate-300 hover:text-rose-500 dark:text-slate-600"
                onClick={async () => {
                  if ((counts[c.name] ?? 0) > 0) {
                    alert('该分类下还有句子，句子本身不受影响。仅从分类列表中移除。');
                  }
                  await api.categories.remove(c.id);
                  load();
                }}
              >
                移除
              </button>
            </span>
          </div>
        ))}
      </Card>
      <p className="text-xs text-slate-400">
        分类为标签性质：句子的分类以导入或编辑时填写的名称为准，导入时出现的新分类会自动加入此列表。
      </p>
    </div>
  );
}
