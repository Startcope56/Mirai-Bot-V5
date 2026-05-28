const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const bold = require("../../utils/bold");

module.exports = {
  config: {
    name: "prefix",
    aliases: ["px"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 10,
    hasPermssion: 0,
    description: "Show the bot prefix with a beautiful AI image",
    commandCategory: "utility",
    usages: ""
  },
  run: async ({ api, event }) => {
    const { threadID, messageID } = event;
    const PREFIX = global.config.PREFIX || "!";
    const BOTNAME = global.config.BOTNAME || "Mirai-V6";
    const prompt = encodeURIComponent(
      `futuristic AI robot holding a glowing symbol "${PREFIX}", cyberpunk neon lights, dark background, dramatic lighting, ultra HD, 4K, Power Inc branding`
    );
    const imgUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1080&model=flux&seed=${Date.now()}`;

    try {
      const r = await axios.get(imgUrl, { responseType: "arraybuffer", timeout: 90000 });
      const tmp = path.join(os.tmpdir(), `prefix_${Date.now()}.jpg`);
      fs.writeFileSync(tmp, Buffer.from(r.data));
      api.sendMessage({
        body: `╔══════════════════╗\n║  🤖  ${bold(BOTNAME)}  ║\n╚══════════════════╝\n` +
              `📌 Prefix: ${bold(PREFIX)}\n` +
              `──────────────────\n` +
              `Type ${PREFIX}help to see all commands!\n` +
              `👑 Made by Power Inc`,
        attachment: fs.createReadStream(tmp)
      }, threadID, () => { try { fs.unlinkSync(tmp); } catch {} }, messageID);
    } catch {
      api.sendMessage(
        `╔══════════════════╗\n║  🤖  ${bold(BOTNAME)}  ║\n╚══════════════════╝\n📌 Prefix: ${bold(PREFIX)}\n──────────────────\n💡 Type ${PREFIX}help for all commands!`,
        threadID, messageID
      );
    }
  }
};
