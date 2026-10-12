import { useEffect, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Navbar from './components/layout/Navbar';
import { playStroke, typingSoundForKey, typingSoundOnKeyUp } from './audio/typingSound';
import Home from './pages/Home';
import Library from './pages/Library';
import Study from './pages/Study';
import StudySession from './pages/StudySession';
import Mistakes from './pages/Mistakes';
import Favorites from './pages/Favorites';
import Stats from './pages/Stats';
import Manage from './pages/Manage';
import Settings from './pages/Settings';
import Auth from './pages/Auth';

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  return children;
}

function RequireAdmin({ children }: { children: ReactElement }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" state={{ from: '/manage' }} replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return children;
}

const NON_TEXT_INPUT = new Set(['checkbox', 'radio', 'range', 'file', 'button', 'submit', 'color', 'hidden']);

export default function App() {
  // 全局打字音：任何输入框/文本域敲键都会发声；中文输入法在拼音合成期间静音，上屏时播一次
  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const t = target as HTMLElement | null;
      if (!t || !t.tagName) return false;
      return (
        t.tagName === 'TEXTAREA' ||
        (t.tagName === 'INPUT' && !NON_TEXT_INPUT.has((t as HTMLInputElement).type)) ||
        t.isContentEditable
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) typingSoundForKey(e);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isEditable(e.target)) typingSoundOnKeyUp(e);
    };
    const onCompositionEnd = (e: Event) => {
      if (isEditable(e.target)) playStroke('key');
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('compositionend', onCompositionEnd, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('compositionend', onCompositionEnd, true);
    };
  }, []);

  return (
    <AuthProvider>
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/library" element={<Library />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/register" element={<Auth mode="register" />} />
            <Route path="/study" element={<RequireAuth><Study /></RequireAuth>} />
            <Route path="/study/session" element={<RequireAuth><StudySession /></RequireAuth>} />
            <Route path="/mistakes" element={<RequireAuth><Mistakes /></RequireAuth>} />
            <Route path="/favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
            <Route path="/stats" element={<RequireAuth><Stats /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/manage" element={<RequireAdmin><Manage /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
