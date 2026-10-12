// 机械键盘打字音效引擎
// 首选：真实采样录音（frontend/public/kb/，全部来自 kbsim，MIT，授权文件随包存放在各采样目录内）
// 采样未加载完成前：回退到 Web Audio 实时合成（共鸣峰 + 低频触底）
// 空格/回车/退格有独立采样；松手（keyup）播放 release 采样，形成真实打字的双重节奏感

export type SwitchId = 'mahjong' | 'red' | 'black' | 'blue' | 'brown' | 'topre';
export type StrokeKind = 'key' | 'space' | 'delete' | 'submit' | 'release' | 'release_key' | 'release_space' | 'release_back';

interface Res {
  f: number;
  q: number;
  decay: number;
  gain: number;
}

interface SynthProfile {
  res: Res[];
  body: { f: number; decay: number; gain: number };
  click?: { f: number; q: number; decay: number; gain: number; at: number };
}

export const KEYBOARD_SWITCHES: { id: SwitchId; name: string; desc: string }[] = [
  { id: 'mahjong', name: '麻将音', desc: '黑墨轴实录 · 脆「嗒嗒」' },
  { id: 'red', name: '红轴', desc: '红墨轴实录 · 轻盈顺滑' },
  { id: 'black', name: '黑轴', desc: 'Cherry 黑轴实录 · 沉稳' },
  { id: 'blue', name: '青轴', desc: 'Cherry 青轴实录 · 脆 click' },
  { id: 'brown', name: '茶轴', desc: 'Cherry 茶轴实录 · 段落感' },
  { id: 'topre', name: '静电容', desc: 'Holy Panda 实录 · 圆润' },
];

const PACKS: Record<SwitchId, string> = {
  mahjong: 'gateron-black-ink',
  red: 'gateron-red-ink',
  black: 'mx-black',
  blue: 'mx-blue',
  brown: 'mx-brown',
  topre: 'holy-panda',
};

const SYNTH: Record<SwitchId, SynthProfile> = {
  mahjong: {
    res: [
      { f: 3400, q: 14, decay: 0.038, gain: 0.5 },
      { f: 2150, q: 10, decay: 0.055, gain: 0.42 },
      { f: 5800, q: 16, decay: 0.02, gain: 0.16 },
    ],
    body: { f: 520, decay: 0.035, gain: 0.16 },
  },
  red: {
    res: [
      { f: 2400, q: 9, decay: 0.03, gain: 0.4 },
      { f: 1250, q: 6, decay: 0.05, gain: 0.3 },
    ],
    body: { f: 170, decay: 0.05, gain: 0.22 },
  },
  black: {
    res: [
      { f: 1500, q: 8, decay: 0.045, gain: 0.4 },
      { f: 820, q: 6, decay: 0.06, gain: 0.34 },
    ],
    body: { f: 118, decay: 0.075, gain: 0.4 },
  },
  blue: {
    res: [
      { f: 3000, q: 11, decay: 0.038, gain: 0.42 },
      { f: 5200, q: 13, decay: 0.05, gain: 0.3 },
      { f: 1400, q: 7, decay: 0.04, gain: 0.22 },
    ],
    body: { f: 200, decay: 0.04, gain: 0.14 },
    click: { f: 7000, q: 14, decay: 0.04, gain: 0.3, at: 0.011 },
  },
  brown: {
    res: [
      { f: 2200, q: 9, decay: 0.042, gain: 0.4 },
      { f: 1100, q: 6, decay: 0.052, gain: 0.3 },
    ],
    body: { f: 150, decay: 0.058, gain: 0.3 },
    click: { f: 4300, q: 12, decay: 0.02, gain: 0.12, at: 0.007 },
  },
  topre: {
    res: [
      { f: 950, q: 6, decay: 0.05, gain: 0.3 },
      { f: 1800, q: 7, decay: 0.03, gain: 0.18 },
    ],
    body: { f: 205, decay: 0.095, gain: 0.5 },
  },
};

const LS_ON = 'kb-on';
const LS_SWITCH = 'kb-switch';
const LS_VOL = 'kb-vol';

let enabled = localStorage.getItem(LS_ON) !== '0';
let switchId: SwitchId = (localStorage.getItem(LS_SWITCH) as SwitchId) || 'mahjong';
let volume = localStorage.getItem(LS_VOL) === null ? 0.7 : Number(localStorage.getItem(LS_VOL));
if (!(volume >= 0)) volume = 0.7;

