# SentenceFit · 个人英语句子学习站

自托管的「背句子」站点：把背句子拆成 **学习 → 练习 → 错题 → 复习 → 统计** 的闭环，每答一次题都真实写库并更新该账号的复习计划。

技术栈：React + TypeScript + Vite + Tailwind CSS（前端）/ Node.js + Express + Prisma + SQLite（后端）。

## 功能

**练习**
- 四种模式：中译英（敲英文）、英译中（自评）、单词拼句（点词组词）、听力模式（听发音默写）。
- 今日队列按 到期复习 → 错题 → 新句 → 掌握度低 组题，今天练过的不再出现。
- 「不会」= 按答错计入成绩；「查看答案」= 只看不计成绩、不写库。一轮结束可只重练本轮错题。
- 记住上次学到哪，下次打开一键继续。

**复习与统计**
- 连续答对 1/2/3/4/5+ 次 → 1/3/7/14/30 天后复习，答错回到次日；掌握度 0–4（未学习/学习中/熟悉/掌握/熟练）。
- 错题本（按错误次数排序）、收藏本、正确率趋势、掌握度分布、连续学习天数、每日学习时长。
- 今日目标固定 20 次作答，首页圆环显示进度。

**内容与账号**
- 自带 40 句种子 + 1224 句场景短句 CSV，支持 CSV / Excel（.xlsx/.xls）批量导入，逐行给出成功/重复/失败原因。
- 多账号：密码 scrypt 加盐哈希，30 天 JWT；每个账号的进度、复习、错题、收藏、时长全部按 `user_id` 隔离，句子增删改与导入仅管理员可用。

**其他**
- 深色/浅色主题、响应式；浏览器内置语音朗读；本地键盘音效（6 种轴体，可关闭）。
- 不用 AI 判语义、不依赖第三方语音服务、无埋点，答案判定是确定性字符串规则。

<img width="2880" height="1506" alt="界面截图" src="https://github.com/user-attachments/assets/1a27188c-4980-4f20-b15b-b5ebed1afca8" />

<img width="2880" height="1506" alt="界面截图" src="https://github.com/user-attachments/assets/ca8c38d8-1515-438e-8440-6cb861ff11ad" />

## 安装

环境要求：Node.js 20 或 24（含 npm）、Git；Docker 只在容器部署时需要。

### 方式一：本地跑起来（Windows / Linux / macOS 命令一致）

```bash
# 后端
cd backend
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm install
npx prisma migrate dev --name init    # 建库并 seed：40 句 + 13 分类 + admin 账号
npm run dev                 # http://localhost:8787

# 前端（另开一个终端）
cd frontend
npm install
npm run dev                 # http://localhost:5173，/api 自动代理到 8787
```

打开 `http://localhost:5173`，用 `admin` / `admin123456` 登录，登录后到「设置」改密码。

- 已有数据库想跳过 migration：`npm run db:push && npm run db:seed`。
- 境内网络从 npm 官方源拉依赖慢时加 `--registry=https://registry.npmmirror.com`，并设 `PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma`（Prisma 引擎二进制不走 npm 源）。

### 方式二：Docker 单容器（放在服务器上长期跑）

后端直接托管前端构建产物，只暴露一个端口 8787。Linux / macOS / Windows（Docker Desktop）通用：

```bash
git clone <本仓库地址> && cd <仓库目录>

# 写 .env（必填，否则 admin 密码兜底成 admin123456）
printf 'ADMIN_PASSWORD=你的强密码\n' > .env && chmod 600 .env
# Windows PowerShell: 'ADMIN_PASSWORD=你的强密码' | Out-File -Encoding ascii .env

docker compose build && docker compose up -d
docker compose ps           # STATUS 应为 Up ... (healthy)
```

访问 `http://<主机IP>:8787`，用 `admin` + `.env` 里的密码登录。

学习数据和自动生成的 JWT 密钥都在命名卷 `sentence-english_sentence-data` 里：重建镜像不丢数据、已登录用户不掉线；**`docker compose down -v` 会连同学习数据一起删除**。容器每次启动自动执行 `prisma migrate deploy` 和幂等 seed，重复 `up -d` 不会重复导入句子。

境内服务器构建若卡在拉取基础镜像或 `npm ci`，在同一个 `.env` 里补 `BASE_IMAGE`、`PRISMA_ENGINES_MIRROR`、`NPM_REGISTRY` 三项（取值见 `DEPLOY-LINUX.md` 1.3，境外机器走默认值即可）。首次部署、日常更新、备份恢复、忘记密码怎么重置、上公网前的安全清单，也都在 [`DEPLOY-LINUX.md`](DEPLOY-LINUX.md) 里。

### 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `admin123456` | 首次启动创建 admin 的密码，只在 admin 还没密码时生效 |
| `JWT_SECRET` | 自动生成并持久化 | 单实例不用管；多实例共享登录态才需要显式设置 |
| `DATABASE_URL` | `file:./data/app.db`（容器）/ `file:./data/dev.db`（本地） | SQLite 位置 |
| `PORT` | `8787` | 仅容器端口映射需要改 |

## 上手用一遍

1. 登录或注册（账号 2–32 位，密码 6–72 位）。
2. 管理员进「管理」→ 导入，把 `data/sentences-full.csv` 拖进去，返回 `imported 1184, duplicated 40`（那 40 句和种子重复），库内共 1224 句。
3. 进「学习」选模式开始练；`Enter` 提交，结果页 `Enter`/`空格` 下一题，英译中自评页 `1` = 正确、`2` = 错误。
4. 答错自动进「错题本」，前端做词级 diff 标出哪个单词写错或漏写。
5. 第二天回首页看圆环和「到期复习 N 句」入口，「统计」页看趋势。

页面：`/` 首页 · `/library` 句子库 · `/study` 学习入口 · `/study/session` 练习会话 · `/mistakes` 错题本 · `/favorites` 收藏 · `/stats` 统计 · `/settings` 设置 · `/manage` 管理（仅管理员）。

## 准备自己的句子表

表头（列顺序随意，多余列忽略）：

```
category, sub_category, english, chinese, difficulty, tags, pronunciation, explanation
```

- `english` 是唯一键，重复的句子按「重复」计数跳过；`difficulty` 会被夹到 1–5；`category` 缺省归入「其他」，新分类自动创建。
- 支持中文表头别名（`分类/场景`、`英文/句子`、`中文/翻译` 等），无表头时按中英文内容启发式识别列。
- CSV 请用 UTF-8；也可直接上传 `.xlsx` / `.xls`，单文件上限 20MB。参考 `data/import-example.csv`。

## 已知限制

无找回密码（忘记 admin 密码按 `DEPLOY-LINUX.md` 改库）；注册登录无限流、`cors()` 全开，上公网必须配 HTTPS 反代；SQLite 单文件适合个人/小团队；语料集中在问路/点餐/购物/酒店等日常场景，垂直场景自己导入。

## 许可证

代码采用 [MIT License](LICENSE)，版权署名 `Gzt`。`frontend/public/kb/` 的键盘采样沿用上游 kbsim 的 MIT 授权，授权文件在各包目录内，再分发时请一并保留；`data/sentences-full.csv` 为个人整理的学习语料，不担保可商用。
