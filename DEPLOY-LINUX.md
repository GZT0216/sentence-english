# 句子英语 · Linux 部署文档（Docker）

单容器部署：后端（Express + Prisma + SQLite）直接托管前端构建产物，**只暴露一个端口 8787**。
本流程在 `Ubuntu 24.04 + Docker 29 / Compose v5`（4C/7G 的一台内网测试虚拟机）上实测通过，境内服务器构建约 5 分钟，之后每次更新约 2 分钟。

## 0. 部署产物一览

| 项目 | 值 |
| --- | --- |
| 服务器代码目录 | `/opt/sentence-english` |
| compose 项目名 / 容器名 | `sentence-english` / `sentence-english-app-1` |
| 镜像 | `sentence-english:latest`（内含 `node:24-alpine`，以 uid=1000 的 `node` 用户运行） |
| 对外端口 | `${PORT:-8787}` → 容器内 8787 |
| 数据卷 | `sentence-english_sentence-data` → 容器内 `/app/backend/prisma/data` |
| 数据库文件 | 卷内 `app.db`（SQLite，`journal_mode=delete`，无 -wal 文件） |
| JWT 密钥 | 卷内 `.jwt-secret`（未设 `JWT_SECRET` 时首次启动自动生成并复用） |
| 时区 | `TZ=Asia/Shanghai`（「今日学习」按东八区切分，不设会记到前一天） |
| 健康检查 | 每 30s 请求 `GET /api/health` |
| 日志 | json-file，单文件 10MB × 3，自动轮转 |
| 开机自启 | `restart: unless-stopped`，需 `systemctl enable docker` |

容器启动命令依次执行 `prisma migrate deploy` → 幂等 seed → 起服务，因此 `up -d` / `restart` 不会重复导入句子、也不需要手工初始化数据库。

## 1. 首次部署

### 1.1 前置条件

```bash
docker --version && docker compose version   # 需要 Docker Engine 24+ 与 Compose v2+
df -h /var/lib/docker | tail -1              # 至少留 2GB 空闲
ss -ltn | grep 8787 || echo "端口空闲"
```

没装 Docker 时：`curl -fsSL https://get.docker.com | sh && systemctl enable --now docker`。境内机器若拉不动 Docker Hub，在 `/etc/docker/daemon.json` 配 `registry-mirrors` 后 `systemctl restart docker`，并在下一步设置 `BASE_IMAGE`（见 1.3）。

### 1.2 取源码到服务器

**方式 A（推荐，代码已托管在 GitHub）**：服务器上直接克隆，仓库里本来就没有 `node_modules`、`dist`、`.env` 和数据库文件。

```bash
git clone https://github.com/<你的账号>/<仓库名>.git /opt/sentence-english
cd /opt/sentence-english && mkdir -p backend/prisma/data
```

**方式 B（服务器访问不了 GitHub）**：本机打包上传。**排除项很关键**：Windows 装的 `node_modules`（原生模块平台相关，Linux 不可用）和 `dev.db`（本地开发库）绝对不能带过去。

```bash
# Git Bash，在项目根目录
cd ~/Desktop/web
tar czf app.tgz --exclude=node_modules --exclude=dist --exclude=.git --exclude=.env \
  --exclude=backend/prisma/data --exclude='*.db' --exclude='*.db-journal' \
  --exclude='*.xlsx' --exclude='*.xls' .

# 自检：只应列出 backend/.env.example，不应出现 .env / *.db / node_modules
tar tzf app.tgz | grep -E '(\.env|\.db|node_modules)'

ls -lh app.tgz          # 干净的话约 200KB；几十 MB 说明排除没生效
scp app.tgz root@<服务器IP>:/root/
```

服务器上解包（`.env` 不在包里，所以不会覆盖已配好的环境变量）：

```bash
mkdir -p /opt/sentence-english && cd /opt/sentence-english && tar xzf /root/app.tgz && rm /root/app.tgz
```

### 1.3 配置 `.env`