const listeners = new Set<() => void>();

export function getKeyboardSound() {
  return { enabled, switchId, volume };
}

export function subscribeKeyboardSound(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify() {
  listeners.forEach((f) => f());
}

export function setKeyboardSoundEnabled(v: boolean) {
  enabled = v;
  localStorage.setItem(LS_ON, v ? '1' : '0');
  if (v) prefetchSwitch(switchId);
  notify();
}

export function setKeyboardSwitch(id: SwitchId) {
  switchId = id;
  localStorage.setItem(LS_SWITCH, id);
  prefetchSwitch(id);
  notify();
}

export function setKeyboardVolume(v: number) {
  volume = Math.min(Math.max(v, 0), 1);
  if (masterGain) masterGain.gain.value = volume;
  localStorage.setItem(LS_VOL, String(volume));
  notify();
}

// ---------- 音频图 ----------

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let clickBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = volume;
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.08;
    masterGain.connect(comp);
    comp.connect(audioCtx.destination);

    clickBus = audioCtx.createGain();
    clickBus.connect(masterGain);

    const irLen = Math.floor(audioCtx.sampleRate * 0.06);
    const ir = audioCtx.createBuffer(1, irLen, audioCtx.sampleRate);
    const irData = ir.getChannelData(0);
    for (let i = 0; i < irLen; i++) irData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3);
    const convolver = audioCtx.createConvolver();
    convolver.buffer = ir;
    const wet = audioCtx.createGain();
    wet.gain.value = 0.1;
    clickBus.connect(convolver);
    convolver.connect(wet);
    wet.connect(masterGain);

    noiseBuffer = makeNoise(audioCtx, 0.2);
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

// ---------- 采样加载 ----------

interface PackSamples {
  keys: AudioBuffer[];
  space?: AudioBuffer;
  enter?: AudioBuffer;
  back?: AudioBuffer;
  releaseKey?: AudioBuffer;
  releaseSpace?: AudioBuffer;
  releaseBack?: AudioBuffer;
}

const packs = new Map<SwitchId, PackSamples>();
const loadingPacks = new Set<SwitchId>();

async function fetchBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function loadPack(id: SwitchId) {
  if (packs.has(id) || loadingPacks.has(id)) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  loadingPacks.add(id);
  const dir = `/kb/${PACKS[id]}/`;
  const [k1, k2, k3, k4, k5, space, enter, back, rk, rs, rb] = await Promise.all([
    fetchBuffer(ctx, dir + 'press_key1.mp3'),
    fetchBuffer(ctx, dir + 'press_key2.mp3'),
    fetchBuffer(ctx, dir + 'press_key3.mp3'),
    fetchBuffer(ctx, dir + 'press_key4.mp3'),
    fetchBuffer(ctx, dir + 'press_key5.mp3'),
    fetchBuffer(ctx, dir + 'press_space.mp3'),
    fetchBuffer(ctx, dir + 'press_enter.mp3'),
    fetchBuffer(ctx, dir + 'press_back.mp3'),
    fetchBuffer(ctx, dir + 'release_key.mp3'),
    fetchBuffer(ctx, dir + 'release_space.mp3'),
    fetchBuffer(ctx, dir + 'release_back.mp3'),
  ]);
  const keys = [k1, k2, k3, k4, k5].filter((b): b is AudioBuffer => !!b);
  if (keys.length > 0) packs.set(id, { keys, space: space ?? undefined, enter: enter ?? undefined, back: back ?? undefined, releaseKey: rk ?? undefined, releaseSpace: rs ?? undefined, releaseBack: rb ?? undefined });
  loadingPacks.delete(id);
}

function prefetchSwitch(id: SwitchId) {
  // AudioContext 需要用户手势，静默失败即可，真正发声时会再次尝试
  void loadPack(id).catch(() => undefined);
}

// ---------- 播放 ----------

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function playBuffer(buf: AudioBuffer, rateMul: number, gainMul: number) {
  const src = audioCtx!.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rateMul;
  const g = audioCtx!.createGain();
  g.gain.value = gainMul;
  src.connect(g);
  g.connect(clickBus!);
  src.start(0);
}

