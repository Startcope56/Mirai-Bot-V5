/**
 * !autoyoutube v1.0.0 — Auto-searches YouTube music videos & posts MP4 to Facebook WALL
 * Every 10 minutes · FREE (yt-dlp, no API key) · Auto-comment "FOLLOW AND SHARE KA TROPA"
 * Artists: Mariah Carey, Taylor Swift, Adele, BTS, Dua Lipa, Bruno Mars, etc.
 */

const fs       = require('fs-extra');
const path     = require('path');
const { exec } = require('child_process');
const bold     = require('../../utils/bold');

const VERSION  = '1.0.0';
const TEAM     = 'TEAM STARTCOPE BETA';
const INTERVAL = 10 * 60 * 1000; // 10 minutes

const DATA_DIR   = path.join(process.cwd(), 'utils/data');
const STATE_FILE = path.join(DATA_DIR, 'autoyoutube_state.json');
const TEMP_DIR   = path.join(DATA_DIR, 'autoyoutube_temp');
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(TEMP_DIR);

// ── Music search queries — rotate through popular artists & OPM ───────────────
const MUSIC_QUERIES = [
  'Mariah Carey All I Want for Christmas Is You official video',
  'Mariah Carey We Belong Together official music video',
  'Taylor Swift Anti-Hero official music video',
  'Taylor Swift Shake It Off official video',
  'Taylor Swift Blank Space official music video',
  'Adele Hello official music video',
  'Adele Someone Like You official video',
  'Adele Rolling in the Deep official video',
  'Ed Sheeran Shape of You official video',
  'Ed Sheeran Perfect official music video',
  'Bruno Mars Just the Way You Are official video',
  'Bruno Mars Treasure official music video',
  'Bruno Mars Uptown Funk official music video',
  'Dua Lipa Levitating official video',
  'Dua Lipa New Rules official video',
  'Dua Lipa Dont Start Now official video',
  'BTS Dynamite official MV',
  'BTS Butter official MV',
  'BTS Boy With Luv official MV',
  'BLACKPINK Kill This Love MV',
  'BLACKPINK How You Like That MV',
  'BLACKPINK Pink Venom official MV',
  'Whitney Houston I Will Always Love You official video',
  'Whitney Houston Greatest Love of All official video',
  'Celine Dion My Heart Will Go On official video',
  'Michael Jackson Thriller official video',
  'Michael Jackson Billie Jean official video',
  'Queen Bohemian Rhapsody official video',
  'Coldplay Yellow official video',
  'Coldplay The Scientist official video',
  'Westlife My Love official video',
  'Westlife You Raise Me Up official video',
  'ABBA Dancing Queen official video',
  'Backstreet Boys I Want It That Way official video',
  // OPM
  'Daniel Padilla Nasa Iyo Na Ang Lahat official MV',
  'KZ Tandingan Say You Will Never Go official MV',
  'Moira Dela Torre Paubaya official MV',
  'Ben and Ben Leaves official MV',
  'IV of Spades Come Inside of My Heart official MV',
  'Arthur Nery Pano official MV',
  'December Avenue Kung Di Rin Lang Ikaw official MV',
  'Parokya ni Edgar Harana official MV',
  'Bamboo Noypi official MV',
  'Rivermaya Youll Be Safe Here official MV',
];

let queryIndex = 0;

// ── State ─────────────────────────────────────────────────────────────────────
function loadState()  { try { return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}; } catch { return {}; } }
function saveState(d) { try { fs.writeFileSync(STATE_FILE, JSON.stringify(d, null, 2)); } catch {} }

let state = { enabled: false, count: 0, lastPostedAt: null, errorCount: 0 };

function loadPersistedState() {
  const s = loadState();
  if (s.enabled !== undefined) state.enabled = s.enabled;
  if (s.count   !== undefined) state.count   = s.count;
  if (s.lastPostedAt !== undefined) state.lastPostedAt = s.lastPostedAt;
  if (s.errorCount   !== undefined) state.errorCount   = s.errorCount;
  if (s.queryIndex   !== undefined) queryIndex = s.queryIndex;
}
function persist() {
  saveState({ ...state, queryIndex });
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];

function runCmd(cmd, timeoutMs = 120000) {
  return new Promise((res, rej) =>
    exec(cmd, { maxBuffer: 1024 * 1024 * 300, timeout: timeoutMs }, (e, out, se) =>
      e ? rej(new Error(se?.slice(0, 200) || e.message)) : res(out.trim())
    )
  );
}

