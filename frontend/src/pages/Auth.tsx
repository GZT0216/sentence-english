import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function Auth({ mode }: { mode: 'login' | 'register' }) {
  const { user, ready, login, register } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/study';
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(name.trim(), password);
      else await register(name.trim(), password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500';

  return (
    <div className="mx-auto max-w-sm pt-8">
      <Card className="space-y-5 p-6">
        <div>
          <h1 className="text-lg font-semibold">{mode === 'login' ? '登录' : '注册新账号'}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {mode === 'login' ? '登录后可记录你独立的学习进度' : '每个账号的学习进度完全独立、互不干扰'}
          </p>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <input className={inputCls} placeholder="账号" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" />
          <input
            className={inputCls}
            type="password"
            placeholder={mode === 'register' ? '密码（至少 6 位）' : '密码'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode === 'register' && (
            <input
              className={inputCls}
              type="password"
              placeholder="确认密码"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          )}
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !name.trim() || !password}>
            {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
          </Button>
        </form>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {mode === 'login' ? (
            <>
              还没有账号？
              <Link to="/register" className="ml-1 text-indigo-600 hover:underline dark:text-indigo-400">
                注册
              </Link>
            </>
          ) : (
            <>
              已有账号？
              <Link to="/login" className="ml-1 text-indigo-600 hover:underline dark:text-indigo-400">
                登录
              </Link>
            </>
          )}
        </p>
      </Card>
      <p className="mt-4 text-center text-xs text-slate-400">未登录也可以浏览句子库；登录后才有练习记录与复习计划。</p>
    </div>
  );
}
