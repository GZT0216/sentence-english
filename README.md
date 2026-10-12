# SentenceFit · 个人英语句子学习网站

一个自托管的句子练习站点：把「背句子」拆成**学习 → 练习 → 错题 → 复习 → 统计**的闭环，每答一次题都真实写库并更新该账号的复习计划。
技术栈：React + TypeScript + Vite + Tailwind CSS（前端）/ Node.js + Express + Prisma + SQLite（后端），单容器 Docker 部署。

---

## 1. 这个项目解决什么问题

背句子常见的痛点是：**练过的句子记不住什么时候该复习，练的时候没有反馈，练完不知道自己卡在哪**。市面上的 App 要么把数据放在别人服务器上，要么用不透明的算法。

SentenceFit 用一个本地 SQLite 库解决这三件事：

| 问题 | 本项目的答案 |
| --- | --- |
| 什么时候复习哪句 | 按「连续答对次数」推进复习间隔（1/3/7/14/30 天），每天生成一个到期复习队列 |
| 练了到底有没有记住 | 每次作答服务端判定对错、写练习记录、更新掌握度（0–4），答错自动进错题本 |
| 材料从哪来 | 自带 40 句种子 + 一份 1224 句的场景短句 CSV（已含那 40 句），也可以自己用 CSV/Excel 批量导入 |

明确**不做**的事（第一版约束，代码里也确实没有）：

