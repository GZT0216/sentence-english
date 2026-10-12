import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { MASTERY_LABEL, PRACTICE_LABEL, type PracticeType, type Sentence } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState, ProgressBar, Spinner } from '../components/ui/Stat';
import { FavoriteButton } from '../components/ui/Badges';
import { WordOrderInput } from '../components/study/WordOrderInput';
import { TTSPlayer } from '../components/study/TTSPlayer';
import { diffWords, type DiffWord } from '../utils/wordDiff';
import { playStroke } from '../audio/typingSound';

type Phase = 'loading' | 'question' | 'selfJudge' | 'result' | 'done';

interface GradeResult {
  correct: boolean;
  userAnswer: string;
  revealed?: boolean;
  unknown?: boolean;
  nextReviewAt?: string;
  masteryLevel?: number;
}

function DiffLine({ words, side }: { words: DiffWord[]; side: 'user' | 'target' }) {
  return (
    <p className="mt-1 text-base font-medium leading-7">
      {words.map((w, i) => (
        <span
          key={i}
          className={
            w.kind === 'same'
              ? undefined
              : side === 'user'
                ? 'text-rose-500 line-through decoration-rose-400/70'
                : 'rounded bg-emerald-50 px-0.5 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300'
          }
        >
          {w.text}{' '}
        </span>
      ))}
    </p>
  );
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const dayDiff = Math.round((d.getTime() - today.setHours(0, 0, 0, 0)) / 86400000);
  if (dayDiff <= 0) return '今天';
  if (dayDiff === 1) return '明天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function StudySession() {
  const [params] = useSearchParams();
  const mode = (params.get('mode') as PracticeType) || 'zh2en';
  const source = (params.get('source') as 'daily' | 'mistakes' | 'favorites') || 'daily';
  const category = params.get('category') || undefined;
  const count = Number(params.get('count')) || 20;

  const [queue, setQueue] = useState<Sentence[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [draft, setDraft] = useState('');
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionStats, setSessionStats] = useState({ answered: 0, correct: 0 });
  const [wrongItems, setWrongItems] = useState<Sentence[]>([]);
  const [loadError, setLoadError] = useState('');
  const startedAtRef = useRef(Date.now());
  const reportedRef = useRef(false);

  // 会话结束时把本次学习时长上报到当前账号
  useEffect(() => {
    if (phase !== 'done' || loadError || reportedRef.current) return;
    reportedRef.current = true;
    const seconds = Math.round((Date.now() - startedAtRef.current) / 1000);
    if (seconds >= 5) void api.progress.reportStudyTime(seconds).catch(() => undefined);
  }, [phase, loadError]);

  useEffect(() => {
    api.daily
      .get({ count, category, source: source === 'daily' ? undefined : source })
      .then((r) => {
        setQueue(r.items);
        setPhase(r.items.length === 0 ? 'done' : 'question');
      })
      .catch((e) => {
        setLoadError(e.message);
        setPhase('done');
      });
  }, [count, category, source]);

  const current = queue[index];
  const currentId = current?.id;

  // 记录"上次学到哪"（按账号独立保存）
  useEffect(() => {
    if (!currentId) return;
    void api.progress
      .savePosition({ category: category ?? null, difficulty: null, lastSentenceId: currentId })
      .catch(() => undefined);
  }, [currentId, category]);

  const resetQuestion = () => {
    setDraft('');
    setGrade(null);
    setPhase('question');
  };

  const next = useCallback(() => {
    if (index + 1 >= queue.length) {
      setPhase('done');
    } else {
      setIndex((i) => i + 1);
      resetQuestion();
    }
  }, [index, queue.length]);

  // 结果页 Enter/空格 下一题；自评页 1=正确 2=错误
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'result' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        playStroke('submit');
        next();
      } else if (phase === 'selfJudge' && grade === null) {
        if (e.key === '1') void submitRef.current(true);
        else if (e.key === '2') void submitRef.current(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, next, grade]);

  const submit = async (selfJudged?: boolean, answerOverride?: string, unknown?: boolean) => {
    if (!current || busy) return;
    const answer = answerOverride ?? draft;
    setBusy(true);
    try {
      const r = await api.practice.submit({
        sentenceId: current.id,
        practiceType: mode,
        userAnswer: answer,
        selfJudged,
      });
      setGrade({
        correct: r.correct,
        userAnswer: answer,
        unknown,
        nextReviewAt: r.result.nextReviewAt,
        masteryLevel: r.result.masteryLevel,
      });
      setSessionStats((s) => ({ answered: s.answered + 1, correct: s.correct + (r.correct ? 1 : 0) }));
      if (!r.correct) setWrongItems((w) => (w.some((s) => s.id === current.id) ? w : [...w, current]));
      setPhase('result');
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  const reveal = () => {
    setGrade({ correct: false, userAnswer: draft, revealed: true });
    setPhase('result');
  };

  const dontKnow = () => void submit(undefined, '', true);

  const retryWrong = () => {
    setQueue(wrongItems);
    setWrongItems([]);
    setIndex(0);
    setSessionStats({ answered: 0, correct: 0 });
    startedAtRef.current = Date.now();
    reportedRef.current = false;
    resetQuestion();
  };

  const toggleFavorite = async () => {
    if (!current) return;
    const { favorite } = await api.favorites.toggle(current.id);
    setQueue((q) => q.map((s, i) => (i === index ? { ...s, favorite } : s)));
  };

  if (phase === 'loading') return <Spinner />;

  if (phase === 'done') {
    if (loadError) {
      return (
        <EmptyState title="加载失败" hint={loadError} action={<Link to="/study" className="text-sm text-indigo-500">返回学习页</Link>} />
      );
    }
    const acc = sessionStats.answered === 0 ? 0 : Math.round((sessionStats.correct / sessionStats.answered) * 100);
    const minutes = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000));
    return (
      <div className="mx-auto max-w-lg space-y-6 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl dark:bg-emerald-950/50">
          {acc === 100 && sessionStats.answered > 0 ? '🏆' : '🎉'}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {acc === 100 && sessionStats.answered > 0 ? '全对，太稳了' : '本轮完成'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          共作答 {sessionStats.answered} 题，正确 {sessionStats.correct} 题，正确率 {acc}%，用时约 {minutes} 分钟。学习记录已保存。
        </p>
        {wrongItems.length > 0 && (
          <Card className="p-4 text-left">
            <p className="text-sm font-medium">本轮答错 {wrongItems.length} 句</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
              {wrongItems.slice(0, 5).map((s) => (
                <li key={s.id} className="truncate">{s.english}</li>
              ))}
              {wrongItems.length > 5 && <li>…等 {wrongItems.length} 句</li>}
            </ul>
            <div className="mt-3">
              <Button size="sm" onClick={retryWrong}>只重练本轮错题</Button>
            </div>
          </Card>
        )}
        <div className="flex justify-center gap-3">
          <Link to="/study"><Button variant="secondary">再来一轮</Button></Link>
          <Link to="/"><Button>回到首页</Button></Link>
        </div>
      </div>
    );
  }

  if (!current) return <Spinner />;

  const promptChinese = mode === 'en2zh' || mode === 'listening' ? null : current.chinese;
  const showDiff =
    grade && !grade.correct && !grade.revealed && grade.userAnswer.trim() && mode !== 'en2zh' && mode !== 'order'
      ? diffWords(grade.userAnswer, current.english)
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          {index + 1} / {queue.length} · {PRACTICE_LABEL[mode]}
          {source !== 'daily' && ` · ${source === 'mistakes' ? '错题重练' : '收藏练习'}`}
        </span>
        <FavoriteButton favorite={current.favorite} onToggle={toggleFavorite} />
      </div>
      <ProgressBar value={index + (phase === 'result' || phase === 'selfJudge' ? 1 : 0)} max={queue.length} />

      <Card className="space-y-6 p-6 sm:p-8">
        {mode === 'listening' && (
          <TTSPlayer text={current.english} autoPlayKey={current.id} />
        )}
        {mode === 'en2zh' && <TTSPlayer text={current.english} autoPlayKey={`${current.id}-en`} />}

        {/* 题面 */}
        <div className="space-y-2">
          {promptChinese && (
            <p className="text-xl font-medium leading-relaxed text-slate-800 dark:text-slate-100">{promptChinese}</p>
          )}
          {mode === 'en2zh' && (
            <p className="text-xl font-medium leading-relaxed text-slate-800 dark:text-slate-100">{current.english}</p>
          )}
          {mode === 'listening' && phase === 'question' && (
            <p className="text-sm text-slate-400">听上面朗读的英文，默写出来。可反复播放。</p>
          )}
          {mode === 'order' && <p className="text-sm text-slate-400">点击单词组成英文句子（中文提示见上）</p>}
        </div>

        {/* 作答区 */}
        {phase === 'question' && (
          <>
            {mode === 'order' ? (
              <WordOrderInput english={current.english} onSubmit={(ans) => { setDraft(ans); void submit(undefined, ans); }} disabled={busy} />
            ) : (
              <div className="space-y-3">
                {mode === 'en2zh' ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && draft.trim()) {
                        e.preventDefault();
                        setPhase('selfJudge');
                      }
                    }}
                    placeholder="输入中文翻译…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:focus:border-indigo-500 dark:focus:bg-slate-800"
                  />
                ) : (
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (draft.trim()) void submit();
                      }
                    }}
                    rows={2}
                    placeholder={mode === 'listening' ? '默写你听到的英文句子…' : '用英文写出这句话…'}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:focus:border-indigo-500 dark:focus:bg-slate-800"
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => (mode === 'en2zh' ? (draft.trim() && setPhase('selfJudge')) : void submit())} disabled={busy || !draft.trim()}>
                    提交
                  </Button>
                  {mode !== 'en2zh' && (
                    <Button variant="secondary" onClick={dontKnow} disabled={busy}>
                      不会
                    </Button>
                  )}
                  <Button variant="ghost" onClick={reveal} disabled={busy}>
                    查看答案
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* 英译中自评 */}
        {phase === 'selfJudge' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <p className="text-xs text-slate-400">你的翻译</p>
              <p className="mt-1 text-base">{draft}</p>
              <p className="mt-3 text-xs text-slate-400">参考翻译</p>
              <p className="mt-1 text-base">{current.chinese}</p>
            </div>
            <p className="text-sm text-slate-400">第一版由你自行判断翻译是否可接受（快捷键 1 / 2）：</p>
            <div className="flex gap-2">
              <Button onClick={() => void submit(true)} disabled={busy}>回答正确</Button>
              <Button variant="secondary" onClick={() => void submit(false)} disabled={busy}>回答错误</Button>
              <Button variant="ghost" onClick={() => setPhase('question')}>返回修改</Button>
            </div>
          </div>
        )}

        {/* 结果 */}
        {phase === 'result' && grade && (
          <div className="space-y-4">
            <p
              className={`text-lg font-semibold ${
                grade.revealed ? 'text-slate-400' : grade.correct ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {grade.revealed
                ? '已查看答案（本题不计成绩）'
                : grade.correct
                  ? '回答正确 ✓'
                  : grade.unknown
                    ? '已标记为不会，明天再见'
                    : '回答错误'}
            </p>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <p className="text-xs text-slate-400">标准答案</p>
              {showDiff ? <DiffLine words={showDiff.target} side="target" /> : <p className="mt-1 text-base font-medium">{current.english}</p>}
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{current.chinese}</p>
              {grade.userAnswer && !grade.revealed && !grade.correct && (
                <>
                  <p className="mt-3 text-xs text-slate-400">你的答案</p>
                  {showDiff ? (
                    <DiffLine words={showDiff.user} side="user" />
                  ) : (
                    <p className="mt-1 text-base text-rose-500">{grade.userAnswer}</p>
                  )}
                </>
              )}
              {current.explanation && (
                <>
                  <p className="mt-3 text-xs text-slate-400">讲解</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{current.explanation}</p>
                </>
              )}
              {grade.nextReviewAt && (
                <p className="mt-3 text-xs text-slate-400">
                  下次复习：{formatReviewDate(grade.nextReviewAt)}
                  {grade.masteryLevel !== undefined && ` · 掌握度：${MASTERY_LABEL[grade.masteryLevel]}`}
                </p>
              )}
            </div>
            {(mode === 'en2zh' || mode === 'listening') && <TTSPlayer text={current.english} />}
            <div className="flex items-center gap-4">
              <Button onClick={next}>{index + 1 >= queue.length ? '完成本轮' : '下一题'}</Button>
              <span className="text-xs text-slate-400">按 Enter 继续</span>
            </div>
          </div>
        )}
      </Card>

      {loadError && phase === 'question' && <p className="text-center text-sm text-rose-500">{loadError}</p>}
    </div>
  );
}
