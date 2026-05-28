const { getEco, fmt } = require("../../utils/economy");

module.exports = {
  config: {
    name: "balance",
    aliases: ["bal", "money", "cash"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 5,
    hasPermssion: 0,
    description: "Check your wallet and bank balance",
    commandCategory: "economy",
    usages: "[tag user]"
  },
  run: async ({ api, event, Currencies, Users }) => {
    const { senderID, threadID, messageID, mentions } = event;
    const targetID = Object.keys(mentions || {})[0] || senderID;
    const eco = await getEco(Currencies, targetID);
    let name = "Unknown";
    try { const u = await Users.getData(targetID); name = u?.name || name; } catch {}
    const wallet = eco.money;
    const bank   = eco.data.bank || 0;
    const total  = wallet + bank;
    const exp    = eco.exp || 0;
    const lvl    = Math.floor(Math.sqrt(exp / 100)) + 1;

    return api.sendMessage(
      `╔═══════════════════╗\n` +
      `║  💰  B A L A N C E  ║\n` +
      `╚═══════════════════╝\n` +
      `👤 ${name}\n` +
      `🎖️ Level ${lvl}  ·  ${exp} EXP\n` +
      `───────────────────\n` +
      `👛 Wallet  »  💵 ${fmt(wallet)}\n` +
      `🏦 Bank    »  💵 ${fmt(bank)}\n` +
      `───────────────────\n` +
      `💎 Net Worth: 💵 ${fmt(total)}\n` +
      `───────────────────\n` +
      `💡 !daily  !work  !bank`,
      threadID, messageID
    );
  }
};
