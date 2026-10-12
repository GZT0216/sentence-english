import { Router } from 'express';
import { prisma } from '../db.js';
import { adminRequired } from '../middleware/auth.js';

export const categoriesRouter = Router();

categoriesRouter.get('/', async (_req, res) => {
  const rows = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  res.json(rows);
});

categoriesRouter.post('/', adminRequired, async (req, res) => {
  const { name, parentId, sortOrder } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: '分类名不能为空' });
  try {
    const created = await prisma.category.create({
      data: { name: name.trim(), parentId: parentId ?? null, sortOrder: parseInt(sortOrder) || 0 },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: '分类已存在' });
    throw e;
  }
});

categoriesRouter.put('/:id', adminRequired, async (req, res) => {
  const { name, parentId, sortOrder } = req.body || {};
  try {
    const updated = await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(parentId !== undefined ? { parentId: parentId ?? null } : {}),
        ...(sortOrder !== undefined ? { sortOrder: parseInt(sortOrder) || 0 } : {}),
      },
    });
    res.json(updated);
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: '分类不存在' });
    if (e?.code === 'P2002') return res.status(409).json({ error: '分类名重复' });
    throw e;
  }
});

categoriesRouter.delete('/:id', adminRequired, async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: '分类不存在' });
    throw e;
  }
});
