import { useTTS } from '../../hooks/useTTS';

const RATES = [0.75, 1, 1.25];

export function TTSPlayer({ text, autoPlayKey }: { text: string; autoPlayKey?: string | number }) {
  const { supported, state, speak, pause, resume, rate, setRate, voices, voice, setVoice } = useTTS();

  // 句子切换时自动朗读一次（通过父组件变更 autoPlayKey 触发）
  const lastKey = (TTSPlayer as any).__lastKey;
  if (autoPlayKey !== undefined && lastKey !== autoPlayKey && supported) {
    (TTSPlayer as any).__lastKey = autoPlayKey;
    setTimeout(() => speak(text), 450);
  }

  if (!supported) {
    return <p className="text-xs text-slate-400">当前浏览器不支持语音合成（Text-to-Speech）</p>;
  }

  const btn =
    'flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={() => speak(text)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
          </svg>
          {state === 'idle' ? '播放' : '重播'}
        </button>
        {state === 'playing' ? (
          <button className={btn} onClick={pause}>暂停</button>
        ) : state === 'paused' ? (
          <button className={btn} onClick={resume}>继续</button>
        ) : null}
        <div className="ml-1 flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => setRate(r)}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                rate === r ? 'bg-white font-semibold text-indigo-600 shadow-sm dark:bg-slate-950 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {r}x
            </button>
          ))}
        </div>
        {voices.length > 1 && (
          <select
            value={voice?.voiceURI ?? ''}
            onChange={(e) => setVoice(e.target.value || null)}
            className="max-w-44 truncate rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 shadow-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            title="朗读音色"
          >
            <option value="">自动（推荐）</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name.replace(/^Microsoft\s+/i, '')}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
