import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

const TOKEN_TTL = '30d';

export interface AuthUser {
  id: number;
  name: string;
  isAdmin: boolean;
}

function loadSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  // 持久化到数据卷，避免重启后所有用户被登出
  const file = path.resolve(process.cwd(), 'prisma', 'data', '.jwt-secret');
  try {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const secret = randomBytes(32).toString('hex');
    fs.writeFileSync(file, secret);
    return secret;
  } catch {
    return randomBytes(32).toString('hex');
  }
}

const secret = loadSecret();

export function signToken(user: AuthUser): string {
  return jwt.sign({ name: user.name, admin: user.isAdmin }, secret, {
    subject: String(user.id),
    expiresIn: TOKEN_TTL,
  });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    const id = parseInt(payload.sub ?? '');
    if (!id) return null;
    return { id, name: String(payload.name ?? ''), isAdmin: !!payload.admin };
  } catch {
    return null;
  }
}
