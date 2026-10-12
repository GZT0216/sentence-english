import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import iconv from 'iconv-lite';

export interface ParsedSentenceRow {
  english: string;
  chinese: string;
  category?: string;
  subCategory?: string;
  difficulty?: number;
  tags?: string;
  pronunciation?: string;
  explanation?: string;
}

export interface ParseResult {
  rows: ParsedSentenceRow[];
  errors: string[];
}

// ---------------- CSV ----------------

export function decodeBuffer(buf: Buffer): string {
  const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const stripped = hasBom ? buf.subarray(3) : buf;
  const asUtf8 = stripped.toString('utf8');
  // 出现替换字符说明很可能不是 UTF-8（Excel 导出的中文 CSV 常为 ANSI/GBK）
  if (!hasBom && asUtf8.includes('\uFFFD')) {
    try {
      return iconv.decode(stripped, 'gb18030');
    } catch {
      return asUtf8;
    }
  }
  return asUtf8;
}

export function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

// ---------------- 表头识别 ----------------

const COLUMN_ALIASES: Record<string, string[]> = {
  english: ['english', 'en', 'sentence', 'text', '英文', '英语', '句子', '英文句子', '原句'],
  chinese: ['chinese', 'cn', 'zh', 'translation', '中文', '汉语', '翻译', '中文翻译', '中文含义', '释义', '中文释义'],
  category: ['category', 'cat', '分类', '场景', '类别', '主题'],
  subCategory: ['sub_category', 'subcategory', 'sub category', '子分类', '细分', '小类', '子场景'],
  difficulty: ['difficulty', '难度', '级别', '等级'],
  tags: ['tags', 'tag', '标签'],
  pronunciation: ['pronunciation', 'phonetic', '音标'],
  explanation: ['explanation', 'note', 'notes', '讲解', '解析', '说明', '注释'],
};

const normHeader = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');

function detectHeader(matrix: string[][]): { rowIdx: number; colMap: Record<string, number> } | null {
  const limit = Math.min(matrix.length, 8);
  for (let i = 0; i < limit; i++) {
    const cells = matrix[i].map(normHeader);
    const colMap: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      const idx = cells.findIndex((c) => c && aliases.includes(c));
      if (idx >= 0 && !Object.values(colMap).includes(idx)) colMap[field] = idx;
    }
    if (colMap.english !== undefined && colMap.chinese !== undefined) return { rowIdx: i, colMap };
  }
  return null;
}

// ---------------- 无表头启发式 ----------------

