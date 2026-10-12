import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type TTSState = 'idle' | 'playing' | 'paused';

// 让常见缩写/符号读得更自然（部分引擎会把 "p.m." 逐字母拖读或漏读）
function preprocessForTts(text: string): string {
  let s = text.replace(/\s+/g, ' ').trim();
  s = s.replace(/p\.m\./gi, 'P.M.');
  s = s.replace(/a\.m\./gi, 'A.M.');
  s = s.replace(/["“”「」]/g, '');
  // 在较长逗号分句处给引擎更明显的停顿线索
  s = s.replace(/,\s+/g, ',  ');
  s = s.replace(/([.!?])\s+/g, '$1  ');
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}

function englishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.lang.toLowerCase().startsWith('en') || /english|美国|英国/i.test(v.name));
}

// 音色质量打分：优先微软/谷歌的 Neural（Natural / Online）音色
export function scoreVoice(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  if (n.includes('chinese') || v.lang.toLowerCase().startsWith('zh')) return -1000;
  let s = 0;
  if (/natural|neural|online/.test(n)) s += 100;
  if (/premium|enhanced|plus/.test(n)) s += 30;
  if (/aria|jenny|guy|ava|andrew|brian|emma|libby|sonia|amber|christopher|naomi/.test(n)) s += 50;
  if (/google/.test(n)) s += 25;
  if (/microsoft/.test(n)) s += 10;
  if (/mobiletext|hollie|sabi|spatial|echo|california/.test(n)) s -= 30;
  if (n.includes('loquendo')) s -= 20;
  return s;
}

// 模块级音色缓存：供行内一次性朗读（SpeakButton）复用，避免每行都挂一份 hook
const sharedSynth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let sharedVoices: SpeechSynthesisVoice[] = sharedSynth ? sharedSynth.getVoices() : [];
sharedSynth?.addEventListener('voiceschanged', () => {
  sharedVoices = sharedSynth.getVoices();
});

function pickSharedVoice(): SpeechSynthesisVoice | null {
  const stored = localStorage.getItem('tts-voice');
  const list = englishVoices(sharedVoices).sort((a, b) => scoreVoice(b) - scoreVoice(a));
  if (stored) {
    const chosen = list.find((v) => v.voiceURI === stored);
    if (chosen) return chosen;
  }
  return list[0] ?? null;
}

export function speakOnce(text: string, onDone?: () => void) {
  if (!sharedSynth) return;
  sharedSynth.cancel();
  const u = new SpeechSynthesisUtterance(preprocessForTts(text));
  const v = pickSharedVoice();
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  } else {
    u.lang = 'en-US';
  }
  u.rate = Number(localStorage.getItem('tts-rate')) || 1;
  u.onend = () => onDone?.();
  u.onerror = () => onDone?.();
  sharedSynth.speak(u);
}

export function useTTS() {
  const [state, setState] = useState<TTSState>('idle');
  const [rate, setRateState] = useState<number>(() => Number(localStorage.getItem('tts-rate')) || 1);
  const [voiceURI, setVoiceURIState] = useState<string | null>(() => localStorage.getItem('tts-voice'));
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(sharedVoices);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const sortedVoices = useMemo(
    () => englishVoices(voices).sort((a, b) => scoreVoice(b) - scoreVoice(a)),
    [voices]
  );

  const pickedVoice = useMemo(() => {
    if (voiceURI) {
      const chosen = sortedVoices.find((v) => v.voiceURI === voiceURI);
      if (chosen) return chosen;
    }
    return sortedVoices[0] ?? null;
  }, [voiceURI, sortedVoices]);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(preprocessForTts(text));
      if (pickedVoice) {
        u.voice = pickedVoice;
        u.lang = pickedVoice.lang;
      } else {
        u.lang = 'en-US';
      }
      u.rate = rate;
      u.pitch = 1;
      u.onend = () => setState('idle');
      u.onerror = () => setState('idle');
      u.onpause = () => setState('paused');
      u.onresume = () => setState('playing');
      utteranceRef.current = u;
      window.speechSynthesis.speak(u);
      setState('playing');
    },
    [supported, rate, pickedVoice]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setState('paused');
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setState('playing');
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setState('idle');
  }, [supported]);

  const setRate = useCallback((r: number) => {
    setRateState(r);
    localStorage.setItem('tts-rate', String(r));
  }, []);

  const setVoice = useCallback((uri: string | null) => {
    setVoiceURIState(uri);
    if (uri) localStorage.setItem('tts-voice', uri);
    else localStorage.removeItem('tts-voice');
  }, []);

  return { supported, state, speak, pause, resume, stop, rate, setRate, voices: sortedVoices, voice: pickedVoice, setVoice };
}