```bash
cd /opt/sentence-english
cat > .env <<'EOF'
ADMIN_PASSWORD=换成你自己的强密码
PORT=8787
BASE_IMAGE=public.ecr.aws/docker/library/node:24-alpine
PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
NPM_REGISTRY=https://registry.npmmirror.com/
EOF
chmod 600 .env
```

后三项是境内服务器能构建成功的关键，境外机器可全部删掉走默认值：

| 变量 | 作用 | 不设置的后果（实测） |
| --- | --- | --- |
| `BASE_IMAGE` | 基础镜像改用 ECR Public 上的官方 node | Docker Hub 直连不通时 `docker pull node:24-alpine` 永远停在 `Pulling fs layer` |
| `PRISMA_ENGINES_MIRROR` | Prisma 引擎走 npmmirror | `npm ci` 的 `@prisma/engines` postinstall 卡在 `binaries.prisma.sh`，15 分钟无进展 |
| `NPM_REGISTRY` | npm 源 | 前端 158 个包从 npmjs 拉取易 `ETIMEDOUT` |
| `ADMIN_PASSWORD` | 首次启动创建/升级 `admin` 的密码 | 兜底为 `admin123456` |
| `JWT_SECRET` | 可选，显式固定签名密钥 | 不设置时自动生成到卷内，同样安全；多实例共享时才必须显式设置 |

仓库里两个 lockfile 的 `resolved` 已统一指向 npmmirror。想走官方源就把 lockfile 里的 `registry.npmmirror.com` 替换回 `registry.npmjs.org`——**只替换 URL 主机名，不要重新 `npm install`**，否则 lockfile 会丢掉其他平台的可选依赖，容器内 `npm ci` 会报 lock file not in sync with package.json。

### 1.4 构建并启动

```bash
cd /opt/sentence-english
docker compose build              # 首次约 5 分钟
docker compose up -d
docker compose ps                 # STATUS 期望 Up (healthy)
docker compose logs --tail 20
```

日志里应看到 `已创建 admin 账号，初始密码：…`、`[backend] listening on http://localhost:8787`。

### 1.5 验证清单

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/api/health     # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/                # 200 首页
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/api/stats/summary  # 401 未登录被拦
curl -s -X POST http://127.0.0.1:8787/api/auth/login \
  -H 'Content-Type: application/json' -d '{"name":"admin","password":"<ADMIN_PASSWORD>"}' | head -c 80
```

浏览器打开 `http://<服务器IP>:8787`，用 `admin` + `ADMIN_PASSWORD` 登录，依次点：学习（做一道中译英并看到「回答正确/下次复习」）→ 统计（今日时长从 0 变成非 0）→ 设置（能看到账号信息）。练习按钮必须有真实反馈，任何一步 401/500 都是异常。

> 打不开但 `curl` 通：八成是浏览器走了代理。把服务器 IP 加进系统的「不使用代理的主机」列表，或直接用 `http://<IP>:8787` 而不是域名。

## 2. 日常运维

### 2.1 常用命令

```bash
cd /opt/sentence-english
docker compose logs -f app            # 跟踪日志
docker compose restart                # 重启（数据、登录态都不丢）
docker compose stop                   # 停止
docker stats sentence-english-app-1 --no-stream
```

### 2.2 更新版本

先按 1.2 的方式取到最新源码（方式 A 用 `git pull`，方式 B 重新打包上传），然后：

```bash
cd /opt/sentence-english
docker tag sentence-english:latest sentence-english:prev   # 回滚点
git pull                                        # 方式 A；方式 B 改为 tar xzf /root/app.tgz && rm /root/app.tgz
docker compose build && docker compose up -d
docker compose ps && curl -s http://127.0.0.1:8787/api/health
```

方式 A 下 `git pull` 不会碰 `.env`（未在仓库里）和数据卷，但会把仓库里的文件恢复成提交状态；如果服务器上手工改过源码，先 `git stash` 或改成用方式 B。