// ── Download YouTube video via yt-dlp ─────────────────────────────────────────
async function downloadYouTubeVideo(query) {
  const outPath  = path.join(TEMP_DIR, `yt_${Date.now()}.mp4`);
  const safeQ    = query.replace(/"/g, '').replace(/'/g, '');

  // Step 1: get video ID and title
  let info;
  try {
    info = await runCmd(
      `yt-dlp "ytsearch1:${safeQ}" --get-id --get-title --no-playlist 2>/dev/null`,
      30000
    );
  } catch (e) {
    throw new Error(`Search failed: ${e.message?.slice(0, 80)}`);
  }

  const lines = info.split('\n').filter(l => l.trim() && !l.startsWith('WARNING') && !l.startsWith('['));
  if (lines.length < 2) throw new Error('No video found for query');
  const title = lines[0].trim();
  const vidId = lines[1].trim();
  if (!vidId || vidId.length < 5 || vidId.length > 15) throw new Error(`Invalid video ID: ${vidId}`);

  console.log(`[AutoYouTube] Found: ${title} (${vidId})`);

  // Step 2: download
  await runCmd(
    `yt-dlp "https://www.youtube.com/watch?v=${vidId}" ` +
    `-f "best[height<=480][ext=mp4]/best[height<=480]/bestvideo[height<=480]+bestaudio/best" ` +
    `--max-filesize 38m --no-playlist --merge-output-format mp4 ` +
    `-o "${outPath}" 2>/dev/null`,
    100000
  );

  if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 50000) {
    throw new Error('Download file too small or missing');
  }
  return { path: outPath, title, vidId };
}

// ── Compose post body ─────────────────────────────────────────────────────────
const DIVIDERS = ['━━━━━━━━━━━━━━━━━━━━━━━━', '═══════════════════════', '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬'];
const HASHTAGS = [
  '#MusicVideo #YouTube #OPM #Music #Trending',
  '#MusicLovers #NowPlaying #OPM #YouTube #Viral',
  '#BestMusic #Trending #MusicVideo #Philippines #Viral',
  '#OPM #MusicVideo #NowPlaying #YouTube #Pinoy',
];

function composePost(title, query) {
  const now  = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
  const div  = pick(DIVIDERS);
  const tags = pick(HASHTAGS);
  const artist = query.split(' ')[0] + ' ' + (query.split(' ')[1] || '');

  const layouts = [
    () =>
      `🎵 NOW PLAYING ON YOUR TIMELINE!\n${div}\n\n` +
      `🎤 ${title}\n\n` +
      `📅 ${now} PH\n` +
      `${div}\n` +
      `🔔 FOLLOW AND SHARE KA TROPA!\n` +
      `👍 Like | 🔁 Share | 💬 Comment\n` +
      `${tags}\n🏷️ ${TEAM}`,
    () =>
      `🎶 MUSIC TIME! 🎶\n${div}\n\n` +
      `▶️ ${title}\n` +
      `🎤 ${artist}\n\n` +
      `📅 ${now} PH\n` +
      `${div}\n` +
      `👉 FOLLOW AND SHARE KA TROPA! 🔥\n` +
      `${tags}\n🏷️ ${TEAM}`,
    () =>
      `🔥 TRENDING MUSIC VIDEO 🔥\n${div}\n\n` +
      `🎵 ${title}\n\n` +
      `⬇️ I-share sa iyong mga kaibigan!\n` +
      `📅 ${now} PH\n` +
      `✅ FOLLOW AND SHARE KA TROPA!\n` +
      `${tags}\n🏷️ ${TEAM}`,
  ];
  return pick(layouts)().trim().slice(0, 1900);
}

// ── createPost wrapper ────────────────────────────────────────────────────────
function doCreatePost(api, body, attachment) {
  return new Promise((res, rej) => {
    if (typeof api.createPost !== 'function') return rej(new Error('api.createPost not available'));
    const msg = attachment ? { body, attachment } : { body };
    api.createPost(msg, (err, url) => err ? rej(err) : res(url));
  });
}

// ── Try to comment on a post after it's created ───────────────────────────────
async function tryComment(api, postUrl) {
  if (!postUrl || typeof api.commentPost !== 'function') return;
  try {
    // Extract post_id from URL: story_fbid=XXXX or /posts/XXXX
    const m = String(postUrl).match(/story_fbid=(\d+)|\/posts\/(\d+)|permalink\/(\d+)/);
    if (!m) return;
    const postId = m[1] || m[2] || m[3];
    if (!postId) return;
    await new Promise((res, rej) =>
      api.commentPost(postId, '🔥 FOLLOW AND SHARE KA TROPA! 🇵🇭', (e) => e ? rej(e) : res())
    );
    console.log('[AutoYouTube] ✅ Comment posted on video post');
  } catch {}
}