const CJK = /[\u4e00-\u9fff]/;
const LATIN = /^[A-Za-z][A-Za-z' ,.;:!?-]{6,}$/;

function heuristicColumns(matrix: string[][]): { enIdx: number; zhIdx: number } | null {
  if (matrix.length === 0) return null;
  const cols = Math.max(...matrix.slice(0, 30).map((r) => r.length), 0);
  let enScore = 0;
  let zhScore = 0;
  let enIdx = -1;
  let zhIdx = -1;
  let enMatches = 0;
  for (let c = 0; c < cols; c++) {
    let e = 0;
    let z = 0;
    let m = 0;
    for (const r of matrix.slice(0, 60)) {
      const v = (r[c] ?? '').trim();
      if (LATIN.test(v)) {
        e += v.length;
        m += 1;
      }
      if (CJK.test(v) && v.length >= 2) z += v.length;
    }
    if (e > enScore) {
      enScore = e;
      enIdx = c;
      enMatches = m;
    }
    if (z > zhScore) {
      zhScore = z;
      zhIdx = c;
    }
  }
  if (enIdx < 0 || zhIdx < 0 || enIdx === zhIdx) return null;
  if (enMatches < 3) return null; // 排除纯文稿/分析页
  return { enIdx, zhIdx };
}

// ---------------- sheet 名 → 分类 ----------------

export function sheetCategory(name: string): string | undefined {
  const cleaned = name
    .replace(/[（(].*?[)）]/g, '')
    .replace(/英语?\s*\d*\s*句.*$/g, '')
    .replace(/口语.*$/g, '')
    .replace(/[,，。!！?？]*/g, '')
    .trim();
  if (!cleaned || cleaned.length > 12) return undefined;
  return cleaned;
}

// ---------------- 统一入口 ----------------

function matrixToRows(matrix: string[][], sheetName: string): { rows: ParsedSentenceRow[]; error?: string } {
  if (matrix.length < 2) return { rows: [], error: `工作表「${sheetName}」为空，已跳过` };

  const header = detectHeader(matrix);
  if (header) {
    const { rowIdx, colMap } = header;
    const cell = (r: string[], f: string) => (colMap[f] !== undefined ? (r[colMap[f]] ?? '').trim() : '');
    const rows: ParsedSentenceRow[] = [];
    for (let i = rowIdx + 1; i < matrix.length; i++) {
      const r = matrix[i];
      const english = cell(r, 'english');
      const chinese = cell(r, 'chinese');
      if (!english && !chinese) continue;
      rows.push({
        english,
        chinese,
        category: cell(r, 'category') || sheetCategory(sheetName) || sheetName,
        subCategory: cell(r, 'subCategory') || undefined,
        difficulty: clampDiff(cell(r, 'difficulty')),
        tags: cell(r, 'tags') || undefined,
        pronunciation: cell(r, 'pronunciation') || undefined,
        explanation: cell(r, 'explanation') || undefined,
      });
    }
    return { rows };
  }

  const h = heuristicColumns(matrix);
  if (!h) return { rows: [], error: `工作表「${sheetName}」未识别出英文/中文列，已跳过` };
  const rows: ParsedSentenceRow[] = [];
  for (const r of matrix) {
    const english = (r[h.enIdx] ?? '').trim();
    const chinese = (r[h.zhIdx] ?? '').trim();
    if (!english && !chinese) continue;
    // 启发式页面：过滤标题/表头等噪声行（英文列必须含 ASCII 字母，中文列必须含汉字）
    if (!/[a-zA-Z]{2,}/.test(english) || !CJK.test(chinese)) continue;
    rows.push({ english, chinese, category: sheetCategory(sheetName) || sheetName });
  }
  return { rows };
}

function clampDiff(v: string): number | undefined {
  const n = parseInt(v);
  if (Number.isNaN(n)) return undefined;
  return Math.min(Math.max(n, 1), 5);
}

export function parseImportFile(buf: Buffer, filename: string): ParseResult {
  const lower = filename.toLowerCase();
  let sheets: { name: string; matrix: string[][] }[] = [];

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const wb = XLSX.read(buf, { type: 'buffer' });
    sheets = wb.SheetNames.map((name) => ({
      name,
      matrix: XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, defval: '', raw: false }) as string[][],
    }));
  } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    sheets = [{ name: '', matrix: parseCsvMatrix(decodeBuffer(buf)) }];
  } else {
    return { rows: [], errors: ['仅支持 .csv / .xlsx / .xls 文件'] };
  }

  const rows: ParsedSentenceRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let totalData = 0;

  for (const sheet of sheets) {
    const { rows: parsed, error } = matrixToRows(sheet.matrix, sheet.name);
    if (error) {
      if (sheet.name) errors.push(error);
      continue;
    }
    totalData += parsed.length;
    for (const r of parsed) {
      if (!r.english) {
        errors.push(`「${(r.chinese || '').slice(0, 20)}」：英文为空，已跳过`);
        continue;
      }
      if (!r.chinese) {
        errors.push(`${r.english.slice(0, 30)}：中文为空，已跳过`);
        continue;
      }
      const key = r.english.toLowerCase().trim();
      if (seen.has(key)) {
        errors.push(`文件内重复，已跳过：${r.english.slice(0, 40)}`);
        continue;
      }
      seen.add(key);
      rows.push({
        ...r,
        english: r.english.replace(/\s+/g, ' ').trim(),
        chinese: r.chinese.replace(/\s+/g, ' ').trim(),
        category: r.category || '其他',
      });
    }
  }

  if (rows.length === 0 && totalData === 0) {
    errors.push('没有解析到任何句子数据。建议为表格添加表头（english/chinese 或 英文/中文）。');
  }
  return { rows, errors };
}

// 供测试：从路径解析
export function parseImportPath(p: string, filename: string): ParseResult {
  return parseImportFile(readFileSync(p), filename);
}
