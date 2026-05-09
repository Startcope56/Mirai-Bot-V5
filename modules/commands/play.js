const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const VERSION = '5.1.0';
const TEAM = 'TEAM STARTCOPE BETA';
const STATION_NAME = '📻 95.1 HOME RADIO NAGA';
// Primary: Home Radio Naga 95.1 live stream (hrnaga.radioca.st)
// Fallback: Home Radio Manila stream
const STREAM_URLS = [
  'http://hrnaga.radioca.st:9349/stream',
  'https://hrmanila.radioca.st/stream',
];
const TEMP_DIR = path.join(process.cwd(), 'utils/data/play_temp');
const CHUNK_SECONDS = 10800; // 3 hours per voice message chunk

fs.ensureDirSync(TEMP_DIR);

// Per-thread loop control
const activeLoops = new Map(); // threadID → { running: true/false }

async function captureChunk(outPath) {
  // Try each stream URL in order — primary (Naga) first, then fallback (Manila)
  for (let i = 0; i < STREAM_URLS.length; i++) {
    const url = STREAM_URLS[i];
    const isLast = i === STREAM_URLS.length - 1;
    const ok = await new Promise(res => {
      const cmd = [
        'ffmpeg -y',
        '-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 8',
        `-i "${url}"`,
        `-t ${CHUNK_SECONDS}`,
        '-vn -ar 44100 -ac 2 -b:a 64k',
        `-f mp3 "${outPath}"`
      ].join(' ');
      exec(cmd, { timeout: (CHUNK_SECONDS + 180) * 1000 }, (err) => res(!err));
    });
    if (ok) {
      const stat = await fs.stat(outPath).catch(() => ({ size: 0 }));
      if (stat.size > 5000) {
        console.log(`[Play] ✅ Streaming from ${i === 0 ? '95.1 HOME RADIO NAGA' : 'HOME RADIO MANILA (fallback)'}`);
        return;
      }
    }
    if (!isLast) {
      console.warn(`[Play] ⚠️ Stream ${url} failed — trying fallback...`);
      fs.remove(outPath).catch(() => {});
    } else {
      throw new Error('All streams unavailable — station may be offline');
    }
  }
}

async function streamLoop(api, threadID, ctrl) {
  let chunkIndex = 0;
  // Send a "now streaming" header card first
  api.sendMessage(
    `📻 *95.1 HOME RADIO NAGA — LIVE!*\n\n` +
    `🎵 Nagsisimula ang live stream...\n` +
    `📡 Source: hrnaga.radioca.st\n` +
    `⏱️ 3-hour chunks — awtomatikong magpapadala\n\n` +
    `❗ I-type *!stop* para ihinto ang stream\n` +
    `🏷️ TEAM STARTCOPE BETA`,
    threadID
  );
  while (ctrl.running) {
    const outPath = path.join(TEMP_DIR, `chunk_${threadID}_${chunkIndex++}.mp3`);
    try {
      await captureChunk(outPath);
      if (!ctrl.running) { fs.remove(outPath).catch(() => {}); break; }
      await new Promise((res, rej) => {
        api.sendMessage(
          {
            body: `📻 *95.1 HOME RADIO NAGA* — Chunk #${chunkIndex}\n🔴 LIVE · ${new Date().toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })} PH`,
            attachment: fs.createReadStream(outPath)
          },
          threadID,
          (err) => { fs.remove(outPath).catch(() => {}); err ? rej(err) : res(); }
        );
      });
    } catch (e) {
      fs.remove(outPath).catch(() => {});
      console.error(`[Play] chunk error thread ${threadID}:`, e.message?.slice(0, 120));
      if (!ctrl.running) break;
      api.sendMessage(`⚠️ Stream interrupted — reconnecting in 10s...\n📻 95.1 Home Radio Naga`, threadID);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  activeLoops.delete(threadID);
  console.log(`[Play] Stream stopped for thread ${threadID}`);
}

module.exports.config = {
  name: 'play',
  version: VERSION,
  hasPermssion: 0,
  credits: TEAM,
  description: '📻 95.1 HOME RADIO NAGA — live stream bilang voice message, walang putol (3-hour chunks)',
  commandCategory: 'Media',
  usages: '',
  cooldowns: 10
};

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID } = event;

  if (activeLoops.has(threadID)) {
    activeLoops.get(threadID).running = false;
    activeLoops.delete(threadID);
    return api.sendMessage(
      `🛑 *Stream stopped!*\n📻 95.1 Home Radio Naga\n\nI-type ulit *!play* para mag-stream muli.`,
      threadID, messageID
    );
  }

  api.setMessageReaction('📻', messageID, () => {}, true);
  api.sendMessage(
    `╔════════════════════════════╗\n` +
    `║  📻 95.1 HOME RADIO NAGA  ║\n` +
    `║  🔴 CONNECTING LIVE...    ║\n` +
    `╚════════════════════════════╝\n\n` +
    `🎙️ Source: hrnaga.radioca.st:9349\n` +
    `⏱️ Chunks: 3 hours bawat voice message\n` +
    `🔄 Auto-reconnect: ON\n\n` +
    `📩 Audio darating sa ilang segundo...\n` +
    `❗ I-type *!play* ulit para *IHINTO*\n` +
    `🏷️ ${TEAM}`,
    threadID
  );

  const ctrl = { running: true };
  activeLoops.set(threadID, ctrl);
  streamLoop(api, threadID, ctrl);
};

// Expose so !stop command can access
module.exports.activeLoops = activeLoops;