只改前端时，`npm ci` 层命中缓存，构建通常 1-2 分钟。回滚（仅适用于本次更新没有新增 migration 的情况）：

```bash
docker rmi sentence-english:latest && docker tag sentence-english:prev sentence-english:latest && docker compose up -d
```

### 2.3 备份

数据库只有卷里那一个 SQLite 文件。`journal_mode=delete` 意味着没有 WAL 冗余，**建议停服再拷**（服务中断 2-3 秒）：

```bash
cd /opt/sentence-english
docker compose stop
docker compose cp app:/app/backend/prisma/data/app.db ./backup-$(date +%F).db
docker compose up -d
scp backup-*.db user@另一台机器:/backup/     # 一定要拷出这台机器
```

每天自动备份（root crontab，3:30 执行并保留 14 天）：

```cron
30 3 * * * cd /opt/sentence-english && docker compose stop && docker compose cp app:/app/backend/prisma/data/app.db /opt/sentence-english/backup-$(date +\%F).db && docker compose up -d && find /opt/sentence-english -name 'backup-*.db' -mtime +14 -delete
```

### 2.4 恢复

`docker compose cp` 拷进容器的文件属主会变成 root，而容器以 uid=1000 的 `node` 用户跑，**不改回属主的话服务照样能起来、`/api/health` 也返回 200，但所有写操作（练习/收藏/登录计时）都会失败**。改属主要用 `run --user root` 起临时容器：`docker compose exec` 是在 `node` 用户下执行的，`chown` 会直接报 `Operation not permitted`。

```bash
cd /opt/sentence-english
docker compose stop
docker compose cp ./backup-2026-10-09.db app:/app/backend/prisma/data/app.db
docker compose run --rm -T --user root app chown node:node /app/backend/prisma/data/app.db
docker compose up -d
# 验证写路径真的通：登录 + 收藏开关各一次
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8787/api/auth/login \
  -H 'Content-Type: application/json' -d '{"name":"admin","password":"<密码>"}'
```

（备选：`docker compose stop` 后直接在宿主机改卷目录，`chown 1000:1000 /var/lib/docker/volumes/sentence-english_sentence-data/_data/app.db`。）

`.jwt-secret` 也在同一个卷里：只要不 `down -v`，恢复数据库不会让已登录用户掉线；连密钥一起换则所有人重新登录。

### 2.5 清库重来

`docker compose down -v` —— **-v 会删除全部学习数据**，执行前必须先做 2.3 的备份。

### 2.6 维护脚本：直接改卷里的 SQLite

容器和宿主机都**没有 `sqlite3`**，但镜像里的 Node 24 自带 `node:sqlite`，一次性脚本按下面的方式跑（先停应用，避免和 Prisma 的活跃连接抢写；`docker compose exec` 在容器停止时不可用，所以用 `run --rm` 起一个临时容器复用同一个数据卷）：

```bash
cd /opt/sentence-english
docker compose stop
docker compose run --rm -T -v /tmp/脚本.mjs:/tmp/脚本.mjs:ro app node /tmp/脚本.mjs <参数>
docker compose up -d
```

**忘记 admin / 任意账号密码时的重置脚本**（哈希格式就是 `scrypt:<盐>:<值>`，与后端 `verifyPassword` 一致，已实测）：

```bash
cat > /tmp/reset-password.mjs <<'EOF'
// 用法：node reset-password.mjs <db路径> <账号> <新密码>
import { scryptSync, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const [dbPath, name, pwd] = process.argv.slice(2);
const salt = randomBytes(16).toString('hex');
const db = new DatabaseSync(dbPath);
const r = db.prepare('UPDATE users SET password_hash = ? WHERE name = ?')
  .run(`scrypt:${salt}:${scryptSync(pwd, salt, 64).toString('hex')}`, name);
console.log(r.changes === 1 ? 'OK 密码已重置' : '账号不存在');
EOF

docker compose run --rm -T -v /tmp/reset-password.mjs:/tmp/reset-password.mjs:ro \
  app node /tmp/reset-password.mjs /app/backend/prisma/data/app.db admin '新密码'
```