function saveAppstate(api) {
  try {
    const a = api.getAppState();
    if (a && Array.isArray(a)) {
      fs.writeFileSync('./appstate.json', JSON.stringify(a, null, 2));
    }
  } catch {}
}

// ── Shared timers ─────────────────────────────────────────────────────────────
let ytTimer   = null;
let globalApi = null;

// ── Main 10-minute cycle ──────────────────────────────────────────────────────
async function runYTCycle() {
  if (!state.enabled || !globalApi) return;

  const query = MUSIC_QUERIES[queryIndex % MUSIC_QUERIES.length];
  queryIndex++;
  persist();

  console.log(`[AutoYouTube #${state.count + 1}] 🎵 Searching: "${query.slice(0, 60)}"`);

  let videoPath = null;
  try {
    const video = await downloadYouTubeVideo(query);
    videoPath   = video.path;

    const body     = composePost(video.title, query);
    const sizeMb   = Math.round(fs.statSync(videoPath).size / 1024 / 1024);
    console.log(`[AutoYouTube] 📤 Uploading ${sizeMb}MB video: ${video.title.slice(0, 50)}`);

    const postUrl = await doCreatePost(globalApi, body, fs.createReadStream(videoPath));
    console.log(`[AutoYouTube] ✅ Posted! URL: ${postUrl || '(no URL)'}`);

    // Auto-comment after a short delay
    setTimeout(() => tryComment(globalApi, postUrl), 5000);

    state.count++;
    state.lastPostedAt = new Date().toISOString();
    state.errorCount   = 0;
    persist();
    saveAppstate(globalApi);
    if (global.protection?.clearCheckpoint) global.protection.clearCheckpoint(globalApi);

  } catch (e) {
    const errStr = typeof e === 'string' ? e : (e?.message || String(e));
    const msg    = errStr.toLowerCase();
    if (msg.includes('checkpoint') || msg.includes('restricted') || msg.includes('suspended')) {
      console.error(`[AutoYouTube] 🔒 RESTRICTION — 30 min backoff`);
      if (global.protection?.clearCheckpoint) global.protection.clearCheckpoint(globalApi);
      ytTimer = setTimeout(runYTCycle, 30 * 60 * 1000 + Math.random() * 5 * 60 * 1000);
      return;
    }
    console.error(`[AutoYouTube] ❌ Error:`, errStr.slice(0, 150));
    state.errorCount = (state.errorCount || 0) + 1;
    const backoff = Math.min(state.errorCount * 2 * 60 * 1000, 15 * 60 * 1000);
    console.log(`[AutoYouTube] ⏳ Backoff: ${Math.round(backoff / 60000)} min`);
    ytTimer = setTimeout(runYTCycle, backoff);
    return;
  } finally {
    if (videoPath) setTimeout(() => fs.remove(videoPath).catch(() => {}), 300000);
  }

  // Schedule next — 10 min ± 45 sec jitter
  const jitter = (Math.random() - 0.5) * 2 * 45000;
  ytTimer = setTimeout(runYTCycle, INTERVAL + jitter);
  console.log(`[AutoYouTube] ⏱️ Next video post in ~10 min`);
}

function startAutoYouTube(api) {
  globalApi     = api;
  state.enabled = true;
  persist();
  const firstDelay = 20000 + Math.random() * 20000;
  ytTimer = setTimeout(runYTCycle, firstDelay);
  console.log(`[AutoYouTube] ✅ Started — every 10 min | First in ${Math.round(firstDelay / 1000)}s`);
}

function stopAutoYouTube() {
  if (ytTimer) { clearTimeout(ytTimer); ytTimer = null; }
  state.enabled = false;
  persist();
  console.log('[AutoYouTube] 🛑 Stopped');
}

// ── Module exports ────────────────────────────────────────────────────────────
module.exports.config = {
  name:            'autoyoutube',
  version:         VERSION,
  hasPermssion:    2,
  credits:         TEAM,
  description:     'Auto-searches YouTube music (Mariah Carey, Taylor Swift, OPM, etc.) & posts MP4 to Facebook WALL every 10 min. Auto-comments FOLLOW AND SHARE KA TROPA.',
  commandCategory: 'Admin',
  usages:          '[on | off | status]',
  cooldowns:       5,
};

