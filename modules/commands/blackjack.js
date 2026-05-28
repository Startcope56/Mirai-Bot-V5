const { getEco, saveEco, fmt, rand } = require("../../utils/economy");

const SUITS = ["♠️","♥️","♦️","♣️"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const VALS  = { A:11, "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:10,Q:10,K:10 };

function newDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ s, r, v: VALS[r] });
  return d.sort(() => Math.random() - 0.5);
}
function draw(deck) { return deck.pop(); }
function cardStr(c) { return `${c.r}${c.s}`; }
function handVal(hand) {
  let v = hand.reduce((a, c) => a + c.v, 0);
  let aces = hand.filter(c => c.r === "A").length;
  while (v > 21 && aces--) v -= 10;
  return v;
}
function handStr(hand) { return hand.map(cardStr).join(" "); }

// Active BJ games: Map<senderID, {deck, player, dealer, bet, ecoSnapshot}>
const games = new Map();

module.exports = {
  config: {
    name: "blackjack",
    aliases: ["bj", "21"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 3,
    hasPermssion: 0,
    description: "Play Blackjack vs the dealer — type !bj hit or !bj stand",
    commandCategory: "games",
    usages: "<bet> | hit | stand | double"
  },
  run: async ({ api, event, args, Currencies, Users }) => {
    const { senderID, threadID, messageID } = event;
    const sub = (args[0] || "").toLowerCase();

    // ── HIT / STAND / DOUBLE ──────────────────────────────────────────────────
    if (["hit","h","stand","s","double","d"].includes(sub)) {
      if (!games.has(senderID))
        return api.sendMessage(`🃏 No active game! Start with: !bj <bet>`, threadID, messageID);
      const g = games.get(senderID);

      if (sub === "hit" || sub === "h") {
        g.player.push(draw(g.deck));
        const pv = handVal(g.player);
        if (pv > 21) {
          games.delete(senderID);
          const eco = await getEco(Currencies, senderID);
          await saveEco(Currencies, senderID, eco.money - g.bet, eco.data);
          return api.sendMessage(
            `💥 BUST! Your hand: ${handStr(g.player)} = ${pv}\n💸 Lost: 💵 ${fmt(g.bet)}\n👛 Balance: 💵 ${fmt(eco.money - g.bet)}`,
            threadID, messageID
          );
        }
        return api.sendMessage(
          `🃏 BLACKJACK — HIT\n` +
          `────────────────────\n` +
          `🤵 Dealer: ${cardStr(g.dealer[0])} 🂠\n` +
          `👤 You:    ${handStr(g.player)} = ${pv}\n` +
          `────────────────────\n` +
          `Reply: !bj hit | !bj stand`,
          threadID, messageID
        );
      }

      if (sub === "stand" || sub === "s" || sub === "double" || sub === "d") {
        let doubled = false;
        if (sub === "double" || sub === "d") {
          const eco2 = await getEco(Currencies, senderID);
          if (eco2.money >= g.bet * 2) { g.bet *= 2; doubled = true; }
          g.player.push(draw(g.deck));
        }
        // Dealer plays
        while (handVal(g.dealer) < 17) g.dealer.push(draw(g.deck));
        const pv = handVal(g.player);
        const dv = handVal(g.dealer);
        games.delete(senderID);
        const eco = await getEco(Currencies, senderID);
        let result, net;
        if (pv > 21)                  { result = "💥 BUST! You lose.";   net = -g.bet; }
        else if (dv > 21)             { result = "🎉 Dealer busts! WIN!"; net = g.bet; }
        else if (pv > dv)             { result = "🎉 You WIN!";           net = g.bet; }
        else if (pv === dv)           { result = "🤝 PUSH (tie)";         net = 0; }
        else                          { result = "😢 Dealer wins.";        net = -g.bet; }
        await saveEco(Currencies, senderID, eco.money + net, eco.data);
        return api.sendMessage(
          `╔══════════════════╗\n║  🃏  BLACKJACK   ║\n╚══════════════════╝\n` +
          `🤵 Dealer: ${handStr(g.dealer)} = ${dv}\n` +
          `👤 You:    ${handStr(g.player)} = ${pv}\n` +
          `────────────────────\n` +
          `${result}\n` +
          (net > 0 ? `💵 +${fmt(net)}\n` : net < 0 ? `💸 -${fmt(-net)}\n` : ``) +
          (doubled ? `✨ Doubled down!\n` : ``) +
          `👛 Balance: 💵 ${fmt(eco.money + net)}`,
          threadID, messageID
        );
      }
    }

    // ── NEW GAME ───────────────────────────────────────────────────────────────
    const bet = parseInt(args[0]);
    if (!bet || bet < 10) return api.sendMessage(`🃏 !bj <bet> (min 10)\nE.g. !bj 200`, threadID, messageID);
    const eco = await getEco(Currencies, senderID);
    if (eco.money < bet) return api.sendMessage(`❌ Not enough coins! You have 💵 ${fmt(eco.money)}`, threadID, messageID);
    if (games.has(senderID)) return api.sendMessage(`⚠️ You have an active game! Type !bj hit or !bj stand`, threadID, messageID);

    const deck = newDeck();
    const player = [draw(deck), draw(deck)];
    const dealer = [draw(deck), draw(deck)];
    games.set(senderID, { deck, player, dealer, bet });

    const pv = handVal(player);
    let name = "Player"; try { const u = await Users.getData(senderID); name = u?.name || name; } catch {}

    // Natural blackjack?
    if (pv === 21) {
      games.delete(senderID);
      const win = Math.floor(bet * 1.5);
      await saveEco(Currencies, senderID, eco.money + win, eco.data);
      return api.sendMessage(
        `╔══════════════════╗\n║  🃏 BLACKJACK!   ║\n╚══════════════════╝\n` +
        `👤 ${name}\n🃏 Natural 21! ${handStr(player)}\n` +
        `🎉 BLACKJACK! +💵 ${fmt(win)}\n👛 Balance: 💵 ${fmt(eco.money + win)}`,
        threadID, messageID
      );
    }

    return api.sendMessage(
      `╔══════════════════╗\n║  🃏  BLACKJACK   ║\n╚══════════════════╝\n` +
      `👤 ${name}  ·  Bet: 💵 ${fmt(bet)}\n` +
      `────────────────────\n` +
      `🤵 Dealer: ${cardStr(dealer[0])} 🂠\n` +
      `👤 You:    ${handStr(player)} = ${pv}\n` +
      `────────────────────\n` +
      `Reply: !bj hit | !bj stand | !bj double`,
      threadID, messageID
    );
  }
};
