const { getEco, saveEco, fmt, rand, cdFmt, WORK_JOBS, hasItem } = require("../../utils/economy");

const WORK_CD = 45 * 60 * 1000; // 45 minutes

module.exports = {
  config: {
    name: "work",
    aliases: ["job"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 3,
    hasPermssion: 0,
    description: "Work to earn coins — 45 minute cooldown",
    commandCategory: "economy",
    usages: ""
  },
  run: async ({ api, event, Currencies, Users }) => {
    const { senderID, threadID, messageID } = event;
    const eco = await getEco(Currencies, senderID);
    const now = Date.now();
    const last = eco.data.lastWork || 0;
    const cd = hasItem(eco, "vip") ? WORK_CD * 0.75 : WORK_CD;

    if (now - last < cd) {
      const remain = cd - (now - last);
      return api.sendMessage(
        `⏰ WORK COOLDOWN\n───────────────────\n⏳ Rest for: ${cdFmt(remain)}\n💡 You can work again soon!`,
        threadID, messageID
      );
    }

    const job = WORK_JOBS[rand(0, WORK_JOBS.length - 1)];
    let earned = rand(job.min, job.max);
    if (hasItem(eco, "laptop"))  earned = Math.floor(earned * 2);
    else if (hasItem(eco, "pickaxe")) earned = Math.floor(earned * 1.3);

    const xpGain = rand(10, 30);
    eco.data.lastWork = now;
    const newMoney = eco.money + earned;
    const newExp = (eco.exp || 0) + xpGain;
    await saveEco(Currencies, senderID, newMoney, eco.data);
    await Currencies.setData(senderID, { exp: newExp });

    let name = "User";
    try { const u = await Users.getData(senderID); name = u?.name || name; } catch {}

    return api.sendMessage(
      `╔═══════════════════╗\n` +
      `║  ${job.emoji}  W O R K     ║\n` +
      `╚═══════════════════╝\n` +
      `👤 ${name}\n` +
      `💼 Job: ${job.emoji} ${job.title}\n` +
      `───────────────────\n` +
      `💵 Earned:  +${fmt(earned)}\n` +
      `⚡ EXP:     +${xpGain}\n` +
      `👛 Wallet:  💵 ${fmt(newMoney)}\n` +
      `───────────────────\n` +
      `⏰ Next work: 45 minutes`,
      threadID, messageID
    );
  }
};
