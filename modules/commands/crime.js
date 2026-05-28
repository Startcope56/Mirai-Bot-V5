const { getEco, saveEco, fmt, rand, cdFmt, CRIME_ACTIONS, hasItem } = require("../../utils/economy");

const CRIME_CD = 60 * 60 * 1000; // 1 hour
const FINE_MIN = 200;
const FINE_MAX = 800;

module.exports = {
  config: {
    name: "crime",
    aliases: ["cr"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 3,
    hasPermssion: 0,
    description: "Commit a crime for big money — but risk a fine!",
    commandCategory: "games",
    usages: ""
  },
  run: async ({ api, event, Currencies, Users }) => {
    const { senderID, threadID, messageID } = event;
    const eco = await getEco(Currencies, senderID);
    const now = Date.now();
    const cd = hasItem(eco, "vip") ? CRIME_CD * 0.75 : CRIME_CD;
    const last = eco.data.lastCrime || 0;

    if (now - last < cd)
      return api.sendMessage(
        `⏰ CRIME COOLDOWN\n───────────────────\n⏳ Wait: ${cdFmt(cd - (now - last))}\n🔫 Stay low for now...`,
        threadID, messageID
      );

    let name = "Criminal";
    try { const u = await Users.getData(senderID); name = u?.name || name; } catch {}

    const action = CRIME_ACTIONS[rand(0, CRIME_ACTIONS.length - 1)];
    const maskBonus = hasItem(eco, "mask") ? -0.1 : 0;
    const caught = Math.random() < (action.risk + maskBonus);
    eco.data.lastCrime = now;

    if (caught) {
      const fine = rand(FINE_MIN, FINE_MAX);
      const newMoney = Math.max(0, eco.money - fine);
      await saveEco(Currencies, senderID, newMoney, eco.data);
      return api.sendMessage(
        `╔══════════════════╗\n` +
        `║  🚔 BUSTED!      ║\n` +
        `╚══════════════════╝\n` +
        `👤 ${name}\n` +
        `───────────────────\n` +
        `${action.emoji} Tried to: ${action.action}\n` +
        `👮 You got caught!\n` +
        `💸 Fine: -💵 ${fmt(fine)}\n` +
        `👛 Wallet: 💵 ${fmt(newMoney)}\n` +
        `───────────────────\n` +
        `⏰ Next crime: 1 hour`,
        threadID, messageID
      );
    } else {
      const earned = rand(action.min, action.max);
      const newMoney = eco.money + earned;
      await saveEco(Currencies, senderID, newMoney, eco.data);
      return api.sendMessage(
        `╔══════════════════╗\n` +
        `║  🦹 SUCCESS!     ║\n` +
        `╚══════════════════╝\n` +
        `👤 ${name}\n` +
        `───────────────────\n` +
        `${action.emoji} You ${action.action}!\n` +
        `💵 Earned: +${fmt(earned)}\n` +
        `👛 Wallet: 💵 ${fmt(newMoney)}\n` +
        `───────────────────\n` +
        `⏰ Next crime: 1 hour`,
        threadID, messageID
      );
    }
  }
};
