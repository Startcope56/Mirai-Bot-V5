const { getEco, saveEco, fmt, rand, cdFmt, hasItem } = require("../../utils/economy");

const ROB_CD = 2 * 60 * 60 * 1000; // 2 hours

module.exports = {
  config: {
    name: "rob",
    aliases: ["steal"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 3,
    hasPermssion: 0,
    description: "Rob another user's wallet — risky!",
    commandCategory: "games",
    usages: "@user"
  },
  run: async ({ api, event, args, Currencies, Users }) => {
    const { senderID, threadID, messageID, mentions } = event;
    const targetID = Object.keys(mentions || {})[0];
    if (!targetID) return api.sendMessage(`🔫 Usage: !rob @user\nExample: !rob @John`, threadID, messageID);
    if (targetID === senderID) return api.sendMessage(`❌ You can't rob yourself!`, threadID, messageID);

    const eco = await getEco(Currencies, senderID);
    const now = Date.now();
    const cd = hasItem(eco, "vip") ? ROB_CD * 0.75 : ROB_CD;
    if (now - (eco.data.lastRob || 0) < cd)
      return api.sendMessage(`⏰ ROB COOLDOWN\n───────────────────\n⏳ Wait: ${cdFmt(cd - (now - (eco.data.lastRob || 0)))}`, threadID, messageID);

    const victim = await getEco(Currencies, targetID);
    if (victim.money < 100) return api.sendMessage(`❌ That person is too broke to rob! (< 💵100)`, threadID, messageID);

    let sname = "Robber", tname = "Victim";
    try { const u = await Users.getData(senderID); sname = u?.name || sname; } catch {}
    try { const u = await Users.getData(targetID); tname = u?.name || tname; } catch {}

    eco.data.lastRob = now;

    const maskBoost   = hasItem(eco, "mask")   ? 0.10 : 0;
    const shieldBlock = hasItem(victim, "shield") ? 0.50 : 0;
    const successRate = 0.45 + maskBoost;
    const success     = Math.random() < successRate;

    if (!success) {
      const fine = rand(100, Math.min(400, eco.money));
      const newMoney = Math.max(0, eco.money - fine);
      await saveEco(Currencies, senderID, newMoney, eco.data);
      return api.sendMessage(
        `╔══════════════════╗\n║  🚔 ROB FAILED!  ║\n╚══════════════════╝\n` +
        `👤 ${sname} tried to rob ${tname}\n───────────────────\n` +
        `👮 Got caught! Paid -💵 ${fmt(fine)}\n👛 Wallet: 💵 ${fmt(newMoney)}`,
        threadID, messageID
      );
    }

    let stolen = Math.floor(victim.money * rand(15, 40) / 100);
    if (shieldBlock) {
      stolen = Math.floor(stolen * (1 - shieldBlock));
    }
    stolen = Math.min(stolen, victim.money);
    await saveEco(Currencies, senderID, eco.money + stolen, eco.data);
    await saveEco(Currencies, targetID, victim.money - stolen, victim.data);

    return api.sendMessage(
      `╔══════════════════╗\n║  🦹 ROB SUCCESS! ║\n╚══════════════════╝\n` +
      `🔫 ${sname} robbed ${tname}!\n───────────────────\n` +
      `💵 Stolen: +${fmt(stolen)}\n` +
      (shieldBlock ? `🛡️ Shield blocked 50% of loss!\n` : ``) +
      `👛 Your Wallet: 💵 ${fmt(eco.money + stolen)}\n⏰ Next rob: 2 hours`,
      threadID, messageID
    );
  }
};
