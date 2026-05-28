const { getEco, saveEco, fmt, rand } = require("../../utils/economy");

const TICKET_PRICE = 200;
const POOL_KEY = "lotteryPool";
const DRAW_INTERVAL = 60 * 60 * 1000; // 1 hour

function getPool() {
  if (!global.drianLottery) global.drianLottery = { pool: 0, tickets: {}, lastDraw: 0 };
  return global.drianLottery;
}

module.exports = {
  config: {
    name: "lottery",
    aliases: ["lotto", "ticket"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 5,
    hasPermssion: 0,
    description: "Buy lottery tickets — jackpot draws every hour!",
    commandCategory: "games",
    usages: "[buy <qty>] | [status]"
  },
  run: async ({ api, event, args, Currencies, Users }) => {
    const { senderID, threadID, messageID } = event;
    const sub = (args[0] || "status").toLowerCase();
    const state = getPool();

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (sub === "status" || sub === "info") {
      const myTickets = state.tickets[senderID] || 0;
      const total = Object.values(state.tickets).reduce((a, b) => a + b, 0);
      const timeLeft = Math.max(0, DRAW_INTERVAL - (Date.now() - state.lastDraw));
      const m = Math.floor(timeLeft / 60000), s = Math.floor((timeLeft % 60000) / 1000);
      return api.sendMessage(
        `╔══════════════════════╗\n` +
        `║  🎟️  L O T T E R Y    ║\n` +
        `╚══════════════════════╝\n` +
        `💵 Jackpot:   ${fmt(state.pool)}\n` +
        `🎟️  Your tickets: ${myTickets}\n` +
        `👥 Total tickets: ${total}\n` +
        `⏰ Next draw: ${m}m ${s}s\n` +
        `──────────────────────\n` +
        `💡 !lottery buy <qty>  (💵${TICKET_PRICE} each)`,
        threadID, messageID
      );
    }

    // ── BUY ───────────────────────────────────────────────────────────────────
    if (sub === "buy") {
      const qty = Math.min(50, Math.max(1, parseInt(args[1]) || 1));
      const cost = qty * TICKET_PRICE;
      const eco = await getEco(Currencies, senderID);
      if (eco.money < cost) return api.sendMessage(`❌ Need 💵 ${fmt(cost)} for ${qty} ticket(s).\nYou have: 💵 ${fmt(eco.money)}`, threadID, messageID);

      state.pool += Math.floor(cost * 0.9);
      state.tickets[senderID] = (state.tickets[senderID] || 0) + qty;
      await saveEco(Currencies, senderID, eco.money - cost, eco.data);

      let name = "Player"; try { const u = await Users.getData(senderID); name = u?.name || name; } catch {}
      return api.sendMessage(
        `🎟️ LOTTERY TICKETS BOUGHT!\n──────────────────────\n` +
        `👤 ${name}\n🎟️ Bought: ${qty} ticket(s)\n💸 Paid: 💵 ${fmt(cost)}\n` +
        `🎯 Your total: ${state.tickets[senderID]} ticket(s)\n💰 Jackpot: 💵 ${fmt(state.pool)}`,
        threadID, messageID
      );
    }

    return api.sendMessage(`❓ Usage: !lottery status | !lottery buy <qty>`, threadID, messageID);
  }
};
