const { getEco, saveEco, fmt } = require("../../utils/economy");

module.exports = {
  config: {
    name: "pay",
    aliases: ["give", "transfer"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 5,
    hasPermssion: 0,
    description: "Send money to another user from your wallet",
    commandCategory: "economy",
    usages: "@user <amount>"
  },
  run: async ({ api, event, args, Currencies, Users }) => {
    const { senderID, threadID, messageID, mentions } = event;
    const targetID = Object.keys(mentions || {})[0];
    if (!targetID) return api.sendMessage(`❌ Usage: !pay @user <amount>`, threadID, messageID);
    if (targetID === senderID) return api.sendMessage(`❌ You can't pay yourself!`, threadID, messageID);

    const amtStr = args.find(a => parseInt(a) > 0);
    const amt = parseInt(amtStr);
    if (!amt || amt < 1) return api.sendMessage(`❌ Enter a valid amount to send.`, threadID, messageID);

    const eco = await getEco(Currencies, senderID);
    if (eco.money < amt) return api.sendMessage(`❌ You only have 💵 ${fmt(eco.money)} in your wallet!`, threadID, messageID);

    const target = await getEco(Currencies, targetID);
    let sname = "User", tname = "Unknown";
    try { const u = await Users.getData(senderID); sname = u?.name || sname; } catch {}
    try { const u = await Users.getData(targetID); tname = u?.name || tname; } catch {}

    await saveEco(Currencies, senderID, eco.money - amt, eco.data);
    await saveEco(Currencies, targetID, target.money + amt, target.data);

    return api.sendMessage(
      `💸 MONEY TRANSFER\n` +
      `───────────────────\n` +
      `📤 From: ${sname}\n` +
      `📥 To:   ${tname}\n` +
      `💵 Amount: ${fmt(amt)}\n` +
      `───────────────────\n` +
      `👛 Your Wallet: 💵 ${fmt(eco.money - amt)}`,
      threadID, messageID
    );
  }
};
