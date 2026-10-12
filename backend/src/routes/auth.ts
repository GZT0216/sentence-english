import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/token.js';

export const authRouter = Router();

const NAME_RE = /^[a-zA-Z0-9_@.+-]{2,32}$/;

function publicUser(u: { id: number; name: string; isAdmin: boolean; createdAt: Date }) {
  return { id: u.id, name: u.name, isAdmin: u.isAdmin, createdAt: u.createdAt };
}

// POST /api/auth/register { name, password } → { token, user }
authRouter.post('/register', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const password = String(req.body?.password ?? '');
  if (!NAME_RE.test(name)) {
    return res.status(400).json({ error: '账号需为 2-32 位字母、数字或 _ @ . + -' });
  }
  if (password.length < 6 || password.length > 72) {
    return res.status(400).json({ error: '密码长度需为 6-72 位' });
  }
  const exists = await prisma.user.findUnique({ where: { name } });
  if (exists) return res.status(409).json({ error: '该账号已存在' });

  const user = await prisma.user.create({
    data: { name, passwordHash: hashPassword(password), lastLoginAt: new Date() },
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/login { name, password } → { token, user }
authRouter.post('/login', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const password = String(req.body?.password ?? '');
  const user = name ? await prisma.user.findUnique({ where: { name } }) : null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: '账号或密码错误' });
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  res.json({ token: signToken(updated), user: publicUser(updated) });
});

// GET /api/auth/me — 校验 token 并返回当前用户
authRouter.get('/me', authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: '账号不存在或已被删除' });
  res.json({ user: publicUser(user) });
});

// PUT /api/auth/password { oldPassword, newPassword } — 修改密码
authRouter.put('/password', authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: '账号不存在' });
  if (!verifyPassword(String(req.body?.oldPassword ?? ''), user.passwordHash)) {
    return res.status(400).json({ error: '原密码错误' });
  }
  const newPassword = String(req.body?.newPassword ?? '');
  if (newPassword.length < 6 || newPassword.length > 72) {
    return res.status(400).json({ error: '新密码长度需为 6-72 位' });
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });
  res.json({ ok: true });
});

// POST /api/auth/logout — 无状态 token，客户端清除即可
authRouter.post('/logout', (_req, res) => res.json({ ok: true }));
