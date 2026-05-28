const { getEco, ITEMS } = require("../../utils/economy");

module.exports = {
  config: {
    name: "inventory",
    aliases: ["inv", "bag", "items"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 5,
    hasPermssion: 0,
    description: "View your item inventory",
    commandCategory: "economy",
    usages: "[@user]"
  },
  run: async ({ api, event, Currencies, Users }) => {
    const { senderID, threadID, messageID, mentions } = event;
    const targetID = Object.keys(mentions || {})[0] || senderID;
    const eco = await getEco(Currencies, targetID);
    let name = "User"; try { const u = await Users.getData(targetID); name = u?.name || name; } catch {}
    const inv = eco.data.inventory || [];

    if (!inv.length) {
      return api.sendMessage(
        `🎒 INVENTORY — ${name}\n───────────────────\n📦 Empty inventory\n💡 Use !shop to buy items!`,
        threadID, messageID
      );
    }

    const lines = [
      `╔══════════════════════╗`,
      `║  🎒  I N V E N T O R Y ║`,
      `╚══════════════════════╝`,
      `👤 ${name}`,
      `──────────────────────`,
    ];
    inv.forEach(id => {
      const item = ITEMS.find(i => i.id === id);
      if (item) {
        lines.push(`${item.name}`);
        lines.push(`  📖 ${item.desc}`);
      }
    });
    lines.push(`──────────────────────`);
    lines.push(`${inv.length} item(s) owned`);
    return api.sendMessage(lines.join("\n"), threadID, messageID);
  }
};
