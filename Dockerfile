ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG PRISMA_ENGINES_MIRROR=
# Docker Hub 直连不通的网络可改用镜像源，如 --build-arg BASE_IMAGE=public.ecr.aws/docker/library/node:24-alpine
ARG BASE_IMAGE=node:24-alpine

# ---- Stage 1: build frontend ----
FROM ${BASE_IMAGE} AS web-build
ARG NPM_REGISTRY
WORKDIR /build
COPY frontend/package*.json ./frontend/
RUN --mount=type=cache,target=/root/.npm cd frontend && npm ci --registry=$NPM_REGISTRY --no-audit --no-fund
COPY frontend ./frontend
RUN cd frontend && npm run build

# ---- Stage 2: build backend (prisma generate 必须在此阶段执行，
#      否则会沿用 Windows 宿主下载的 windows 引擎，Linux 容器内直接报错) ----
FROM ${BASE_IMAGE} AS api-build
ARG NPM_REGISTRY
ARG PRISMA_ENGINES_MIRROR
ENV PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR
RUN apk add --no-cache openssl
WORKDIR /build
COPY backend/package*.json ./backend/
RUN --mount=type=cache,target=/root/.npm cd backend && npm ci --registry=$NPM_REGISTRY --no-audit --no-fund
COPY backend ./backend
RUN cd backend && node node_modules/prisma/build/index.js generate \
 && node node_modules/typescript/bin/tsc -p tsconfig.build.json

# ---- Stage 3: runtime ----
FROM ${BASE_IMAGE}
RUN apk add --no-cache openssl
ENV PORT=8787
ENV NODE_ENV=production
ENV DATABASE_URL="file:./data/app.db"
# 学习统计的“今日”按本地时区切分，容器默认 UTC 会让东八区的早间学习记到前一天
ENV TZ=Asia/Shanghai
WORKDIR /app
COPY backend ./backend
COPY --from=api-build /build/backend/node_modules ./backend/node_modules
COPY --from=api-build /build/backend/dist ./backend/dist
COPY --from=api-build /build/backend/prisma ./backend/prisma
COPY --from=web-build /build/frontend/dist ./frontend/dist
# 数据目录预置好并交给 node 用户，命名卷首次挂载时继承其属主
RUN mkdir -p /app/backend/prisma/data /app/tmp && chown -R node:node /app
USER node

EXPOSE 8787
VOLUME ["/app/backend/prisma/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# migrate deploy + seed 都是幂等的（seed 已存在数据时跳过），可安全随容器重启执行
CMD ["sh", "-c", "cd /app/backend && node node_modules/prisma/build/index.js migrate deploy && node node_modules/tsx/dist/cli.mjs prisma/seed.ts && exec node dist/server.js"]
