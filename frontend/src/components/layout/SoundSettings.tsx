import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  KEYBOARD_SWITCHES,
  getKeyboardSound,
  playStroke,
  setKeyboardSoundEnabled,
  setKeyboardSwitch,
  setKeyboardVolume,
  subscribeKeyboardSound,
  type SwitchId,
} from '../../audio/typingSound';

export function SoundSettings() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [sound, setSound] = useState(getKeyboardSound);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => subscribeKeyboardSound(() => setSound(getKeyboardSound())), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    if (next && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: Math.max(window.innerWidth - r.right, 8) });
    }
    setOpen(next);
  };

  const pickSwitch = (id: SwitchId) => {
    setKeyboardSwitch(id);
    playStroke('key');
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="打字音效设置"
        title="打字音效设置"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
          sound.enabled
            ? 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'
            : 'text-slate-300 hover:text-slate-400 dark:text-slate-600'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <rect x="2" y="6" width="20" height="12" rx="2.5" />
          <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9.5 14h5" />
        </svg>
        {sound.enabled && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-indigo-500" />}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[100] w-72 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            style={{ top: pos.top, right: pos.right }}
          >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">机械键盘打字音</p>
            <button
              role="switch"
              aria-checked={sound.enabled}
              onClick={() => {
                setKeyboardSoundEnabled(!sound.enabled);
                if (!sound.enabled) playStroke('key');
              }}
              className={`relative w-10 rounded-full transition-colors ${
                sound.enabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
              style={{ height: 22 }}
            >
              <span
                className="absolute top-1 h-[14px] w-[14px] rounded-full bg-white shadow transition-all"
                style={{ left: sound.enabled ? 22 : 4 }}
              />
            </button>
          </div>

          <p className="mb-1.5 text-xs font-medium text-slate-400">轴体（点击试听）</p>
          <div className="space-y-1">
            {KEYBOARD_SWITCHES.map((s) => (
              <button
                key={s.id}
                onClick={() => pickSwitch(s.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                  sound.switchId === s.id
                    ? 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/40'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <span>
                  <span className="text-sm">{s.name}</span>
                  <span className="block text-xs text-slate-400">{s.desc}</span>
                </span>
                {sound.switchId === s.id && <span className="text-sm text-indigo-500">✓</span>}
              </button>
            ))}
          </div>

          <p className="mb-1.5 mt-3 text-xs font-medium text-slate-400">音量</p>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sound.volume}
            onChange={(e) => setKeyboardVolume(Number(e.target.value))}
            onPointerUp={() => playStroke('key')}
            className="w-full accent-indigo-600"
          />
          <p className="mt-2 text-[11px] leading-4 text-slate-400">
            全部为真实键盘录音采样（含按下与松手两段音源），首次使用自动加载。音源：kbsim / Keyboard Sounds（MIT）。
          </p>
        </div>,
          document.body
        )}
    </div>
  );
}
