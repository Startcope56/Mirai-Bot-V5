'use strict';
const axios = require('axios');
const bold  = require('../../utils/bold');

module.exports.config = {
  name:            'help',
  version:         '7.0.0',
  hasPermssion:    0,
  credits:         'TEAM STARTCOPE BETA',
  description:     'MIRAI V6 — Command list, bot info, and command details',
  commandCategory: 'General',
  usages:          '[command name | all | admin | categories]',
  cooldowns:       5,
  images:          [],
};

// ── Fetch ibb.co direct image URL ─────────────────────────────────────────────
async function getIbbDirect(pageUrl) {
  try {
    const { data: html } = await axios.get(pageUrl, { timeout: 6000 });
    const match = html.match(/property="og:image"\s+content="([^"]+)"/);
    if (match?.[1]) return match[1];
  } catch {}
  return null;
}

async function getBannerAttachment() {
  try {
    const direct = await getIbbDirect('https://ibb.co/4gZpB7tw');
    if (direct) {
      const stream = (await axios.get(direct, { responseType: 'stream', timeout: 10000 })).data;
      return stream;
    }
  } catch {}
  return null;
}

// ── Permission label ──────────────────────────────────────────────────────────
function permLabel(p) {
  return p === 0 ? '👤 Member'
       : p === 1 ? '⭐ Group Admin'
       : p === 2 ? '🌟 Bot Admin'
       : '👑 Owner';
}

// ── Category icon map ─────────────────────────────────────────────────────────
const CAT_ICONS = {
  general:       '🌐',
  admin:         '🔒',
  media:         '🎵',
  music:         '🎶',
  ai:            '🤖',
  utility:       '⚙️',
  fun:           '🎉',
  information:   'ℹ️',
  economy:       '💰',
  owner:         '👑',
  weather:       '🌤️',
  news:          '📰',
  social:        '📱',
  tools:         '🛠️',
  religion:      '✝️',
  auto:          '⚡',
  default:       '📂',
};
function catIcon(cat = '') { return CAT_ICONS[cat.toLowerCase()] || CAT_ICONS.default; }

// ── Uptime formatter ──────────────────────────────────────────────────────────
function fmtUptime(s) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Build category map ────────────────────────────────────────────────────────
function buildCategories(cmds) {
  const map = new Map();
  for (const cmd of cmds.values()) {
    const cat = (cmd.config.commandCategory || 'General').toLowerCase();
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(cmd.config.name);
  }
  return map;
}

// ── Divider helpers ───────────────────────────────────────────────────────────
const LINE  = '━'.repeat(32);
const DLINE = '═'.repeat(32);
const SLINE = '·'.repeat(32);

