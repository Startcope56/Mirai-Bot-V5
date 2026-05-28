const { getEco, saveEco, fmt, ITEMS, hasItem } = require("../../utils/economy");

module.exports = {
  config: {
    name: "shop",
    aliases: ["store", "buy"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 3,
    hasPermssion: 0,
    description: "View and buy items from the Power Inc shop",
    commandCategory: "economy",
    usages: "[buy <item>]"
  },
  run: async ({ api, event, args, Currencies, Users }) => {
    const { senderID, threadID, messageID } = event;
    const sub = (args[0] || "").toLowerCase();

    if (!sub || sub === "list" || sub === "view") {
      const eco = await getEco(Currencies, senderID);
      const lines = [
        `╔══════════════════════╗`,
        `║  🛒  P O W E R   SHOP ║`,
        `╚══════════════════════╝`,
        `👛 Your Wallet: 💵 ${fmt(eco.money)}`,
        `────────────────────────`,
      ];
      ITEMS.forEach((item, i) => {
        const owned = hasItem(eco, item.id);
        lines.push(`${i + 1}. ${item.name}${owned ? " ✅" : ""}`);
        lines.push(`   💵 ${fmt(item.price)}  ·  ${item.desc}`);
      });
      lines.push(`────────────────────────`);
      lines.push(`💡 !shop buy <name or number>`);
      lines.push(`E.g. !shop buy pickaxe`);
      return api.sendMessage(lines.join("\n"), threadID, messageID);
    }

    if (sub === "buy") {
      const itemKey = args.slice(1).join(" ").toLowerCase();
      const item = ITEMS.find(i =>
        i.id === itemKey || i.name.toLowerCase().includes(itemKey) ||
        String(ITEMS.indexOf(i) + 1) === itemKey
      );
      if (!item) return api.sendMessage(`❌ Item not found! Use !shop to see the list.`, threadID, messageID);

      const eco = await getEco(Currencies, senderID);
      if (hasItem(eco, item.id)) return api.sendMessage(`✅ You already own ${item.name}!`, threadID, messageID);
      if (eco.money < item.price)
        return api.sendMessage(`❌ Not enough coins!\n💵 Need: ${fmt(item.price)}\n👛 Have: ${fmt(eco.money)}`, threadID, messageID);

      eco.data.inventory.push(item.id);
      await saveEco(Currencies, senderID, eco.money - item.price, eco.data);
      let name = "User"; try { const u = await Users.getData(senderID); name = u?.name || name; } catch {}

      return api.sendMessage(
        `╔═══════════════════╗\n║  🛒  PURCHASED!   ║\n╚═══════════════════╝\n` +
        `👤 ${name}\n✅ Bought: ${item.name}\n📖 ${item.desc}\n` +
        `───────────────────\n💸 Paid: 💵 ${fmt(item.price)}\n👛 Wallet: 💵 ${fmt(eco.money - item.price)}`,
        threadID, messageID
      );
    }

    return api.sendMessage(`❓ Usage: !shop (view) | !shop buy <item>`, threadID, messageID);
  }
};