- 不用 AI 判断语义是否等价——答案判定全部是确定性字符串规则，见 [第 6 节](#6-答案判定与复习算法)。
- 不依赖第三方语音服务——朗读用浏览器内置 `speechSynthesis`，打字音效是本地采样文件。
- 没有云端账号体系、没有埋点、不向任何外部服务发数据。

所有练习按钮都对应真实接口，所有学习记录都真实落库；不存在「只生成静态页面」的假交互。

## 2. 主要功能

**学习**

- 四种练习模式：中译英（写英文）、英译中（看英文说中文，自评）、单词拼句（点击单词组词）、听力模式（听发音默写）。
- 今日队列优先级：到期复习 → 错题 → 没学过的新句 → 掌握度低的句子；今日已练过的句子不再出现。
- 两个不同的按钮：「不会」= 交空答案，服务端按答错记一笔并排到明天复习；「查看答案」= 只本地显示正确答案，**本题不计成绩、不写库**（界面会标注「本题不计成绩」）。
- 一轮结束可以「只重练本轮错题」。
- 记住上次学到哪（分类/难度/最后句子），下次打开学习页一键继续。
- 快捷键：结果页 `Enter` / `空格` 下一题，英译中自评页 `1` = 正确、`2` = 错误。

**复习与记录**

- 掌握度 0–4：未学习 / 学习中 / 熟悉 / 掌握 / 熟练；连续答对 1/2/3/4/5+ 次对应 1/3/7/14/30 天后复习，答错回到次日。
- 错题本（按错误次数排序，可单条移出）、收藏本（可整体重练）。
- 学习统计：今日作答数/正确率、近 7 天与近 14 天趋势、掌握度分布、连续学习天数（streak）、每日学习时长。今日目标固定 20 次作答，首页圆环显示进度。

**内容管理**

- 句子库按关键词/分类/难度/掌握状态/收藏筛选，分页浏览。
- 句子与分类的增删改，以及 CSV / Excel（.xlsx/.xls）批量导入，导入结果给出成功/重复/失败计数和逐行原因。

**账号与多用户**

- 账号 + 密码注册登录，密码 scrypt 加盐哈希存储，登录态是 30 天有效期的 JWT。
- 每个账号的掌握度、复习计划、错题、收藏、学习时长、上次学习位置全部按 `user_id` 隔离；管理接口（句子增删改、导入）仅管理员可用。
- 「设置」页可查看账号信息并修改自己的密码（需校验原密码）。

**界面**

- 深色/浅色主题、响应式布局；列表行内朗读按钮；打字机械键盘音效（6 种轴体音色可切换/关闭，采样加载失败自动回退 Web Audio 合成音）。
<img width="2880" height="1506" alt="image" src="https://github.com/user-attachments/assets/1a27188c-4980-4f20-b15b-b5ebed1afca8" />

<img width="2880" height="1506" alt="image" src="https://github.com/user-attachments/assets/ca8c38d8-1515-438e-8440-6cb861ff11ad" />

## 3. 安装方法

### 3.1 环境要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | 20 或 24（开发与镜像均在 24 实测；Prisma 6 要求 ≥ 18.18） | 后端 Express 4 + Prisma 6 |
| npm | 随 Node | 前后端各有一份 `package-lock.json` |
| Docker + Compose v2 | 仅部署时需要（实测 Docker 29 / Ubuntu 24.04） | 单容器方案 |

### 3.2 本地开发（前后端分离）

```bash
# 1) 后端
cd backend
cp .env.example .env                 # .env 不在仓库里；里面就是 DATABASE_URL 和 PORT
npm install
npx prisma migrate dev --name init   # 建库并自动执行 seed（写入 40 句 + 13 分类 + admin 账号）
npm run dev                          # tsx watch，监听 http://localhost:8787

# 2) 前端（另开终端）
cd frontend
npm install
npm run dev                          # Vite，http://localhost:5173（/api 自动代理到 8787）
```

打开 `http://localhost:5173`，用 `admin` / `admin123456` 登录（首次登录后请到「设置」改密码）。

- 数据库文件默认在 `backend/prisma/data/dev.db`，路径由 `backend/.env` 的 `DATABASE_URL` 决定；Prisma 引擎会自己读这个 `.env`。
- 想跳过 migration：`npm run db:push && npm run db:seed`；想彻底重来：删掉 `dev.db` 再执行上面任一命令。
- 境内网络装依赖慢时：`npm install --registry=https://registry.npmmirror.com`，并设置 `PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma`（Prisma 引擎二进制不走 npm 源）。

### 3.3 Docker 部署（Linux 服务器，已在 Ubuntu 24.04 + Docker 29 实测）

单容器：后端直接托管前端构建产物，只暴露一个端口 8787。
**完整手册见 [`DEPLOY-LINUX.md`](DEPLOY-LINUX.md)**——首次部署、日常更新、备份恢复、把本地 `dev.db` 搬到线上、忘记 admin 密码的重置脚本、故障排查表、上公网前的安全清单都在里面。

最小三步（境内服务器还需要额外的国内源配置，务必先看 `DEPLOY-LINUX.md` 1.3）：

```bash
# 1) 服务器上克隆仓库
git clone <本仓库地址> /opt/sentence-english && cd /opt/sentence-english

# 2) 写 .env（ADMIN_PASSWORD 必填，否则兜底成 admin123456）
printf 'ADMIN_PASSWORD=你的强密码\n' > .env && chmod 600 .env

# 3) 构建并启动
docker compose build && docker compose up -d
docker compose ps        # STATUS 应为 Up ... (healthy)
```

访问 `http://<服务器IP>:8787`，用 `admin` + `.env` 里的密码登录。容器启动时自动执行 `prisma migrate deploy` 和幂等 seed，`up -d` / `restart` 不会重复导入句子；学习数据与 JWT 密钥都在命名卷 `sentence-english_sentence-data` 里，重建镜像不丢数据、也不会让已登录用户掉线。**`docker compose down -v` 会连带删除全部学习数据。**

### 3.4 环境变量

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `admin123456` | 首次启动创建/升级 `admin` 账号的密码。**只在 admin 还没有密码时生效**，之后改它不会重置密码 |
| `JWT_SECRET` | 自动生成 | 不设置时容器在数据卷内生成随机密钥并持久化；多实例共享时才需要显式设置 |
| `DATABASE_URL` | `file:./data/app.db`（容器）/ `file:./data/dev.db`（本地） | SQLite 位置 |
| `PORT` | `8787` | 容器对外端口映射用（容器内固定 8787） |

## 4. 使用方法

### 4.1 第一次上手

1. **注册或登录**。导航栏「登录」→ 没有账号就点「注册」。账号 2–32 位（字母数字和 `_ @ . + -`），密码 6–72 位。
2. **灌入句子**（可选，种子只有 40 句）。管理员登录后进「管理」→ 导入，把仓库里的 `data/sentences-full.csv` 拖进去，返回 `imported 1184, duplicated 40`（那 40 句和种子重复），库里共 1224 句。之后每次登录就有一千多句可练。
3. **学习**。进「学习」页选模式：
   - 想默写就选**中译英**，看中文敲英文，`Enter` 提交；
   - 想练听力选**听力模式**，播放后默写；
   - 时间少就点「今日队列」，系统按 到期复习 → 错题 → 新句 的顺序组 20 句。
4. **看结果**。答错会做词级对比（哪个单词写错/漏写）；「不会」按答错计入成绩，「查看答案」只看不计成绩；一轮结束可以「只重练本轮错题」。
5. **第二天回来**。「首页」的圆环告诉你今天还差几次，下方有「到期复习 N 句」的一键入口；「学习」页顶部会问你「上次学到〈某分类〉，继续按原节奏练？」；答错的句子自动进「错题本」。
6. **回顾**。「统计」页看正确率趋势、掌握度分布和每日学习时长；「收藏」存放想反复练的句子。
7. **改密码**。导航栏「设置」→ 修改密码（需填原密码，改完当前登录不会失效）。

### 4.2 页面一览

| 路由 | 页面 | 权限 | 用途 |
| --- | --- | --- | --- |
| `/` | 首页 | 公开 | 问候语、今日目标圆环、到期复习入口、快捷统计 |
| `/library` | 句子库 | 公开可读 | 搜索/分类/难度/掌握度/收藏筛选，行内朗读、收藏 |
| `/study` | 学习入口 | 需登录 | 今日队列、四种模式、错题重练、收藏练习、上次学习位置 |
| `/study/session` | 练习会话 | 需登录 | 出题 → 作答 → 判定 → 反馈 → 下一题，末尾汇总本轮成绩 |
| `/mistakes` | 错题本 | 需登录 | 按错误次数排序，可单条移出、可整体重练 |
| `/favorites` | 收藏 | 需登录 | 收藏列表与重练 |
| `/stats` | 统计 | 需登录 | 正确率/题量趋势、掌握度分布、学习时长 |
| `/settings` | 设置 | 需登录 | 账号信息、修改密码 |
| `/manage` | 管理 | 仅管理员 | 句子增删改、分类管理、CSV/Excel 导入 |
| `/login`、`/register` | 认证 | 公开 | 登录注册 |

未登录访问需登录的页面会跳回登录页；普通账号访问管理接口返回 `403`。

### 4.3 准备自己的句子表

推荐表头（列顺序无所谓，多余的列如 `id` 会被忽略）：

```
category, sub_category, english, chinese, difficulty, tags, pronunciation, explanation
```

- `difficulty`：整数，超出范围会被夹到 1–5，无法解析时按 1 处理；`category` 缺省归入「其他」，新分类会自动创建。
- `english` 为唯一键：与库内或文件内已存在的句子重复时按「重复」计数跳过，不会产生脏数据。
- 表头别名都能识别：中文表头（`分类/场景/类别/主题`、`子分类`、`英文/英语/句子/原句`、`中文/翻译/释义`、`难度/级别/等级`、`标签`、`音标`、`讲解/解析/说明/注释`），前 8 行内自动找表头行。
- 完全不带表头时按内容启发式识别中英文列（要求英文列含 ASCII 字母、中文列含汉字，且至少 3 行同时满足，否则整个工作表会被跳过并给出原因）。
- Excel 多 sheet 时，若某行没有分类列，会用 sheet 名（清洗后）作为分类。
- CSV 请用 UTF-8（Excel 导出时选 “CSV UTF-8”）；检测到替换字符时自动按 GB18030 重新解码。
- 也可以直接上传 `.xlsx` / `.xls`；文件上限 20MB。

## 5. 输入输出示例

下面的响应全部取自一次**全新安装**的实例：`prisma db push` + seed（40 句）之后导入仓库里的 `data/sentences-full.csv`，再用 admin 账号逐个真实调用接口，原样抄回（token 已截断，字段与顺序一致）。你照第 3 节装完、导完句子，看到的总数就应该是这里的 1224。

### 5.1 导入文件与导入结果

输入 `data/import-example.csv`（节选）：

```csv
id,category,sub_category,english,chinese,difficulty,tags
1,日常交流,打招呼,Nice to meet you.,很高兴认识你。,1,greeting
3,餐厅,点餐,"I'd like a coffee, please.",请来一杯咖啡。,1,restaurant
6,电话,通话问题,You're breaking up. Can you hear me now?,你信号断断续续的，现在能听到吗？,2,phone
```

种子已有 40 句，导入 1224 行的 `data/sentences-full.csv`（它正是那 40 句的超集，所以 40 句判重）：

```json
{ "total": 1224, "imported": 1184, "duplicated": 40, "failed": 0,
  "errors": ["与库内句子重复，已跳过：Nice to meet you.", "……共 40 条"],
  "truncatedErrors": 0 }
```

含非法行的文件（这里有一行英文为空）：

```json
{ "total": 2, "imported": 2, "duplicated": 0, "failed": 0,
  "errors": ["「这条没有英文」：英文为空，已跳过"], "truncatedErrors": 0 }
```

英文为空的行不计入 `total`，只出现在 `errors` 里。同一份完整 CSV 再导第二次，全部判重：

```json
{ "total": 1224, "imported": 0, "duplicated": 1224, "failed": 0, "truncatedErrors": 1124 }
```

`errors` 最多回显 100 条，没显示出来的条数放在 `truncatedErrors`（1224 − 100 = 1124）。

### 5.2 登录

```bash
curl -X POST http://localhost:8787/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"name":"admin","password":"admin123456"}'
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5...(共 179 字符)",
  "user": { "id": 1, "name": "admin", "isAdmin": true, "createdAt": "2026-10-10T08:58:37.511Z" }
}
```

`admin123456` 是 seed 的默认密码，部署到公网前必须改（见 `DEPLOY-LINUX.md` 2.6 或设置页）；`createdAt` 以你自己建库的时间为准。

密码错误：`401 {"error":"账号或密码错误"}`；不带 token 访问需登录接口：`401 {"error":"请先登录"}`；普通账号调管理接口：`403 {"error":"仅管理员可执行此操作"}`。

### 5.3 取今日队列

`GET /api/daily?count=2`（`Authorization: Bearer <token>`）

```json
{
  "date": "2026-10-09T16:00:00.000Z",
  "requested": 2,
  "dueCount": 0,
  "items": [
    {
      "id": 9,
      "english": "Could you send me the report by noon?",
      "chinese": "你能在中午之前把报告发给我吗？",
      "category": "工作",
      "subCategory": "请求",
      "difficulty": 2,
      "favorite": false,
      "masteryLevel": 0,
      "wrongCount": 0,
      "correctCount": 0
    },
    {
      "id": 10,
      "english": "Let me know if you need any help.",
      "chinese": "如果你需要帮助就告诉我。",
      "category": "工作",
      "subCategory": "协作",
      "difficulty": 1,
      "favorite": false,
      "masteryLevel": 0,
      "wrongCount": 0,
      "correctCount": 0
    }
  ]
}
```

`date` 是服务端当天的零点（UTC 存法，`2026-10-09T16:00:00.000Z` 即北京时间 10-10）。刚练完第一批句子时 `dueCount` 为 0——所有复习都排在次日上午 9 点之后，等到期了这里才会是正数，队列顺序是 到期复习 → 错题 → 新句。

`count` 取值 1–100（默认 20），可加 `category=`购物 限定分类，或 `source=mistakes` / `source=favorites` 改成重练来源。

### 5.4 提交作答（核心写库接口）

```bash
curl -X POST http://localhost:8787/api/practice \
  -H 'Content-Type: application/json' -H "Authorization: Bearer <token>" \
  -d '{"sentenceId":1,"practiceType":"zh2en","userAnswer":"Nice to meet you."}'
```

```bash
curl -X POST http://localhost:8787/api/practice \
  -H 'Content-Type: application/json' -H "Authorization: Bearer <token>" \
  -d '{"sentenceId":1,"practiceType":"zh2en","userAnswer":"Nice to meet you."}'
```

一句全新的句子第一次答对（`2026-10-11T01:00:00.000Z` = 北京时间次日上午 9 点）：

```json
{
  "correct": true,
  "result": {
    "practiceCount": 1,
    "correctCount": 1,
    "wrongCount": 0,
    "consecutiveCorrect": 1,
    "masteryLevel": 1,
    "nextReviewAt": "2026-10-11T01:00:00.000Z"
  }
}
```

紧接着故意写错，同一接口：

```json
{
  "correct": false,
  "result": { "practiceCount": 2, "correctCount": 1, "wrongCount": 1, "consecutiveCorrect": 0, "masteryLevel": 1, "nextReviewAt": "2026-10-11T01:00:00.000Z" }
}
```

连练 5 次全对能把掌握度推到顶（间隔按 1/3/7/14/30 天走，所以是 30 天后）：

```json
{
  "correct": true,
  "result": { "practiceCount": 5, "correctCount": 5, "wrongCount": 0, "consecutiveCorrect": 5, "masteryLevel": 4, "nextReviewAt": "2026-11-09T01:00:00.000Z" }
}
```

英译中模式由你自评，请求体多带一个 `"selfJudged"`：

```bash
-d '{"sentenceId":8,"practiceType":"en2zh","userAnswer":"待会儿查","selfJudged":true}'
```

```json
{
  "correct": true,
  "result": { "practiceCount": 1, "correctCount": 1, "wrongCount": 0, "consecutiveCorrect": 1, "masteryLevel": 1, "nextReviewAt": "2026-10-11T01:00:00.000Z" }
}
```

对错一律由服务端判定，客户端不传 `correct`。句子不存在 → `404 {"error":"句子不存在"}`；模式不在四种之内 → `400 {"error":"不支持的练习类型"}`。

### 5.5 句子库查询

`GET /api/sentences?search=coffee&pageSize=1`

```json
{
  "total": 6,
  "page": 1,
  "pageSize": 1,
  "items": [
    {
      "id": 30,
      "english": "Let us grab coffee sometime.",
      "chinese": "改天一起喝杯咖啡吧。",
      "category": "社交",
      "subCategory": "邀约",
      "difficulty": 1,
      "tags": null,
      "pronunciation": null,
      "explanation": null,
      "createdAt": "2026-10-10T08:58:37.576Z",
      "favorite": false,
      "masteryLevel": 0,
      "practiceCount": 0,
      "correctCount": 0,
      "wrongCount": 0,
      "nextReviewAt": null
    }
  ]
}
```

参数：`search`（匹配英文/中文/标签）、`category`、`difficulty`、`mastery`（可逗号列表，如 `mastery=0,1`）、`favoritesOnly=1`、`page`、`pageSize`（1–500，默认 50）。带 token 时返回该账号的进度与收藏状态，不带 token 时进度字段为默认值。

### 5.6 统计

`GET /api/stats/summary`

```json
{
  "today": { "practiced": 16, "correct": 13, "wrong": 3, "accuracy": 81, "goal": 20 },
  "week": { "practiced": 16, "days": 1, "accuracy": 81 },
  "overall": {
    "totalSentences": 1224, "newSentences": 1216, "studied": 8, "mastered": 2, "learning": 5,
    "mistakes": 3, "favorites": 1, "dueReview": 0, "streak": 1,
    "todayStudySeconds": 445, "totalStudySeconds": 445
  }
}
```

`accuracy` 是整数百分比（13/16 → 81）；`mastered` 统计掌握度 ≥3 的句子；`goal` 固定 20，对应首页圆环。

`GET /api/stats/mastery`

```json
{
  "total": 1224,
  "unlearned": 1216,
  "levels": [
    { "level": 0, "count": 1 }, { "level": 1, "count": 5 },
    { "level": 2, "count": 0 }, { "level": 3, "count": 1 }, { "level": 4, "count": 1 }
  ]
}
```

`unlearned` 是从来没建过进度行的句子（`total − 各 level 之和`）。

`GET /api/stats/trend?days=7`（默认 14 天，可传 7–60，越界会被夹回来）返回：

```json
[{ "date": "2026-10-10", "practiced": 16, "sentences": 8, "correct": 13, "accuracy": 81, "seconds": 445 }]
```

`practiced` 是作答次数，`sentences` 是当天练过的**去重**句子数。

### 5.7 学习位置与时长

```
PUT  /api/progress/position   {"category":"购物","difficulty":2,"lastSentenceId":103}
→ {"userId":1,"category":"购物","difficulty":2,"lastSentenceId":103,"updatedAt":"2026-10-10T08:59:23.729Z"}

POST /api/progress/study-time {"seconds":125}
→ {"ok":true,"date":"2026-10-10","totalToday":125}

GET  /api/progress/study-time?days=7
→ {"total":125,"days":[{"date":"2026-10-10","seconds":125}]}

POST /api/progress/study-time {"seconds":320}
→ {"ok":true,"date":"2026-10-10","totalToday":445}
```

时长按「同一账号 + 同一自然日」累加，单次上报的 `seconds` 会被夹到 0–6 小时；`days` 可传 1–60。上次学习位置用于「学习」页顶部那句「上次学到〈购物 · 难度 2〉，继续？」的提示。

### 5.8 收藏与错题本

```
POST /api/favorites/toggle {"sentenceId":3}   → {"favorite":true}
POST /api/favorites/toggle {"sentenceId":3}   → {"favorite":false}   # 同一个接口来回切

GET  /api/favorites
→ [{"id":5,"english":"My name is Tom, and I work in marketing.","chinese":"我叫汤姆，在市场部工作。",
    "category":"自我介绍","subCategory":"工作介绍","difficulty":1,
    "masteryLevel":1,"favorite":true,"favoritedAt":"2026-10-10T09:00:35.075Z"}]

GET  /api/sentences?favoritesOnly=1&pageSize=1
→ {"total":1,"page":1,"pageSize":1,"items":[{...带 masteryLevel/practiceCount/nextReviewAt 的完整句子}]}

GET  /api/practice/mistakes
→ [{"id":5,"english":"My name is Tom, and I work in marketing.", ... "wrongCount":1, "nextReviewAt":"2026-10-11T01:00:00.000Z"},
   {"id":2,"english":"How is it going?", ... "wrongCount":1, "masteryLevel":0}]
```

收藏列表和错题本都直接返回数组（不分页）；错题本按 `wrongCount` 倒序、其次最近练习时间排序，也就是「错得最多的排最前」。`DELETE /api/practice/mistakes/:sentenceId` 把某条错题移出。

## 6. 答案判定与复习算法

**判定（确定性规则，无 AI）**

- 中译英 / 听力 / 拼句：忽略大小写、首尾空格、句末标点，连续空格视为一个；缩写形式视为等价（`don't` = `do not`、`i'm` = `i am` 等）。判定在服务端 `backend/src/utils/answer.ts`。
- 英译中：前端提交后展示参考翻译，由用户自评（`selfJudged`）。
- 答错时前端做词级 diff，标出具体是哪个单词写错或漏写。

**复习计划**

- 连续答对 1 / 2 / 3 / 4 / 5+ 次 → 1 / 3 / 7 / 14 / 30 天后复习，时间统一落在次日上午 9 点。
- 答错 → 连续答对清零，次日重新进入队列。
- 掌握度：`0 未学习 → 1 学习中 → 2 熟悉 → 3 掌握 → 4 熟练`；答错会把掌握度压回 1 以下。
- 这是简化版间隔重复，不是完整 SRS/FSRS，也不会用语义判断——好处是行为完全可预测。

## 7. 数据模型

Prisma + SQLite，共 8 张表（`backend/prisma/schema.prisma`）：

| 表 | 作用 | 关键约束 |
| --- | --- | --- |
| `users` | 账号（`name` 唯一、`password_hash`、`is_admin`） | 密码为 `scrypt:<salt>:<hash>` |
| `sentences` | 句子库 | `english` 唯一，`category` 建索引 |
| `categories` | 分类字典（支持 `parent_id`） | `name` 唯一 |
| `user_sentence_progress` | 每人每句一行：练习/对错/连续答对/掌握度/下次复习时间 | `(user_id, sentence_id)` 唯一，`(user_id, next_review_at)` 索引 |
| `practice_records` | 逐次作答流水 | `(user_id, created_at)` 索引 |
| `favorites` | 收藏 | `(user_id, sentence_id)` 唯一 |
| `study_time_daily` | 每日学习时长（秒） | `(user_id, date)` 唯一 |
| `study_positions` | 每人的上次学习位置 | `user_id` 主键，级联删除 |

数据隔离的实现方式：所有读写路径的 `userId` 一律取自 JWT（服务端 `req.userId`），前端传什么都会被忽略；进度/收藏表有 `(user_id, sentence_id)` 唯一约束，A 账号无法读到或改动 B 账号的行。

## 8. API 摘要

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/health` | 公开 | 健康检查，返回 `{ok:true}` |
| POST | `/api/auth/register`、`/api/auth/login` | 公开 | 注册/登录，返回 `{token,user}` |
| GET | `/api/auth/me` | 登录 | 校验 token 并返回当前用户 |
| PUT | `/api/auth/password` | 登录 | 修改自己的密码（校验原密码） |
| POST | `/api/auth/logout` | 登录 | 无状态接口，仅供前端统一调用（服务端不存 session） |
| GET | `/api/sentences`、`/api/sentences/:id` | 公开（带 token 则含进度） | 列表与详情 |
| GET | `/api/sentences/meta/categories` | 公开 | 库内分类及各句数量 |
| POST/PUT/DELETE | `/api/sentences[/:id]` | 管理员 | 句子增改删 |
| GET | `/api/categories` | 公开 | 分类树 |
| POST/PUT/DELETE | `/api/categories[/:id]` | 管理员 | 分类管理 |
| GET | `/api/daily` | 登录 | 今日学习队列 |
| POST | `/api/practice` | 登录 | 提交作答：判定 + 写记录 + 更新掌握度/下次复习时间 |
| GET/DELETE | `/api/practice/mistakes[/:sentenceId]` | 登录 | 错题本 / 移出单条错题 |
| GET/POST | `/api/favorites`、`/api/favorites/toggle` | 登录 | 收藏列表 / 收藏切换 |
| GET | `/api/stats/summary`、`/trend`、`/mastery` | 登录 | 统计 |
| PUT/GET | `/api/progress/position` | 登录 | 上次学习位置 |
| POST/GET | `/api/progress/study-time` | 登录 | 学习时长上报/查询 |
| POST | `/api/import/sentences` | 管理员 | CSV/Excel 导入（multipart 字段名 `file`） |

## 9. 目录结构

```
.
├─ backend/                    # Express + Prisma + SQLite
│  ├─ prisma/schema.prisma     # 8 张表
│  ├─ prisma/migrations/       # 初始迁移 + 多用户迁移
│  ├─ prisma/seed.ts           # 40 句示例 + 13 分类 + admin 账号（幂等）
│  └─ src/
│     ├─ routes/               # auth / sentences / categories / daily / practice / favorites / stats / progress / import
│     ├─ services/importService.ts
│     ├─ utils/                # answer 判定 · srs 复习 · password 哈希 · token · time
│     └─ middleware/auth.ts    # JWT 校验、admin 校验、uid 提取
├─ frontend/
│  ├─ public/kb/               # 本地键盘采样（含各自 LICENSE）
│  └─ src/
│     ├─ api/client.ts  auth/AuthContext.tsx
│     ├─ pages/               # Home Library Study StudySession Mistakes Favorites Stats Settings Manage Auth
│     ├─ components/          # layout / ui / sentence / study / charts
│     ├─ hooks/               # useTTS（浏览器语音） useTheme
│     └─ audio/typingSound.ts # 采样播放 + Web Audio 回退
├─ data/
│  ├─ import-example.csv       # 导入示例（10 句）
│  └─ sentences-full.csv       # 场景短句语料（1224 句 / 23 分类 / 984 句带音标）
├─ DEPLOY-LINUX.md             # Linux 完整部署手册
├─ Dockerfile / docker-compose.yml / .dockerignore
└─ README.md / LICENSE
```

## 10. 已知限制

写在这里是为了让文档和实际行为一致：

- 没有找回密码/邮箱验证；忘记 admin 密码只能在服务器上按 `DEPLOY-LINUX.md` 2.6 的脚本改库。
- JWT 30 天内不吊销，改密码后旧 token 仍可用；退出登录只清本地 token。
- 注册与登录接口**没有限流**，公网暴露前要在反代层加限速。
- `cors()` 全开、链路明文，上公网必须放在 Nginx/Caddy 之后配 HTTPS。
- 英译中依赖用户自评，听力模式的质量取决于本机浏览器的英文语音包（Chrome/Edge 较好，部分 Linux 桌面没有英文 voice）。
- SQLite 单文件，适合个人/小团队；高并发写不是设计目标。
- 复习算法是固定间隔表，不会根据句子难度或个人遗忘曲线自适应。
- 自带语料只有 1224 句，集中在问路/点餐/购物/酒店这类日常出行场景；面试、医疗、技术讨论等垂直场景要自己按 4.3 造表导入。

## 11. 打字音效音源

导航栏「键盘」图标可开关/切换轴体/调音量。音效为本地真实键盘录音采样（`frontend/public/kb/`，运行时不依赖任何第三方服务）：

- 麻将音 → Gateron Black Ink、红轴 → Gateron Red Ink、黑轴 → Cherry MX Black、青轴 → Cherry MX Blue、茶轴 → Cherry MX Brown、静电容 → Holy Panda
- 6 个采样包全部来自 [kbsim](https://github.com/tplai/kbsim)（MIT，Copyright Thomas Lai），每个包目录里都带着上游 `LICENSE`，共约 320KB
- 采样加载完成前及加载失败时自动回退到 Web Audio 合成音

## 12. 许可证与数据来源

- 本仓库的**代码**（`backend/`、`frontend/src/`、Dockerfile、部署文档）采用 [MIT License](LICENSE)，版权署名 `Gzt`。
- 随包的第三方素材**不在** MIT 覆盖范围内，沿用各自的授权：
  - `frontend/public/kb/*/` 的键盘采样是第三方录音，沿用上游 kbsim 的 MIT 授权，授权文件就在各包目录里；再分发时必须一并保留这些 `LICENSE` 文件与署名。
- `data/sentences-full.csv`（1224 句）是个人学习整理的场景短句，作者不对其中的例句主张版权，也不担保其可商用；需要商用请自行替换数据。
  - 发布前从这个语料里**剔除了另一份 2130 句的存档语料**（分类名「句子存档」）——那部分最早来自第三方课件文稿，来源和授权都没法核实，所以不进公开仓库。如果你本来就拥有这批语料，删掉 CSV 里对应分类即可，导入功能不受影响。
  - 原始工作表（`.xlsx`）因版权和体积原因不入库，只在 `.gitignore` 里保留 `*.xlsx` / `*.xls` 规则。
- 分发 fork 时，请同时保留 `frontend/public/kb/` 下的 LICENSE 文件。
