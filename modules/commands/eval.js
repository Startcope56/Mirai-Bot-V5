const bold = require("../../utils/bold");

module.exports = {
  config: {
    name: "eval",
    aliases: ["exec", "run"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 0,
    hasPermssion: 3,
    description: "Owner: Execute JavaScript code live",
    commandCategory: "admin",
    usages: "<code>"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const code = args.join(" ");
    if (!code) return api.sendMessage(`❌ Provide code to execute.`, threadID, messageID);
    const start = Date.now();
    try {
      let result = eval(code);
      if (result instanceof Promise) result = await result;
      const out = typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);
      return api.sendMessage(
        `✅ EVAL (${Date.now() - start}ms)\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        out.slice(0, 1800),
        threadID, messageID
      );
    } catch (e) {
      return api.sendMessage(
        `❌ ERROR (${Date.now() - start}ms)\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        e.message,
        threadID, messageID
      );
    }
  }
};
