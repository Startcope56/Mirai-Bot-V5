const { getEco, saveEco, fmt, rand, hasItem } = require("../../utils/economy");

const REELS = ["🍒", "🍋", "🍊", "🍇", "💎", "7️⃣", "🎰", "⭐", "🔔"];
const PAYOUTS = {
  "💎💎💎": 20, "7️⃣7️⃣7️⃣": 15, "🎰🎰🎰": 12,
  "⭐⭐⭐": 10, "🔔🔔🔔": 8,  "🍇🍇🍇": 6,
  "🍒🍒🍒": 5,  "🍊🍊🍊": 4,  "🍋🍋🍋": 3,
};
const MIN_BET = 50;
const MAX_BET = 10000;

module.exports = {
  config: {
    name: "slots",
    aliases: ["slot", "spin"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 8,
    hasPermssion: 0,
    description: "Spin the slot machine and win big!",
    commandCategory: "games",
    usages: "<bet>"
  },
  run: async ({ api, event, args, Currencies, Users }) => {
    const { senderID, threadID, messageID } = event;
    const bet = parseInt(args[0]);
    if (!bet || bet < MIN_BET || bet > MAX_BET)
      return api.sendMessage(`🎰 Usage: !slots <${MIN_BET}-${fmt(MAX_BET)}>\nExample: !slots 500`, threadID, messageID);

    const eco = await getEco(Currencies, senderID);
    if (eco.money < bet) return api.sendMessage(`❌ Not enough coins! You have 💵 ${fmt(eco.money)}`, threadID, messageID);

    let name = "Player";
    try { const u = await Users.getData(senderID); name = u?.name || name; } catch {}

    const lucky = hasItem(eco, "lucky");

    // Spin reels
    let s1, s2, s3;
    const jackpotChance = lucky ? 0.08 : 0.05;
    const tripleChance  = lucky ? 0.30 : 0.22;

    if (Math.random() < jackpotChance) {
      const jk = REELS[rand(4, 8)]; s1 = s2 = s3 = jk;
    } else if (Math.random() < tripleChance) {
      const sym = REELS[rand(0, REELS.length - 1)]; s1 = s2 = s3 = sym;
    } else {
      s1 = REELS[rand(0, REELS.length - 1)];
      s2 = REELS[rand(0, REELS.length - 1)];
      s3 = REELS[rand(0, REELS.length - 1)];
    }

    const combo = `${s1}${s2}${s3}`;
    const mult  = PAYOUTS[combo] || (s1 === s2 || s2 === s3 ? 1.5 : 0);
    const won   = mult > 0;
    const net   = won ? Math.floor(bet * mult) - bet : -bet;
    const newMoney = eco.money + net;
    await saveEco(Currencies, senderID, newMoney, eco.data);

    const lines = [
      `╔══════════════════════╗`,
      `║  🎰  S L O T S       ║`,
      `╚══════════════════════╝`,
      `👤 ${name}  ·  Bet: 💵 ${fmt(bet)}`,
      `────────────────────────`,
      `┌─────────────────────┐`,
      `│   ${s1}  │  ${s2}  │  ${s3}   │`,
      `└─────────────────────┘`,
      `────────────────────────`,
    ];
    if (won) {
      lines.push(`🎉 ${mult}x WIN! +💵 ${fmt(Math.floor(bet * mult))}`);
    } else {
      lines.push(`😢 Better luck next time! -💵 ${fmt(bet)}`);
    }
    lines.push(`👛 Balance: 💵 ${fmt(newMoney)}`);
    if (mult >= 10) lines.push(`\n🏆 MEGA JACKPOT! 🎉🎊🥳`);

    return api.sendMessage(lines.join("\n"), threadID, messageID);
  }
};
