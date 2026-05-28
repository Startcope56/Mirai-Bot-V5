module.exports = {
  config: {
    name: "ping",
    aliases: ["pong", "speed"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 3,
    hasPermssion: 0,
    description: "Check bot response time and status",
    commandCategory: "utility",
    usages: ""
  },
  run: ({ api, event }) => {
    const { threadID, messageID } = event;
    const start = Date.now();
    const mem   = process.memoryUsage();
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    api.sendMessage(
      `╔══════════════════╗\n` +
      `║  🏓  P I N G     ║\n` +
      `╚══════════════════╝\n` +
      `⚡ Ping: ${Date.now() - start}ms\n` +
      `⏱️  Uptime: ${h}h ${m}m ${s}s\n` +
      `💾 RAM: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB\n` +
      `📦 Node: ${process.version}\n` +
      `──────────────────\n` +
      `✅ Bot is online!\n` +
      `👑 Power Inc`,
      threadID, messageID
    );
  }
};
