// 答案判定工具：第一版使用基础字符串匹配规则
// 忽略大小写、首尾空格、句末标点；连续空格视为一个空格

export function normalizeEnglish(text: string): string {
  let s = text.toLowerCase().trim();
  s = s.replace(/[\s\u3000]+/g, ' ');
  // 去掉句末标点（. ! ? 。 ! ? 等）
  s = s.replace(/[.,!?;:。，！？；："'“”‘’]+$/g, '');
  s = s.replace(/^[.,!?;:。，！？；："“”‘’]+/g, '');
  return s.trim();
}

export function isEnglishAnswerCorrect(input: string, answer: string): boolean {
  const a = normalizeEnglish(input);
  const b = normalizeEnglish(answer);
  if (!a) return false;
  if (a === b) return true;
  // 允许缩写形式的等价：don't = do not 等
  const expanded = (t: string) =>
    t
      .replace(/n't/g, ' not')
      .replace(/'ll/g, ' will')
      .replace(/'re/g, ' are')
      .replace(/'ve/g, ' have')
      .replace(/it's/g, 'it is')
      .replace(/he's/g, 'he is')
      .replace(/she's/g, 'she is')
      .replace(/i'm/g, 'i am')
      .replace(/that's/g, 'that is')
      .replace(/'/g, '');
  return expanded(a) === expanded(b);
}

export function normalizeChinese(text: string): string {
  return text
    .replace(/[\s\u3000]+/g, '')
    .replace(/[。，！？；：、,.!?;:"'“”‘’（）()《》【】]/g, '');
}

export function isChineseAnswerAcceptable(input: string, answer: string): boolean {
  const a = normalizeChinese(input);
  const b = normalizeChinese(answer);
  if (!a) return false;
  if (a === b) return true;
  // 中文翻译不做严格判断：包含关系视为可接受，其余由用户自评
  return b.includes(a) || a.includes(b);
}