跑完 `up -d`，用新密码登录验证一次；此操作不影响 `.jwt-secret`，已登录用户的 token 依然有效。

## 3. 把本地 Windows 的学习数据搬到服务器

本地开发库是 `backend/prisma/data/dev.db`（`backend/.env` 里的 `DATABASE_URL=file:./data/dev.db`），里面句子数量、学习进度、账号都和线上独立。两种路线：

### 方案 A：整库替换（句子 + 进度 + 收藏 + 账号一起过去）

```bash
# 本地：Windows 侧先停掉 dev server，避免文件被占用
scp backend/prisma/data/dev.db root@<服务器IP>:/root/

# 服务器（chown 必须用 run --user root，理由见 2.4）
cd /opt/sentence-english
docker compose stop
docker compose cp /root/dev.db app:/app/backend/prisma/data/app.db
docker compose run --rm -T --user root app chown node:node /app/backend/prisma/data/app.db
docker compose up -d && docker compose ps
```

替换后请注意：

- **务必按 2.4 最后那两条 curl 验证一遍写路径**：属主没改对时 `/api/health` 依然是 200，只有真正写入才会暴露问题。

- **登录密码以 dev.db 里的记录为准**（本地开发库的 admin 用的是 seed 默认密码），不再是 `.env` 里的 `ADMIN_PASSWORD`，因为 `ADMIN_PASSWORD` 只在账号还没有密码时生效。迁移完成后立刻在「设置 → 修改密码」改成强密码。
- 本地库里若还留有验证用的测试账号（`tester01`/`tester02`，id=2/3）及其练习记录，按下面「清理测试账号」删掉。
- 卷里原来的 40 个种子句会被本地库覆盖，属正常现象。

### 方案 B：只搬句子，保留服务器账号

在管理页用 CSV 导入，或 `docker compose cp` 之外走 `POST /api/import/sentences`。句子按 `english` 唯一去重，重复导入不会产生脏数据。

### 清理测试账号

按 2.6 的维护脚本方式，把账号连同它的全部学习数据一起删掉（先删子表再删 `users`，否则外键会拦住）：

```bash
cat > /tmp/purge-users.mjs <<'EOF'
// 用法：node purge-users.mjs <db路径> <要删除的用户id，逗号分隔>
import { DatabaseSync } from 'node:sqlite';
const [dbPath, rawIds] = process.argv.slice(2);
const ids = rawIds.split(',').map((s) => parseInt(s, 10)).filter((n) => n > 1); // 永不允许删 id=1（admin）
if (!ids.length) throw new Error('没有给出合法的用户 id');
const db = new DatabaseSync(dbPath);
const q = ids.map(() => '?').join(',');
for (const [table, col] of [
  ['practice_records', 'user_id'],
  ['user_sentence_progress', 'user_id'],
  ['favorites', 'user_id'],
  ['study_time_daily', 'user_id'],
  ['study_positions', 'user_id'],
  ['users', 'id'],
]) console.log(table, '->', db.prepare(`DELETE FROM ${table} WHERE ${col} IN (${q})`).run(...ids).changes);
EOF

cd /opt/sentence-english && docker compose stop
docker compose run --rm -T -v /tmp/purge-users.mjs:/tmp/purge-users.mjs:ro \
  app node /tmp/purge-users.mjs /app/backend/prisma/data/app.db 2,3
docker compose up -d
docker compose exec -T app node -e 'const{DatabaseSync}=require("node:sqlite");const d=new DatabaseSync("/app/backend/prisma/data/app.db",{readOnly:true});console.log(d.prepare("select id,name from users").all());'
```

（脚本硬性拒绝删除 id=1，避免误删唯一的 admin；末行是删完之后的账号自检。）

