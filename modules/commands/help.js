module.exports = {
  config: {
    name: "help",
    aliases: ["h", "cmds", "commands", "menu"],
    version: "1.0.0",
    author: "Power Inc",
    cooldowns: 5,
    hasPermssion: 0,
    description: "Show all available commands",
    commandCategory: "utility",
    usages: "[command name]"
  },
  run: ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const { PREFIX } = global.config;
    const cmds = global.client.commands;

    if (args[0]) {
      const name = args[0].toLowerCase();
      const cmd = cmds.get(name);
      if (!cmd) return api.sendMessage(`❌ Command "${name}" not found.`, threadID, messageID);
      const c = cmd.config;
      return api.sendMessage(
        `╔════════════════════╗\n║  📖  COMMAND INFO  ║\n╚════════════════════╝\n` +
        `📌 Name:     ${PREFIX}${c.name}\n` +
        `🏷️  Category: ${c.commandCategory || "general"}\n` +
        (c.aliases?.length ? `🔗 Aliases:  ${c.aliases.map(a => PREFIX + a).join(", ")}\n` : ``) +
        `📝 About:    ${c.description || c.shortDescription || "—"}\n` +
        `🔧 Usage:    ${PREFIX}${c.name} ${c.usages || ""}\n` +
        `⏱️  Cooldown: ${c.cooldowns || 1}s`,
        threadID, messageID
      );
    }

    const cats = {};
    for (const [, cmd] of cmds) {
      const cat = (cmd.config.commandCategory || "other").toLowerCase();
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(PREFIX + cmd.config.name);
    }

    const catEmojis = {
      economy:"💰", games:"🎮", ai:"🤖", utility:"🔧",
      admin:"👑", other:"📦", nsfw:"🔞"
    };

    const lines = [
      `╔══════════════════════╗`,
      `║  🤖  POWER INC BOT   ║`,
      `║  Command Menu        ║`,
      `╚══════════════════════╝`,
      `Prefix: ${PREFIX}  ·  ${cmds.size} commands`,
      `──────────────────────`,
    ];
    for (const [cat, list] of Object.entries(cats).sort()) {
      const e = catEmojis[cat] || "📦";
      lines.push(`${e} ${cat.toUpperCase()}`);
      lines.push(`  ${list.join("  ")}`);
    }
    lines.push(`──────────────────────`);
    lines.push(`💡 ${PREFIX}help <command> — for details`);
    lines.push(`👑 Made by Power Inc`);
    lines.push(`🔗 fb.com/profile.php?id=61589941790784`);

    return api.sendMessage(lines.join("\n"), threadID, messageID);
  }
};
