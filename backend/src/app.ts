import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sentencesRouter } from './routes/sentences.js';
import { categoriesRouter } from './routes/categories.js';
import { favoritesRouter } from './routes/favorites.js';
import { practiceRouter } from './routes/practice.js';
import { dailyRouter } from './routes/daily.js';
import { statsRouter } from './routes/stats.js';
import { importRouter } from './routes/import.js';
import { authRouter } from './routes/auth.js';
import { progressRouter } from './routes/progress.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/sentences', sentencesRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/practice', practiceRouter);
  app.use('/api/daily', dailyRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/import', importRouter);
  app.use('/api/progress', progressRouter);

  // 生产模式下托管前端构建产物（单容器部署）
  const staticCandidates = [path.resolve(__dirname, '../../frontend/dist'), path.resolve(__dirname, '../public')];
  const staticDir = staticCandidates.find((p) => fs.existsSync(path.join(p, 'index.html')));
  if (staticDir) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err?.message || '服务器内部错误' });
  });

  return app;
}
