import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

const CATEGORY_SEED = [
  '日常交流',
  '打招呼',
  '自我介绍',
  '工作',
  '购物',
  '餐厅',
  '交通',
  '旅行',
  '酒店',
  '电话',
  '家庭',
  '社交',
  '其他',
];

const SENTENCES: [string, string, string, string?, number?][] = [
  ['Nice to meet you.', '很高兴认识你。', '打招呼', '初次见面', 1],
  ['How is it going?', '最近怎么样？', '打招呼', '寒暄', 1],
  ['Long time no see.', '好久不见。', '打招呼', '重逢', 1],
  ['Have a good day!', '祝你今天愉快！', '打招呼', '道别', 1],
  ['My name is Tom, and I work in marketing.', '我叫汤姆，在市场部工作。', '自我介绍', '工作介绍', 1],
  ['I am from Shanghai.', '我来自上海。', '自我介绍', '基本信息', 1],
  ['I need to finish this work before Friday.', '我需要在周五之前完成这项工作。', '工作', '日常工作', 2],
  ["I'll check it later.", '我稍后检查一下。', '工作', '日常工作', 1],
  ['Could you send me the report by noon?', '你能在中午之前把报告发给我吗？', '工作', '请求', 2],
  ['Let me know if you need any help.', '如果你需要帮助就告诉我。', '工作', '协作', 1],
  ['The meeting has been moved to 3 p.m.', '会议改到下午三点了。', '工作', '会议', 2],
  ['How much does this cost?', '这个多少钱？', '购物', '询价', 1],
  ['Do you have this in a smaller size?', '这个有小一号的吗？', '购物', '挑选', 2],
  ['I would like to pay by card.', '我想刷卡。', '购物', '付款', 1],
  ['Can I get the check, please?', '请给我账单。', '餐厅', '付款', 1],
  ['I would like a table for two.', '我想要一张两人的桌子。', '餐厅', '订位', 2],
  ['Could I see the menu?', '我能看一下菜单吗？', '餐厅', '点餐', 1],
  ['What do you recommend?', '你有什么推荐吗？', '餐厅', '点餐', 2],
  ['The train to Beijing leaves at nine.', '去北京的火车九点发车。', '交通', '火车', 2],
  ['Excuse me, how do I get to the subway station?', '打扰一下，去地铁站怎么走？', '交通', '问路', 2],
  ['My flight takes off at six in the morning.', '我的航班早上六点起飞。', '旅行', '机场', 2],
  ['I would like to check in, please.', '我想办理入住。', '酒店', '入住', 1],
  ['Is breakfast included in the room rate?', '房费包含早餐吗？', '酒店', '咨询', 2],
  ['I have a reservation under the name of Li Ming.', '我用李明的名字订了房。', '酒店', '入住', 2],
  ['This is John calling from the bank.', '我是银行打来的约翰。', '电话', '来电', 2],
  ['The line is bad, could you speak up?', '信号不好，你能大声点吗？', '电话', '通话问题', 2],
  ['Can I call you back in ten minutes?', '我能十分钟后回你电话吗？', '电话', '请求', 1],
  ['I will be home late tonight.', '我今晚会很晚回家。', '家庭', '日常', 1],
  ['Could you help me with the dishes?', '你能帮我洗一下碗吗？', '家庭', '家务', 1],
  ['Let us grab coffee sometime.', '改天一起喝杯咖啡吧。', '社交', '邀约', 1],
  ['Are you free this weekend?', '你这周末有空吗？', '社交', '邀约', 1],
  ['Thanks for having me, I really enjoyed it.', '谢谢你的招待，我玩得很开心。', '社交', '感谢', 2],
  ['I am sorry, I did not catch that.', '抱歉，我没听清。', '日常交流', '倾听', 2],
  ['Could you say that again, please?', '请你再说一遍好吗？', '日常交流', '请求', 1],
  ['No problem, take your time.', '没问题，慢慢来。', '日常交流', '回应', 1],
  ['It does not matter to me.', '对我来说无所谓。', '日常交流', '表达意见', 2],
  ['That makes sense.', '有道理。', '日常交流', '表达意见', 1],
  ['Sounds good to me.', '听起来不错。', '日常交流', '回应', 1],
  ['What are you up to?', '你在忙什么？', '日常交流', '寒暄', 2],
  ['I am just looking around.', '我只是随便看看。', '购物', '逛街', 2],
];

async function ensureAdmin() {
  const password = process.env.ADMIN_PASSWORD || 'admin123456';
  const passwordHash = hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { name: 'admin' } });
  if (existing) {
    if (existing.passwordHash) {
      console.log('admin 账号已存在，跳过');
      return;
    }
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, isAdmin: true } });
    console.log(`已为 admin 账号设置初始密码：${password}`);
    return;
  }

  // 旧版本的匿名默认用户（持有全部历史学习记录）升级为 admin 登录账号
  const legacy = await prisma.user.findUnique({ where: { id: 1 } });
  if (legacy && !legacy.passwordHash) {
    await prisma.user.update({
      where: { id: legacy.id },
      data: { name: 'admin', passwordHash, isAdmin: true },
    });
    console.log(`已将旧用户 #${legacy.id} 升级为账号 "admin"，初始密码：${password}`);
    return;
  }

  // 全新库：自增主键让 admin 自然落到 id=1，与历史记录的 user_id=1 约定一致
  await prisma.user.create({ data: { name: 'admin', passwordHash, isAdmin: true } });
  console.log(`已创建 admin 账号，初始密码：${password}`);
}

async function main() {
  await ensureAdmin();

  for (let i = 0; i < CATEGORY_SEED.length; i++) {
    await prisma.category.upsert({
      where: { name: CATEGORY_SEED[i] },
      update: {},
      create: { name: CATEGORY_SEED[i], sortOrder: i },
    });
  }

  const existing = await prisma.sentence.count();
  if (existing === 0) {
    await prisma.sentence.createMany({
      data: SENTENCES.map(([english, chinese, category, subCategory, difficulty]) => ({
        english,
        chinese,
        category,
        subCategory: subCategory ?? null,
        difficulty: difficulty ?? 1,
      })),
    });
    console.log(`seeded ${SENTENCES.length} sentences`);
  } else {
    console.log(`database already has ${existing} sentences, skipped seeding`);
  }
}

main().finally(() => prisma.$disconnect());
