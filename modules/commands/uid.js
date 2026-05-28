module.exports = {
  config: {
    name: "uid",
    aliases: ["id", "getid", "myid"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 3,
    hasPermssion: 0,
    description: "Get your Facebook user ID or a mentioned user's ID",
    commandCategory: "utility",
    usages: "[@user]"
  },
  run: async ({ api, event, Users }) => {
    const { senderID, threadID, messageID, mentions, isGroup } = event;
    const ids = Object.keys(mentions || {});
    if (!ids.length) {
      let name = "User";
      try { const u = await Users.getData(senderID); name = u?.name || name; } catch {}
      return api.sendMessage(
        `╔══════════════════╗\n║  🆔  USER ID     ║\n╚══════════════════╝\n` +
        `👤 ${name}\n🆔 ${senderID}`,
        threadID, messageID
      );
    }
    const results = await Promise.all(ids.map(async id => {
      let name = "Unknown"; try { const u = await Users.getData(id); name = u?.name || name; } catch {}
      return `👤 ${name}\n🆔 ${id}`;
    }));
    api.sendMessage(
      `╔══════════════════╗\n║  🆔  USER IDs    ║\n╚══════════════════╝\n` +
      results.join("\n───────────────────\n"),
      threadID, messageID
    );
  }
};
