import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db.js';
import { adminRequired } from '../middleware/auth.js';
import { parseImportFile } from '../services/importService.js';

export const importRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/import/sentences  (multipart form, field: file)
// → { total, imported, duplicated, failed, errors[] }
importRouter.post('/sentences', adminRequired, upload.single('file'), async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: '未收到文件（字段名应为 file）' });

  const { rows, errors } = parseImportFile(file.buffer, file.originalname || '');

  const existing = await prisma.sentence.findMany({ select: { english: true } });
  const existingSet = new Set(existing.map((s) => normalize(s.english)));

  let imported = 0;
  let duplicated = 0;
  let failed = 0;
  const categoryNames = new Set<string>();

  for (const r of rows) {
    if (existingSet.has(normalize(r.english))) {
      duplicated += 1;
      errors.push(`与库内句子重复，已跳过：${r.english.slice(0, 40)}`);
      continue;
    }
    try {
      await prisma.sentence.create({
        data: {
          english: r.english,
          chinese: r.chinese,
          category: r.category || '其他',
          subCategory: r.subCategory ?? null,
          difficulty: r.difficulty ?? 1,
          tags: r.tags ?? null,
          pronunciation: r.pronunciation ?? null,
          explanation: r.explanation ?? null,
        },
      });
      existingSet.add(normalize(r.english));
      if (r.category && r.category !== '其他') categoryNames.add(r.category);
      imported += 1;
    } catch {
      failed += 1;
      errors.push(`写入失败：${r.english.slice(0, 40)}`);
    }
  }

  for (const categoryName of categoryNames) {
    const exists = await prisma.category.findUnique({ where: { name: categoryName } });
    if (!exists) await prisma.category.create({ data: { name: categoryName, sortOrder: 99 } });
  }

  res.json({
    total: rows.length + failed,
    imported,
    duplicated,
    failed,
    errors: dedupe(errors).slice(0, 100),
    truncatedErrors: Math.max(dedupe(errors).length - 100, 0),
  });
});

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function dedupe(list: string[]) {
  return [...new Set(list)];
}