## 4. 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `docker compose build` 卡在 `[api-build 5/7] npm ci` | Prisma 引擎从 `binaries.prisma.sh` 下载失败 | `.env` 配 `PRISMA_ENGINES_MIRROR`，见 1.3 |
| 卡在 `RUN npm ci` 报 `ETIMEDOUT errno -110` | npm 源不可达 | 配 `NPM_REGISTRY`，且确认 lockfile 主机名与之匹配 |
| `Unable to resolve base image node:24-alpine` / 一直 `Pulling fs layer` | Docker Hub 被墙或镜像加速只给 manifest | 配 `BASE_IMAGE=public.ecr.aws/docker/library/node:24-alpine` |
| `EUSAGE … lock file … not in sync with package.json` | 在 Windows 上跑过 `npm install --package-lock-only`，可选依赖被裁掉 | 别重新生成 lockfile，只替换 URL 主机名 |
| 容器反复重启，日志 `Unknown argument id` | 旧版 seed 在全新空库上创建 admin 的分支有 bug | 已修复（改为自增主键创建），拉最新代码重新 build |
| `PrismaClientKnownRequestError … Query Error … no such table` | migration 没跑（手工替换过数据卷或 `DATABASE_URL` 指错） | `docker compose exec app sh -c 'cd /app/backend && node node_modules/prisma/build/index.js migrate deploy'` |
| `Health check: unhealthy`，但 `logs` 显示已 listening | 数据目录属主不对（容器内进程是 uid=1000 的 `node`） | `docker compose exec -T app ls -ln /app/backend/prisma/data`，应为 `1000 1000`；改属主用 `docker compose run --rm -T --user root app chown -R node:node /app/backend/prisma/data`（`exec` 里 `chown` 会报 `Operation not permitted`） |
| 恢复/替换 `app.db` 之后：页面能打开、`/api/health` 200，但练习、收藏、登录计时全部 500 | `docker compose cp` 落地的文件属主是 root，Prisma 只读打开成功、写入失败 | 按 2.4 用 `run --user root` 改回 `node:node`，再用登录+收藏开关验证写路径 |
| 早上的学习记录算到了前一天 | 容器时区是 UTC | 确认 compose 里 `TZ=Asia/Shanghai`，改完 `up -d` 重建 |
| 服务器本机 curl 200，别的机器打不开 | 安全组/防火墙没放行，或浏览器走了代理 | 放行 8787；浏览器把 IP 加入代理直连列表 |
| 忘记 admin 密码 | 没有后台重置入口 | 按 2.6 的 `reset-password.mjs` 在维护窗口里直接改 `users.password_hash`，改完 `up -d` 并用新密码登录验证 |

## 5. 上公网前的检查

- [ ] `admin` 已改掉默认密码（登录后「设置 → 修改密码」）。
- [ ] `.env` 权限 `600`，不在 tar 包里、也不进 git。
- [ ] 放在 Nginx/Caddy 之后配 HTTPS——密码和 JWT 在链路上是明文，明文端口不适合公网。
- [ ] 注册接口对外开放且**无限流**，公网暴露前在反代层加限速（如 Nginx `limit_req`）。
- [ ] 备份已按 2.3/2.4 验证过一次能恢复，且备份文件存在另一台机器上。
- [ ] `docker compose down -v` 的误操作风险已知悉：它会连带删除全部学习数据。

Nginx 反向代理片段：

```nginx
server {
  listen 443 ssl http2;
  server_name english.example.com;
  # ssl_certificate ... ssl_certificate_key ...
  limit_req zone=api burst=20 nodelay;      # http{} 里先声明 limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 6. 不用 Docker 的裸 Node 部署（备选）

只在无法使用容器时用。要点：Linux 上重新 `npm install`（**切勿拷贝 Windows 的 `node_modules`**，Prisma 引擎分平台）、`prisma migrate deploy` + seed、`vite build` 后由后端在 8787 单端口托管 `frontend/dist`，再用 systemd 或 pm2 拉起。国内网络同样需要 npmmirror 与 `PRISMA_ENGINES_MIRROR` 两个环境变量。
