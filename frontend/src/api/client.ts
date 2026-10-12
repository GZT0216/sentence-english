import type {
  Category,
  DailyResponse,
  ImportResponse,
  MasteryDistribution,
  PracticeResult,
  PracticeType,
  Sentence,
  SentenceListResponse,
  StatsSummary,
  StudyPosition,
  TrendPoint,
} from '../types';

const BASE = '/api';

export interface AuthUser {
  id: number;
  name: string;
  isAdmin: boolean;
  createdAt: string;
}

const TOKEN_KEY = 'auth-token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event('auth-expired'));
  }
  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  auth: {
    login: (name: string, password: string) =>
      request<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ name, password }) }),
    register: (name: string, password: string) =>
      request<{ token: string; user: AuthUser }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, password }) }),
    me: () => request<{ user: AuthUser }>('/auth/me'),
    logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    changePassword: (oldPassword: string, newPassword: string) =>
      request<{ ok: boolean }>('/auth/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) }),
  },
  progress: {
    getPosition: () => request<StudyPosition | null>('/progress/position'),
    savePosition: (data: { category?: string | null; difficulty?: number | null; lastSentenceId?: number | null }) =>
      request<StudyPosition>('/progress/position', { method: 'PUT', body: JSON.stringify(data) }),
    reportStudyTime: (seconds: number) =>
      request<{ ok: boolean; totalToday: number }>('/progress/study-time', { method: 'POST', body: JSON.stringify({ seconds }) }),
  },
  sentences: {
    list: (params: {
      search?: string;
      category?: string;
      difficulty?: number;
      mastery?: string;
      favoritesOnly?: boolean;
      page?: number;
      pageSize?: number;
    }) => request<SentenceListResponse>(`/sentences${qs({ ...params, favoritesOnly: params.favoritesOnly ? '1' : undefined })}`),
    get: (id: number) => request<Sentence>(`/sentences/${id}`),
    create: (data: Partial<Sentence>) =>
      request<Sentence>('/sentences', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Sentence>) =>
      request<Sentence>(`/sentences/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<{ ok: boolean }>(`/sentences/${id}`, { method: 'DELETE' }),
    categories: () => request<{ name: string; count: number }[]>('/sentences/meta/categories'),
  },
  categories: {
    list: () => request<Category[]>('/categories'),
    create: (name: string, sortOrder = 0) =>
      request<Category>('/categories', { method: 'POST', body: JSON.stringify({ name, sortOrder }) }),
    remove: (id: number) => request<{ ok: boolean }>(`/categories/${id}`, { method: 'DELETE' }),
  },
  daily: {
    get: (params: { count?: number; category?: string; source?: 'mistakes' | 'favorites' }) =>
      request<DailyResponse>(`/daily${qs(params)}`),
  },
  practice: {
    submit: (data: { sentenceId: number; practiceType: PracticeType; userAnswer: string; selfJudged?: boolean }) =>
      request<PracticeResult>('/practice', { method: 'POST', body: JSON.stringify(data) }),
    mistakes: () => request<Sentence[]>('/practice/mistakes'),
    clearMistake: (sentenceId: number) => request<{ ok: boolean }>(`/practice/mistakes/${sentenceId}`, { method: 'DELETE' }),
  },
  favorites: {
    list: () => request<Sentence[]>('/favorites'),
    toggle: (sentenceId: number) =>
      request<{ favorite: boolean }>('/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ sentenceId }),
      }),
  },
  stats: {
    summary: () => request<StatsSummary>('/stats/summary'),
    trend: (days = 14) => request<TrendPoint[]>(`/stats/trend${qs({ days })}`),
    mastery: () => request<MasteryDistribution>('/stats/mastery'),
  },
  importer: {
    upload: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<ImportResponse>('/import/sentences', { method: 'POST', body: form });
    },
  },
};
