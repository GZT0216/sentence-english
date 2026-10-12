import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function Settings() {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    if (newPassword !== confirm) {
      setError('两次输入的新密码不一致');
      return;
    }
    setBusy(true);
    try {
      await api.auth.changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
      setDone('密码已修改，下次登录请使用新密码');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500';

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">账号设置</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">当前账号的学习进度仅自己可见</p>
      </div>

      <Card className="p-5">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">账号</dt>
            <dd className="truncate font-medium">{user?.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">角色</dt>
            <dd>{user?.isAdmin ? '管理员' : '普通用户'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">注册时间</dt>
            <dd>{user ? new Date(user.createdAt).toLocaleDateString('zh-CN') : ''}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold">修改密码</h2>
        <p className="mt-1 mb-4 text-xs text-slate-400">新密码长度需为 6-72 位；修改后当前登录仍然有效</p>
        <form className="space-y-3" onSubmit={submit}>
          <input
            className={inputCls}
            type="password"
            placeholder="原密码"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
          />
          <input
            className={inputCls}
            type="password"
            placeholder="新密码"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <input
            className={inputCls}
            type="password"
            placeholder="确认新密码"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          {done && <p className="text-sm text-emerald-600 dark:text-emerald-400">{done}</p>}
          <Button type="submit" className="w-full" disabled={busy || !oldPassword || !newPassword || !confirm}>
            {busy ? '请稍候…' : '确认修改'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
