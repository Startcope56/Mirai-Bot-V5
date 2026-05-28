const { getEco, saveEco, fmt, rand } = require("../../utils/economy");

const DAILY_CD = 20 * 60 * 60 * 1000; // 20 hours
const BASE_REWARD = 500;
const STREAK_BONUS = 100;
const MAX_STREAK = 30;

module.exports = {
  config: {
    name: "daily",
    aliases: ["claim"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 3,
    hasPermssion: 0,
    description: "Claim your daily reward every 20 hours",
    commandCategory: "economy",
    usages: ""
  },
  run: async ({ api, event, Currencies, Users }) => {
    const { senderID, threadID, messageID } = event;
    const eco = await getEco(Currencies, senderID);
    const now = Date.now();
    const last = eco.data.lastDaily || 0;
    const since = now - last;

    if (since < DAILY_CD) {
      const remain = DAILY_CD - since;
      const h = Math.floor(remain / 3600000);
      const m = Math.floor((remain % 3600000) / 60000);
      return api.sendMessage(
        `⏰ DAILY COOLDOWN\n` +
        `───────────────────\n` +
        `⏳ Come back in: ${h}h ${m}m\n` +
        `💡 Your daily resets every 20 hours!`,
        threadID, messageID
      );
    }

    // Streak system
    const lastDate  = new Date(last).toDateString();
    const todayDate = new Date(now).toDateString();
    const yesterday = new Date(now - 86400000).toDateString();
    let streak = eco.data.streak || 0;
    if (lastDate === yesterday) {
      streak = Math.min(streak + 1, MAX_STREAK);
    } else if (lastDate !== todayDate) {
      streak = 1;
    }

    const reward = BASE_REWARD + (streak - 1) * STREAK_BONUS + rand(0, 200);
    const newMoney = eco.money + reward;
    eco.data.lastDaily = now;
    eco.data.streak = streak;
    await saveEco(Currencies, senderID, newMoney, eco.data);

    let name = "User";
    try { const u = await Users.getData(senderID); name = u?.name || name; } catch {}

    const stars = "⭐".repeat(Math.min(streak, 7));
    return api.sendMessage(
      `╔═══════════════════╗\n` +
      `║  🎁  D A I L Y    ║\n` +
      `╚═══════════════════╝\n` +
      `👤 ${name}\n` +
      `───────────────────\n` +
      `💵 Reward:  +${fmt(reward)}\n` +
      `🔥 Streak:  Day ${streak} ${stars}\n` +
      `👛 Wallet:  💵 ${fmt(newMoney)}\n` +
      `───────────────────\n` +
      (streak >= 7 ? `🏆 7-Day Streak Bonus active!\n` : ``) +
      `🕐 Next daily: 20 hours`,
      threadID, messageID
    );
  }
};
