export interface DiffWord {
  text: string;
  kind: 'same' | 'wrong' | 'missing';
}

function key(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '');
}

function tokenize(sentence: string): string[] {
  return sentence.split(/\s+/).filter(Boolean);
}

// LCS 词级对比：user 侧标出拼错的词，target 侧标出漏写/写错的词
export function diffWords(user: string, target: string): { user: DiffWord[]; target: DiffWord[] } {
  const u = tokenize(user);
  const t = tokenize(target);
  const n = u.length;
  const m = t.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = key(u[i]) && u[i] && key(u[i]) === key(t[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const userOut: DiffWord[] = [];
  const targetOut: DiffWord[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(u[i]) && key(u[i]) === key(t[j])) {
      userOut.push({ text: u[i], kind: 'same' });
      targetOut.push({ text: t[j], kind: 'same' });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      userOut.push({ text: u[i], kind: 'wrong' });
      i++;
    } else {
      targetOut.push({ text: t[j], kind: 'missing' });
      j++;
    }
  }
  while (i < n) userOut.push({ text: u[i++], kind: 'wrong' });
  while (j < m) targetOut.push({ text: t[j++], kind: 'missing' });
  return { user: userOut, target: targetOut };
}
