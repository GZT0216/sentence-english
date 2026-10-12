import { useEffect, useRef, useState } from 'react';
import { speakOnce } from '../../hooks/useTTS';

export function SpeakButton({ text, className = '' }: { text: string; className?: string }) {
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (typeof window !== 'undefined' && !('speechSynthesis' in window)) return null;

  return (
    <button
      aria-label="朗读英文"
      title="朗读英文"
      onClick={(e) => {
        e.stopPropagation();
        setPlaying(true);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setPlaying(false), 15000);
        speakOnce(text, () => {
          if (timerRef.current) window.clearTimeout(timerRef.current);
          setPlaying(false);
        });
      }}
      className={`shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-500 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 ${
        playing ? 'animate-pulse text-indigo-500 dark:text-indigo-300' : ''
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        {playing ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
          </>
        ) : (
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        )}
      </svg>
    </button>
  );
}
