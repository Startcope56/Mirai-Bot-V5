const { getEco, saveEco, fmt, rand, hasItem } = require("../../utils/economy");

module.exports = {
  config: {
    name: "coinflip",
    aliases: ["cf", "flip"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 5,
    hasPermssion: 0,
    description: "Flip a coin — heads or tails!",
    commandCategory: "games",
    usages: "<heads|tails> <bet>"
  },
  run: async ({ api, event, args, Currencies, Users }) => {
    const { senderID, threadID, messageID } = event;
    const choice = (args[0] || "").toLowerCase();
    const bet = parseInt(args[1]);

    if (!["heads", "tails", "h", "t"].includes(choice) || !bet || bet < 10)
      return api.sendMessage(
        `🪙 COIN FLIP\n───────────────────\n` +
        `Usage: !cf <heads|tails> <bet>\n` +
        `Example: !cf heads 500`,
        threadID, messageID
      );

    const eco = await getEco(Currencies, senderID);
    if (eco.money < bet) return api.sendMessage(`❌ You only have 💵 ${fmt(eco.money)}`, threadID, messageID);

    let name = "Player";
    try { const u = await Users.getData(senderID); name = u?.name || name; } catch {}

    const userChoice = choice.startsWith("h") ? "heads" : "tails";
    const lucky = hasItem(eco, "lucky");
    const winChance = lucky ? 0.53 : 0.50;
    const result = Math.random() < winChance ? "heads" : "tails";
    const won = userChoice === result;
    const net = won ? bet : -bet;
    const newMoney = eco.money + net;
    await saveEco(Currencies, senderID, newMoney, eco.data);

    const coinAnim = result === "heads" ? "🪙(H)" : "🪙(T)";
    return api.sendMessage(
      `╔══════════════════╗\n` +
      `║  🪙 COIN FLIP    ║\n` +
      `╚══════════════════╝\n` +
      `👤 ${name}\n` +
      `───────────────────\n` +
      `🎯 Your pick:  ${userChoice.toUpperCase()}\n` +
      `${coinAnim} Result:   ${result.toUpperCase()}\n` +
      `───────────────────\n` +
      (won
        ? `🎉 YOU WIN! +💵 ${fmt(bet)}\n`
        : `😢 You lose! -💵 ${fmt(bet)}\n`) +
      `👛 Wallet: 💵 ${fmt(newMoney)}`,
      threadID, messageID
    );
  }
};
