const { getEco, saveEco, fmt } = require("../../utils/economy");
const bold = require("../../utils/bold");

module.exports = {
  config: {
    name: "bank",
    aliases: ["savings"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 3,
    hasPermssion: 0,
    description: "Bank system: deposit, withdraw, transfer",
    commandCategory: "economy",
    usages: "deposit <amount> | withdraw <amount> | transfer @user <amount> | balance"
  },
  run: async ({ api, event, args, Currencies, Users }) => {
    const { senderID, threadID, messageID, mentions } = event;
    const sub = (args[0] || "balance").toLowerCase();

    const eco = await getEco(Currencies, senderID);
    let name = "User";
    try { const u = await Users.getData(senderID); name = u?.name || name; } catch {}

    // ── BALANCE ──────────────────────────────────────────────────────────────
    if (sub === "balance" || sub === "bal") {
      return api.sendMessage(
        `╔═══════════════════╗\n` +
        `║  🏦  B A N K      ║\n` +
        `╚═══════════════════╝\n` +
        `👤 ${name}\n───────────────────\n` +
        `👛 Wallet:  💵 ${fmt(eco.money)}\n` +
        `🏦 Bank:    💵 ${fmt(eco.data.bank)}\n` +
        `───────────────────\n` +
        `💡 !bank deposit <amount>\n` +
        `💡 !bank withdraw <amount>\n` +
        `💡 !bank transfer @user <amount>`,
        threadID, messageID
      );
    }

    // ── DEPOSIT ───────────────────────────────────────────────────────────────
    if (sub === "deposit" || sub === "dep") {
      let amt = args[1] === "all" ? eco.money : parseInt(args[1]);
      if (!amt || amt <= 0) return api.sendMessage(`❌ Usage: !bank deposit <amount> or !bank deposit all`, threadID, messageID);
      if (amt > eco.money) return api.sendMessage(`❌ You only have 💵 ${fmt(eco.money)} in your wallet!`, threadID, messageID);
      eco.data.bank += amt;
      await saveEco(Currencies, senderID, eco.money - amt, eco.data);
      return api.sendMessage(
        `🏦 BANK DEPOSIT\n───────────────────\n` +
        `✅ Deposited: 💵 ${fmt(amt)}\n` +
        `👛 Wallet:    💵 ${fmt(eco.money - amt)}\n` +
        `🏦 Bank:      💵 ${fmt(eco.data.bank)}`,
        threadID, messageID
      );
    }

    // ── WITHDRAW ──────────────────────────────────────────────────────────────
    if (sub === "withdraw" || sub === "with" || sub === "wd") {
      let amt = args[1] === "all" ? eco.data.bank : parseInt(args[1]);
      if (!amt || amt <= 0) return api.sendMessage(`❌ Usage: !bank withdraw <amount> or !bank withdraw all`, threadID, messageID);
      if (amt > eco.data.bank) return api.sendMessage(`❌ Your bank only has 💵 ${fmt(eco.data.bank)}!`, threadID, messageID);
      eco.data.bank -= amt;
      await saveEco(Currencies, senderID, eco.money + amt, eco.data);
      return api.sendMessage(
        `🏦 BANK WITHDRAW\n───────────────────\n` +
        `✅ Withdrew:  💵 ${fmt(amt)}\n` +
        `👛 Wallet:   💵 ${fmt(eco.money + amt)}\n` +
        `🏦 Bank:     💵 ${fmt(eco.data.bank)}`,
        threadID, messageID
      );
    }

    // ── TRANSFER ──────────────────────────────────────────────────────────────
    if (sub === "transfer" || sub === "send") {
      const mentionID = Object.keys(mentions || {})[0];
      if (!mentionID) return api.sendMessage(`❌ Usage: !bank transfer @user <amount>`, threadID, messageID);
      const amtStr = args.find(a => parseInt(a) > 0);
      const amt = parseInt(amtStr);
      if (!amt || amt <= 0) return api.sendMessage(`❌ Specify a valid amount.`, threadID, messageID);
      if (amt > eco.data.bank) return api.sendMessage(`❌ Your bank only has 💵 ${fmt(eco.data.bank)}!`, threadID, messageID);
      const target = await getEco(Currencies, mentionID);
      let tname = "Unknown";
      try { const u = await Users.getData(mentionID); tname = u?.name || tname; } catch {}
      eco.data.bank -= amt;
      target.data.bank += amt;
      await saveEco(Currencies, senderID, eco.money, eco.data);
      await saveEco(Currencies, mentionID, target.money, target.data);
      return api.sendMessage(
        `🏦 BANK TRANSFER\n───────────────────\n` +
        `✅ Sent: 💵 ${fmt(amt)}\n` +
        `➡️ To: ${tname}\n` +
        `🏦 Your Bank: 💵 ${fmt(eco.data.bank)}`,
        threadID, messageID
      );
    }

    return api.sendMessage(`❓ Usage: !bank [balance | deposit | withdraw | transfer @user <amount>]`, threadID, messageID);
  }
};