// ── Main run ──────────────────────────────────────────────────────────────────
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const cmds    = global.client.commands;
  const TIDdata = global.data.threadData.get(threadID) || {};
  const prefix  = TIDdata.PREFIX || global.config.PREFIX || '!';
  const botName = global.config.BOTNAME || 'Mirai-V6';
  const version = global.config.version  || '6.0.0';
  const sub     = (args[0] || '').toLowerCase();

  const banner = await getBannerAttachment();

  // ── !help all — full list ──────────────────────────────────────────────────
  if (sub === 'all') {
    let i = 0, msg = '';
    for (const cmd of cmds.values()) {
      i++;
      msg +=
        `┌─ ${bold(`#${i} · ${cmd.config.name.toUpperCase()}`)}\n` +
        `│  📝 ${cmd.config.description}\n` +
        `│  🏷️  ${cmd.config.commandCategory || 'General'} · ⏳ ${cmd.config.cooldowns}s\n` +
        `└──────────────────\n\n`;
    }
    return api.sendMessage({
      body:
        `╔${DLINE}╗\n` +
        `║  📚 ${bold('LAHAT NG COMMANDS')}                ║\n` +
        `║  🤖 ${bold(botName)} v${version}                ║\n` +
        `╚${DLINE}╝\n\n` +
        msg +
        `${LINE}\n` +
        `📊 ${bold('Kabuuan:')} ${cmds.size} commands\n` +
        `🏷️  ${bold('TEAM STARTCOPE BETA')}`,
      attachment: banner ? [banner] : undefined,
    }, threadID, messageID);
  }

  // ── !help categories ──────────────────────────────────────────────────────
  if (sub === 'categories') {
    const catMap = buildCategories(cmds);
    let msg = '';
    for (const [cat, names] of [...catMap.entries()].sort()) {
      msg +=
        `\n${catIcon(cat)} ${bold(cat.toUpperCase())}  (${names.length})\n` +
        `${SLINE}\n` +
        names.map(n => `  ▸ ${n}`).join('\n') + '\n';
    }
    return api.sendMessage({
      body:
        `╔${DLINE}╗\n` +
        `║  🗂️  ${bold('MGA KATEGORYA NG COMMANDS')}       ║\n` +
        `╚${DLINE}╝\n` +
        msg + '\n' +
        `${LINE}\n` +
        `📊 ${bold('Kabuuan:')} ${cmds.size} commands · ${catMap.size} kategorya`,
      attachment: banner ? [banner] : undefined,
    }, threadID, messageID);
  }

  // ── !help admin — admin-only commands ─────────────────────────────────────
  if (sub === 'admin') {
    const adminCmds = [...cmds.values()].filter(c => c.config.hasPermssion >= 2);
    let msg = '';
    adminCmds.forEach((c, i) => {
      msg +=
        `${i + 1}. ${bold(c.config.name.toUpperCase())}\n` +
        `   📝 ${c.config.description}\n` +
        `   📎 ${prefix}${c.config.usages}\n` +
        `   ${SLINE}\n\n`;
    });
    return api.sendMessage({
      body:
        `╔${DLINE}╗\n` +
        `║  🔒 ${bold('ADMIN COMMANDS ONLY')}              ║\n` +
        `╚${DLINE}╝\n\n` +
        msg +
        `📊 ${bold('Kabuuan:')} ${adminCmds.length} admin commands`,
      attachment: banner ? [banner] : undefined,
    }, threadID, messageID);
  }

  // ── !help [command] — single command detail ────────────────────────────────
  if (sub && sub !== 'help') {
    if (!cmds.has(sub)) {
      try {
        const ss    = require('string-similarity');
        const names = [...cmds.keys()];
        const best  = ss.findBestMatch(sub, names).bestMatch.target;
        return api.sendMessage(
          `❌ ${bold('Hindi nahanap:')} "${sub}"\n\n` +
          `💡 ${bold('Ibig sabihin ba:')} "${best}"?\n` +
          `   ➜ Gamitin: ${prefix}help ${best}`,
          threadID, messageID
        );
      } catch {
        return api.sendMessage(`❌ ${bold('Hindi nahanap:')} "${sub}"`, threadID, messageID);
      }
    }

    const cmd = cmds.get(sub).config;
    const imgs = cmd.images || [];
    let attachments = banner ? [banner] : [];
    for (const img of imgs) {
      try {
        const stream = (await axios.get(img, { responseType: 'stream', timeout: 10000 })).data;
        attachments.push(stream);
      } catch {}
    }

    return api.sendMessage({
      body:
        `╔${DLINE}╗\n` +
        `║  📖 ${bold('COMMAND INFO')}                     ║\n` +
        `║  🤖 MIRAI V6 · STARTCOPE BETA        ║\n` +
        `╚${DLINE}╝\n\n` +
        `  📌 ${bold('Pangalan')}      ${cmd.name}\n` +
        `  👤 ${bold('Gawa ni')}       ${cmd.credits}\n` +
        `  🌾 ${bold('Bersyon')}       ${cmd.version}\n` +
        `  🔐 ${bold('Permission')}    ${permLabel(cmd.hasPermssion)}\n` +
        `  🏷️  ${bold('Kategorya')}    ${cmd.commandCategory}\n` +
        `  ⏳ ${bold('Cooldown')}      ${cmd.cooldowns}s\n\n` +
        `${LINE}\n` +
        `  📝 ${bold('Paglalarawan')}\n` +
        `  ${cmd.description}\n\n` +
        `  📎 ${bold('Paggamit')}\n` +
        `  ${prefix}${cmd.usages || cmd.name}\n` +
        `${LINE}\n` +
        `🏷️  ${bold('TEAM STARTCOPE BETA')} · MIRAI V6`,
      attachment: attachments.length ? attachments : undefined,
    }, threadID, messageID);
  }

  // ── !help — main menu ─────────────────────────────────────────────────────
  const catMap   = buildCategories(cmds);
  const uptimeSec = Math.round(process.uptime());
  const mem      = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const nodeVer  = process.version;

  let catSection = '';
  for (const [cat, names] of [...catMap.entries()].sort()) {
    catSection +=
      `\n  ${catIcon(cat)} ${bold(cat.toUpperCase())}  ·  ${names.length} commands\n` +
      `  ${names.slice(0, 8).join('  •  ')}${names.length > 8 ? `  • +${names.length - 8} more` : ''}\n` +
      `  ${'─'.repeat(28)}\n`;
  }

  return api.sendMessage({
    body:
      `╔${DLINE}╗\n` +
      `║                                ║\n` +
      `║   🤖  ${bold('MIRAI BOT V6')}              ║\n` +
      `║   ⚡  TEAM STARTCOPE BETA      ║\n` +
      `║   🛡️   30-Layer Anti-Detect    ║\n` +
      `║                                ║\n` +
      `╚${DLINE}╝\n\n` +
      `${LINE}\n` +
      `  📊 ${bold('Loaded Commands')}    ${cmds.size}\n` +
      `  ⏱️  ${bold('Uptime')}            ${fmtUptime(uptimeSec)}\n` +
      `  💾 ${bold('Memory')}            ${mem} MB\n` +
      `  🟢 ${bold('Node.js')}           ${nodeVer}\n` +
      `  🔧 ${bold('Prefix')}            ${prefix}\n` +
      `${LINE}\n\n` +
      `╭${'─'.repeat(30)}╮\n` +
      `│   📂  ${bold('MGA KATEGORYA')}             │\n` +
      `╰${'─'.repeat(30)}╯\n` +
      catSection + '\n' +
      `${LINE}\n\n` +
      `  💡 ${prefix}help ${bold('[command]')}   — detalye ng command\n` +
      `  💡 ${prefix}help ${bold('all')}          — lahat ng commands\n` +
      `  💡 ${prefix}help ${bold('categories')}   — ayon sa kategorya\n` +
      `  💡 ${prefix}help ${bold('admin')}        — admin-only commands\n\n` +
      `${LINE}\n` +
      `  👑 ${bold('Admin')}     Manuelson Yasis\n` +
      `  🔗 ${bold('FB')}        facebook.com/manuelson.yasis\n` +
      `  🏷️  ${bold('Team')}     TEAM STARTCOPE BETA\n` +
      `${LINE}`,
    attachment: banner ? [banner] : undefined,
  }, threadID);
};
