import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { SoundSettings } from './SoundSettings';

const PUBLIC_LINKS = [
  { to: '/', label: '首页', end: true },
  { to: '/library', label: '句子库' },
];

const AUTH_LINKS = [
  { to: '/study', label: '学习' },
  { to: '/mistakes', label: '错题本' },
  { to: '/favorites', label: '收藏' },
  { to: '/stats', label: '统计' },
  { to: '/settings', label: '设置' },
];

export default function Navbar() {
  const [theme, toggleTheme] = useTheme();
  const { user, logout } = useAuth();
  const links: { to: string; label: string; end?: boolean }[] = [
    ...PUBLIC_LINKS,
    ...(user ? AUTH_LINKS : []),
    ...(user?.isAdmin ? [{ to: '/manage', label: '管理' }] : []),
  ];

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${
      isActive
        ? 'bg-indigo-600/10 font-medium text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            S
          </span>
          <span className="hidden sm:inline">句子英语</span>
        </NavLink>

        <div className="flex min-w-0 items-center gap-1">
          <nav className="flex items-center gap-1 overflow-x-auto text-sm">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navCls}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          {user ? (
            <div className="flex shrink-0 items-center gap-1 text-sm">
              <span
                className="hidden max-w-24 truncate rounded-full bg-slate-100 px-3 py-1.5 text-slate-600 sm:inline dark:bg-slate-800 dark:text-slate-300"
                title={user.name}
              >
                {user.name}
                {user.isAdmin ? ' · 管理员' : ''}
              </span>
              <button
                onClick={logout}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
              >
                退出
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1 text-sm">
              <NavLink to="/login" className={navCls}>
                登录
              </NavLink>
              <NavLink to="/register" className={navCls}>
                注册
              </NavLink>
            </div>
          )}
          <SoundSettings />
          <button
            onClick={toggleTheme}
            aria-label="切换深色模式"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60"
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
