const { getEco, fmt, ITEMS } = require("../../utils/economy");

module.exports = {
  config: {
    name: "profile",
    aliases: ["pf", "stats"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 5,
    hasPermssion: 0,
    description: "View your profile and game statistics",
    commandCategory: "economy",
    usages: "[@user]"
  },
  run: async ({ api, event, Currencies, Users }) => {
    const { senderID, threadID, messageID, mentions } = event;
    const targetID = Object.keys(mentions || {})[0] || senderID;
    const eco = await getEco(Currencies, targetID);

    let name = "Unknown";
    try { const u = await Users.getData(targetID); name = u?.name || name; } catch {}

    const wallet = eco.money;
    const bank   = eco.data.bank || 0;
    const exp    = eco.exp || 0;
    const lvl    = Math.floor(Math.sqrt(exp / 100)) + 1;
    const nextLvlExp = Math.pow(lvl, 2) * 100;
    const progress = Math.min(100, Math.floor((exp / nextLvlExp) * 100));
    const bar = "█".repeat(Math.floor(progress / 10)) + "░".repeat(10 - Math.floor(progress / 10));
    const streak = eco.data.streak || 0;
    const inv = eco.data.inventory || [];
    const invNames = inv.map(id => {
      const item = ITEMS.find(i => i.id === id);
      return item ? item.name : id;
    });

    return api.sendMessage(
      `╔════════════════════╗\n` +
      `║  👤  P R O F I L E ║\n` +
      `╚════════════════════╝\n` +
      `🏷️  ${name}\n` +
      `🆔  ${targetID}\n` +
      `────────────────────\n` +
      `🎖️  Level: ${lvl}\n` +
      `⚡  EXP: ${fmt(exp)} / ${fmt(nextLvlExp)}\n` +
      `    [${bar}] ${progress}%\n` +
      `────────────────────\n` +
      `👛  Wallet:  💵 ${fmt(wallet)}\n` +
      `🏦  Bank:    💵 ${fmt(bank)}\n` +
      `💎  Total:   💵 ${fmt(wallet + bank)}\n` +
      `────────────────────\n` +
      `🔥  Daily Streak: ${streak} day(s)\n` +
      `🎒  Inventory: ${invNames.length ? invNames.join(", ") : "Empty"}\n` +
      `────────────────────\n` +
      `💡 !daily  !work  !shop`,
      threadID, messageID
    );
  }
};
