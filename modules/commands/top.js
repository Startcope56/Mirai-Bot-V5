const { getEco, fmt } = require("../../utils/economy");

module.exports = {
  config: {
    name: "top",
    aliases: ["richest", "leaderboard", "lb"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 10,
    hasPermssion: 0,
    description: "View the richest users leaderboard",
    commandCategory: "economy",
    usages: "[wallet|bank|total]"
  },
  run: async ({ api, event, args, Currencies, Users }) => {
    const { threadID, messageID } = event;
    const mode = (args[0] || "total").toLowerCase();

    const all = await Currencies.getAll();
    if (!all || all.length === 0)
      return api.sendMessage(`📊 No data yet! Use !daily or !work to earn coins.`, threadID, messageID);

    const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

    const entries = await Promise.all(all.map(async row => {
      let name = "Unknown";
      try { const u = await Users.getData(row.userID); name = u?.name || name; } catch {}
      const bank = (row.data && typeof row.data === "object") ? (row.data.bank || 0) : 0;
      const wallet = row.money || 0;
      let value;
      if (mode === "wallet") value = wallet;
      else if (mode === "bank") value = bank;
      else value = wallet + bank;
      return { name, wallet, bank, total: wallet + bank, value };
    }));

    entries.sort((a, b) => b.value - a.value);
    const top = entries.slice(0, 10);

    const modeLabel = mode === "wallet" ? "👛 Wallet" : mode === "bank" ? "🏦 Bank" : "💎 Total";
    const lines = [
      `╔═══════════════════════╗`,
      `║  🏆  LEADERBOARD      ║`,
      `║  ${modeLabel.padEnd(19)}║`,
      `╚═══════════════════════╝`,
    ];
    top.forEach((e, i) => {
      const medal = MEDALS[i] || `${i + 1}.`;
      lines.push(`${medal} ${e.name.slice(0, 18)}`);
      lines.push(`    💵 ${fmt(e.value)}`);
    });
    lines.push(`───────────────────────`);
    lines.push(`💡 !top wallet | !top bank | !top total`);

    return api.sendMessage(lines.join("\n"), threadID, messageID);
  }
};