module.exports.onLoad = function ({ api }) {
  loadPersistedState();
  if (state.enabled) {
    globalApi = api;
    console.log('[AutoYouTube] 🔄 Restored — resuming YouTube music cycle...');
    setTimeout(() => startAutoYouTube(api), 12000);
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P   = global.config?.PREFIX || '!';
  const sub = (args[0] || '').toLowerCase();

  if (!sub || sub === 'help') {
    return api.sendMessage(
      `╔═══════════════════════════════╗\n` +
      `║  🎵 ${bold('AUTOYOUTUBE v' + VERSION)}       ║\n` +
      `║  🏷️  ${bold(TEAM)}   ║\n` +
      `╚═══════════════════════════════╝\n\n` +
      `🎵 ${bold('Auto-posts YouTube Music Videos sa Facebook WALL!')}\n` +
      `📹 ${bold('Downloads MP4 at nagpo-post every 10 minutes')}\n` +
      `💬 ${bold('Auto-comments: "FOLLOW AND SHARE KA TROPA"')}\n\n` +
      `🎤 ${bold('ARTISTS (40+ rotation):')}\n` +
      `  • Mariah Carey  • Taylor Swift  • Adele\n` +
      `  • Ed Sheeran    • Bruno Mars    • Dua Lipa\n` +
      `  • BTS           • BLACKPINK     • Whitney Houston\n` +
      `  • Celine Dion   • Queen         • Westlife\n` +
      `  • OPM: KZ · Moira · Ben & Ben · December Ave\n\n` +
      `📋 ${bold('COMMANDS:')}\n${'─'.repeat(32)}\n` +
      `${P}autoyoutube on      — I-start\n` +
      `${P}autoyoutube off     — I-stop\n` +
      `${P}autoyoutube status  — Status\n\n` +
      `📊 ${bold('STATUS:')}\n` +
      `  • ${bold('State:')}       ${state.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
      `  • ${bold('Total posts:')} ${state.count}\n` +
      `  • ${bold('Next query:')}  ${MUSIC_QUERIES[queryIndex % MUSIC_QUERIES.length]?.slice(0, 40)}\n` +
      (state.lastPostedAt ? `  • ${bold('Last post:')}   ${new Date(state.lastPostedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}\n` : '') +
      `\n🔒 ${bold('Admin only')} | FREE — uses yt-dlp (no API key)`,
      threadID, messageID
    );
  }

  if (sub === 'on') {
    if (state.enabled) return api.sendMessage(`⚠️ ${bold('Naka-ON na ang AutoYouTube.')}\nI-stop: ${P}autoyoutube off`, threadID, messageID);
    startAutoYouTube(api);
    return api.sendMessage(
      `✅ ${bold('AUTOYOUTUBE v' + VERSION + ' — STARTED! 🎵')}\n\n` +
      `📹 ${bold('YouTube Music Videos sa Facebook WALL!')}\n` +
      `⏱️ ${bold('Every 10 minutes — 24/7')}\n` +
      `💬 ${bold('Auto-comment: "FOLLOW AND SHARE KA TROPA"')}\n` +
      `🎤 ${bold('40+ Artists:')} Mariah Carey · Taylor Swift · Adele · OPM & more!\n\n` +
      `🕒 ${bold('First video in ~20–40 seconds...')}\n` +
      `💡 I-stop: ${P}autoyoutube off\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  if (sub === 'off') {
    if (!state.enabled) return api.sendMessage(`⚠️ ${bold('Hindi naman naka-ON ang AutoYouTube.')}\nI-start: ${P}autoyoutube on`, threadID, messageID);
    stopAutoYouTube();
    return api.sendMessage(
      `🛑 ${bold('AUTOYOUTUBE — STOPPED!')}\n\n` +
      `Hindi na mag-do-download at mag-po-post ng music videos.\n` +
      `📊 Total posts: ${bold(String(state.count))}\n` +
      `💡 I-on ulit: ${P}autoyoutube on`,
      threadID, messageID
    );
  }

  if (sub === 'status') {
    return api.sendMessage(
      `📊 ${bold('AUTOYOUTUBE v' + VERSION + ' STATUS')}\n${'─'.repeat(32)}\n` +
      `  • ${bold('State:')}       ${state.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
      `  • ${bold('Posts to:')}    Facebook Wall/Timeline\n` +
      `  • ${bold('Frequency:')}   Every 10 minutes\n` +
      `  • ${bold('Total posts:')} ${state.count}\n` +
      `  • ${bold('Errors:')}      ${state.errorCount || 0}\n` +
      `  • ${bold('Query #')}      ${queryIndex} / ${MUSIC_QUERIES.length}\n` +
      `  • ${bold('Next:')}        ${MUSIC_QUERIES[queryIndex % MUSIC_QUERIES.length]?.slice(0, 35)}\n` +
      `  • ${bold('Last post:')}   ${state.lastPostedAt ? new Date(state.lastPostedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'N/A'}\n` +
      `\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  return api.sendMessage(`❓ ${P}autoyoutube [on|off|status]`, threadID, messageID);
};
