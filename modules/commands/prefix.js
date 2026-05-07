/**
 * !prefix — Show bot prefix with a beautiful AI-generated image
 * Sends a Pollinations AI image: dark theme + AI robot + prefix info
 */

const axios = require('axios');
const fs    = require('fs-extra');
const path  = require('path');
const bold  = require('../../utils/bold');

const TEMP_DIR = path.join(process.cwd(), 'utils/data/prefix_temp');
fs.ensureDirSync(TEMP_DIR);

const cleanup = (fp) => setTimeout(() => fs.remove(fp).catch(() => {}), 300000);

// ── Generate prefix card image via Pollinations ───────────────────────────────
async function generatePrefixImage(prefix, botName) {
  const prompts = [
    `futuristic AI robot holding a glowing neon sign showing the symbol "${prefix}", ` +
    `dark deep space background with stars and purple nebula, holographic HUD elements, ` +
    `cyberpunk style, dramatic blue and purple neon lighting, ultra detailed, 4K, ` +
    `bot name "${botName}" in glowing text at the bottom, sci-fi masterpiece`,

    `sleek android robot with glowing eyes standing next to a giant holographic display ` +
    `showing "${prefix}" in neon light, dark futuristic cityscape background, ` +
    `electric blue and cyan glow, cinematic lighting, ultra HD, ` +
    `"${botName}" watermark in stylized font, digital art`,

    `cute friendly AI robot waving with a glowing badge showing "${prefix}", ` +
    `dark gradient background from deep navy to black, sparkles and light particles, ` +
    `neon accents in purple gold and cyan, logo-style composition, ` +
    `"${botName}" in bold glowing letters, professional digital illustration 4K`,
  ];

  const prompt = encodeURIComponent(prompts[Math.floor(Math.random() * prompts.length)]);
  const seed   = Math.floor(Math.random() * 999999);
  const url    = `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1080&nologo=true&model=flux&seed=${seed}`;

  const fp = path.join(TEMP_DIR, `prefix_${Date.now()}.jpg`);
  const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 90000 });
  if (!data || data.byteLength < 2000) throw new Error('Image too small');
  fs.writeFileSync(fp, Buffer.from(data));
  return fp;
}

// ── Module config ─────────────────────────────────────────────────────────────
module.exports.config = {
  name:            'prefix',
  version:         '3.0.0',
  hasPermssion:    0,
  credits:         'TEAM STARTCOPE BETA',
  description:     'Show bot prefix — sends a beautiful AI-generated image with the prefix info',
  commandCategory: 'System',
  usages:          '[]',
  cooldowns:       10,
};

// ── handleEvent — triggered when someone types "prefix" as a message ──────────
module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, messageID, body } = event;
  if (!body) return;

  const { PREFIX } = global.config;
  const threadSetting = global.data.threadData.get(threadID) || {};
  const prefix  = threadSetting.PREFIX || PREFIX;
  const botName = global.config?.BOTNAME || 'Mirai Bot V3';
  const lowerBody = body.toLowerCase().trim();

  const triggers = ['prefix', 'what is the prefix', 'forgot prefix', 'how to use', 'ano ang prefix', 'anong prefix'];
  if (!triggers.includes(lowerBody)) return;

  // Send a "generating..." reaction first
  api.setMessageReaction('🤖', messageID, () => {}, true);

  const textBody =
    `╔══════════════════════════╗\n` +
    `║  🤖 ${bold('PREFIX INFO')}           ║\n` +
    `╚══════════════════════════╝\n\n` +
    `🔑 ${bold('Group Prefix:')}  ${prefix}\n` +
    `⚙️ ${bold('System Prefix:')} ${PREFIX}\n` +
    `🤖 ${bold('Bot:')}           ${botName}\n\n` +
    `💡 ${bold('Halimbawa ng paggamit:')}\n` +
    `   ${prefix}help — listahan ng commands\n` +
    `   ${prefix}news latest — pinakabagong balita\n` +
    `   ${prefix}weather Naga City — panahon\n\n` +
    `🏷️ ${bold('TEAM STARTCOPE BETA')} 🇵🇭`;

  try {
    // Generate AI image in background while sending text first
    const [imgFp] = await Promise.allSettled([
      generatePrefixImage(prefix, botName),
    ]);

    api.setMessageReaction('✅', messageID, () => {}, true);

    if (imgFp.status === 'fulfilled' && imgFp.value) {
      api.sendMessage(
        { body: textBody, attachment: fs.createReadStream(imgFp.value) },
        threadID,
        () => cleanup(imgFp.value)
      );
    } else {
      api.sendMessage(textBody, threadID, messageID);
    }
  } catch (e) {
    api.setMessageReaction('✅', messageID, () => {}, true);
    api.sendMessage(textBody, threadID, messageID);
  }
};

// ── run — triggered by !prefix command ───────────────────────────────────────
module.exports.run = async function ({ api, event }) {
  const { threadID, messageID } = event;
  const { PREFIX } = global.config;
  const threadSetting = global.data.threadData.get(threadID) || {};
  const prefix  = threadSetting.PREFIX || PREFIX;
  const botName = global.config?.BOTNAME || 'Mirai Bot V3';

  api.setMessageReaction('🤖', messageID, () => {}, true);
  api.sendMessage(`⏳ Gumagawa ng prefix card... sandali lang!`, threadID);

  const textBody =
    `╔══════════════════════════╗\n` +
    `║  🤖 ${bold('PREFIX INFO')}           ║\n` +
    `╚══════════════════════════╝\n\n` +
    `🔑 ${bold('Group Prefix:')}  ${prefix}\n` +
    `⚙️ ${bold('System Prefix:')} ${PREFIX}\n` +
    `🤖 ${bold('Bot:')}           ${botName}\n\n` +
    `💡 ${bold('Halimbawa ng paggamit:')}\n` +
    `   ${prefix}help — listahan ng commands\n` +
    `   ${prefix}news latest — pinakabagong balita\n` +
    `   ${prefix}weather Naga City — panahon\n\n` +
    `🏷️ ${bold('TEAM STARTCOPE BETA')} 🇵🇭`;

  try {
    const imgFp = await generatePrefixImage(prefix, botName);
    api.setMessageReaction('✅', messageID, () => {}, true);
    api.sendMessage(
      { body: textBody, attachment: fs.createReadStream(imgFp) },
      threadID,
      () => cleanup(imgFp)
    );
  } catch (e) {
    api.setMessageReaction('✅', messageID, () => {}, true);
    api.sendMessage(textBody, threadID, messageID);
  }
};