function strokeSample(pack: PackSamples, kind: StrokeKind): AudioBuffer | null {
  const anyKey = () => pack.keys[Math.floor(Math.random() * pack.keys.length)];
  switch (kind) {
    case 'space':
      return pack.space ?? anyKey();
    case 'submit':
      return pack.enter ?? anyKey();
    case 'delete':
      return pack.back ?? anyKey();
    case 'release':
      return pack.releaseKey ?? null;
    case 'release_space':
      return pack.releaseSpace ?? pack.releaseKey ?? null;
    case 'release_back':
      return pack.releaseBack ?? pack.releaseKey ?? null;
    case 'key':
    default:
      return anyKey();
  }
}

export function playStroke(kind: StrokeKind = 'key') {
  if (!enabled) return;
  const isRelease = kind.startsWith('release');
  const ctx = ensureAudio();
  if (!ctx || !clickBus) return;
  const pack = packs.get(switchId);
  if (pack) {
    const buf = strokeSample(pack, kind);
    if (buf) {
      const wide = kind === 'space' || kind === 'submit';
      playBuffer(buf, rand(0.94, 1.07) * (wide ? 0.96 : 1), (isRelease ? 0.55 : 1) * rand(0.85, 1.1));
      return;
    }
    if (isRelease) return; // 该包无 release 采样：静音，不退回合成
  } else {
    void loadPack(switchId).catch(() => undefined);
    if (isRelease) return;
  }
  playSynthStroke(kind);
}

// ---------- 合成回退 ----------

function resonance(ctx: AudioContext, at: number, r: Res, freqMul: number, gainMul: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = r.f * freqMul * rand(0.96, 1.04);
  filter.Q.value = r.q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(r.gain * gainMul * rand(0.8, 1.15), at);
  gain.gain.exponentialRampToValueAtTime(0.0002, at + r.decay * rand(0.85, 1.15));
  src.connect(filter);
  filter.connect(gain);
  gain.connect(clickBus!);
  src.start(at, rand(0, 0.12));
  src.stop(at + r.decay * 1.3 + 0.02);
}

function body(ctx: AudioContext, at: number, b: { f: number; decay: number; gain: number }, freqMul: number, gainMul: number) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const f = b.f * freqMul * rand(0.95, 1.05);
  osc.frequency.setValueAtTime(f * 1.6, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.85), at + b.decay * 0.6);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(b.gain * gainMul * rand(0.8, 1.1), at);
  gain.gain.exponentialRampToValueAtTime(0.0002, at + b.decay * rand(0.9, 1.15));
  osc.connect(gain);
  gain.connect(clickBus!);
  osc.start(at);
  osc.stop(at + b.decay + 0.03);
}

function playSynthStroke(kind: StrokeKind) {
  const ctx = audioCtx!;
  const p = SYNTH[switchId] ?? SYNTH.mahjong;
  const t = ctx.currentTime + rand(0, 0.002);
  const wide = kind === 'space' || kind === 'submit';
  const freqMul = wide ? 0.72 : kind === 'delete' ? 1.06 : 1;
  const gainMul = wide ? 1.25 : 1;
  p.res.forEach((r, i) => resonance(ctx, t + i * 0.0008, r, freqMul, gainMul));
  body(ctx, t, p.body, wide ? 0.85 : 1, gainMul);
  if (p.click) resonance(ctx, t + p.click.at, p.click, freqMul, gainMul);
}

// ---------- 事件封装 ----------

interface KeyLike {
  key: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
  shiftKey?: boolean;
}

/** 中文输入法拼音合成期间逐字母不发声（上屏时由 compositionend 播一次） */
export function isImeComposing(e: KeyLike) {
  return !!e.isComposing || e.keyCode === 229;
}

export function typingSoundForKey(e: KeyLike) {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (isImeComposing(e)) return;
  if (e.key === 'Backspace' || e.key === 'Delete') playStroke('delete');
  else if (e.key === ' ') playStroke('space');
  else if (e.key === 'Enter') playStroke('submit');
  else if (e.key.length === 1) playStroke('key');
}

export function typingSoundOnKeyUp(e: KeyLike) {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if (isImeComposing(e)) return;
  if (e.key === 'Backspace' || e.key === 'Delete') playStroke('release_back');
  else if (e.key === ' ') playStroke('release_space');
  else if (e.key === 'Enter' || e.key.length === 1) playStroke('release');
}
