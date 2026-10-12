import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/token.js';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  return null;
}

// 已登录则挂载 req.userId/req.isAdmin，未登录也放行（公开内容）
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.userId = user.id;
      req.isAdmin = user.isAdmin;
    }
  }
  next();
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  optionalAuth(req, res, () => {
    if (!req.userId) return res.status(401).json({ error: '请先登录' });
    next();
  });
}

export function adminRequired(req: Request, res: Response, next: NextFunction) {
  authRequired(req, res, () => {
    if (!req.isAdmin) return res.status(403).json({ error: '仅管理员可执行此操作' });
    next();
  });
}

// authRequired 之后安全取 userId
export function uid(req: Request): number {
  return req.userId as number;
}
