/**
 * !autovideo v2.1.0 — Auto-posts Philippines News Broadcast to Facebook WALL
 * Every 5 minutes · 24/7 walang tigil · FREE, no API key
 * Posts: Rich news text + Pollinations AI news image OR article thumbnail
 * NOTE: Facebook wall video upload not supported by FCA API — uses image post instead
 */

const axios  = require('axios');
const fs     = require('fs-extra');
const path   = require('path');
const bold   = require('../../utils/bold');

const VERSION     = '2.1.0';
const TEAM        = 'TEAM STARTCOPE BETA';
const INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes

const DATA_DIR   = path.join(process.cwd(), 'utils/data');
const STATE_FILE = path.join(DATA_DIR, 'autovideo_state.json');
const SEEN_FILE  = path.join(DATA_DIR, 'autovideo_seen.json');
const TEMP_DIR   = path.join(DATA_DIR, 'autovideo_temp');
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(TEMP_DIR);

const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const pick = a => a[Math.floor(Math.random() * a.length)];

// ── State ─────────────────────────────────────────────────────────────────────
function loadState()   { try { return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}; } catch { return {}; } }
function saveState(d)  { try { fs.writeFileSync(STATE_FILE, JSON.stringify(d, null, 2)); } catch {} }
function loadSeen()    { try { return fs.existsSync(SEEN_FILE)  ? JSON.parse(fs.readFileSync(SEEN_FILE,  'utf8')) : []; } catch { return []; } }
function saveSeen(arr) { try { fs.writeFileSync(SEEN_FILE, JSON.stringify(arr)); } catch {} }

let state    = { enabled: false, count: 0, lastPostedAt: null, errorCount: 0 };
let seenNews = new Set(loadSeen());

function loadPersistedState() {
  const s = loadState();
  if (s.enabled !== undefined) state.enabled = s.enabled;
  if (s.count   !== undefined) state.count   = s.count;
  if (s.lastPostedAt !== undefined) state.lastPostedAt = s.lastPostedAt;
  if (s.errorCount   !== undefined) state.errorCount   = s.errorCount;
}
function persist() { saveState(state); }

function markSeen(id) {
  seenNews.add(String(id));
  if (seenNews.size > 800) { const a = [...seenNews]; seenNews = new Set(a.slice(a.length - 500)); }
  saveSeen([...seenNews]);
}

let videoTimer = null;
let globalApi  = null;

// ── RSS feeds ─────────────────────────────────────────────────────────────────
const RSS_FEEDS = [
  { name: 'GMA News',        emoji: '📺', cat: 'GMA',      url: 'https://www.gmanetwork.com/news/rss/news.xml' },
  { name: 'PhilStar',        emoji: '🚨', cat: 'Breaking', url: 'https://www.philstar.com/rss/headlines' },
  { name: 'Inquirer',        emoji: '📰', cat: 'Inquirer', url: 'https://newsinfo.inquirer.net/feed' },
  { name: 'CNN Philippines', emoji: '📺', cat: 'CNN',      url: 'https://cnnphilippines.com/rss/rss.html' },
  { name: 'Rappler',         emoji: '📡', cat: 'News',     url: 'https://www.rappler.com/rss/' },
  { name: 'PhilStar Nation', emoji: '🏛️', cat: 'Nation',   url: 'https://www.philstar.com/rss/nation' },
  { name: 'GMA Sports',      emoji: '⚽', cat: 'Sports',   url: 'https://www.gmanetwork.com/news/rss/sports.xml' },
];

function parseRSS(xml) {
  const items = [];
  const blocks = xml.split(/<item|<entry/);
  for (let i = 1; i < blocks.length; i++) {
    const b   = blocks[i];
    const get = (tag) => {
      const cd = b.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
      if (cd) return cd[1].trim();
      const pl = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return pl ? pl[1].replace(/<[^>]+>/g, '').trim() : '';
    };
    const title   = get('title');
    const link    = get('link') || b.match(/<link[^>]+href="([^"]+)"/)?.[1] || '';
    const desc    = (get('description') || get('summary') || '').replace(/<[^>]+>/g, '').trim().slice(0, 200);
    const pubDate = get('pubDate') || get('published') || '';
    const thumb   = b.match(/url="([^"]+\.(jpg|jpeg|png|webp))"/i)?.[1] ||
                    b.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] || '';
    if (title && title.length > 3) items.push({ title, link, desc, pubDate, thumb });
  }
  return items;
}

async function fetchAllNews() {
  const all = [];
  await Promise.all(RSS_FEEDS.map(async (f) => {
    try {
      const { data } = await axios.get(f.url, { timeout: 10000, headers: { 'User-Agent': UA } });
      for (const item of parseRSS(data)) all.push({ ...item, source: f.name, emoji: f.emoji, cat: f.cat });
    } catch {}
  }));
  return all;
}

async function getNewsItems() {
  const all   = await fetchAllNews();
  const fresh = all.filter(n => !seenNews.has(String(n.id || n.link)));
  if (!fresh.length) { seenNews.clear(); saveSeen([]); return all.slice(0, 8); }
  return fresh.slice(0, 8);
}

// ── PH time greeting ──────────────────────────────────────────────────────────
function phGreeting() {
  const h = (new Date().getUTCHours() + 8) % 24;
  if (h >= 5  && h < 12) return 'Magandang umaga';
  if (h >= 12 && h < 18) return 'Magandang hapon';
  if (h >= 18 && h < 22) return 'Magandang gabi';
  return 'Magandang hatinggabi';
}

// ── Fetch article thumbnail ───────────────────────────────────────────────────
async function downloadThumb(url) {
  try {
    const fp  = path.join(TEMP_DIR, `thumb_${Date.now()}.jpg`);
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000, headers: { 'User-Agent': UA } });
    if (!res.data || res.data.byteLength < 5000) return null;
    fs.writeFileSync(fp, Buffer.from(res.data));
    return fp;
  } catch { return null; }
}

// ── AI news image via Pollinations ────────────────────────────────────────────
async function generateNewsImage(title) {
  try {
    const prompt = encodeURIComponent(
      `Philippine news broadcast graphic, bold headline text "${title.slice(0, 50)}", ` +
      `dark navy blue background, red breaking news banner, professional TV broadcast style, ` +
      `Philippines flag accent, white crisp text, high contrast, HD sharp`
    );
    const url = `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=600&nologo=true&model=flux&seed=${Math.floor(Math.random() * 99999)}`;
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 55000 });
    if (!res.data || res.data.byteLength < 2000) return null;
    const fp = path.join(TEMP_DIR, `ai_img_${Date.now()}.jpg`);
    fs.writeFileSync(fp, Buffer.from(res.data));
    return fp;
  } catch { return null; }
}

// ── Compose broadcast post body ───────────────────────────────────────────────
const DIVIDERS = ['━━━━━━━━━━━━━━━━━━━━━━━━', '═══════════════════════', '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬'];

function composePostBody(articles) {
  const now     = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
  const greet   = phGreeting();
  const div     = pick(DIVIDERS);
  const tops    = articles.slice(0, 6);
  const nums    = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

  const layouts = [
    () =>
      `📺 PHILIPPINES NEWS BROADCAST\n${greet} po! Ito ang pinakabagong balita:\n${div}\n\n` +
      tops.map((a, i) =>
        `${nums[i]} ${a.emoji} [${a.cat}] ${a.title}\n` +
        (a.desc ? `   ${a.desc.slice(0, 90)}\n` : '')
      ).join('\n') +
      `\n${div}\n📅 ${now} PH | 🎙️ Tagalog Broadcast\n🇵🇭 ${TEAM}`,

    () =>
      `🔴 LIVE NEWS — PILIPINAS 🇵🇭\n${div}\n\n` +
      tops.slice(0, 4).map((a, i) =>
        `${a.emoji} [${a.source}] ${a.title}\n` +
        (a.desc ? `   ${a.desc.slice(0, 80)}\n` : '')
      ).join('\n') +
      `\n${div}\n📅 ${now} PH | 📡 Philippine News | 🇵🇭 ${TEAM}`,

    () => {
      const top = tops[0];
      return (
        `📡 ${greet}! ${top.source} REPORT:\n${div}\n\n` +
        `${top.emoji} ${top.title}\n\n` +
        (top.desc ? `${top.desc}\n\n` : '') +
        `Dagdag na balita:\n` +
        tops.slice(1, 5).map((a, i) => `  ${nums[i]} ${a.title.slice(0, 70)}`).join('\n') +
        `\n\n${div}\n📅 ${now} PH | 🇵🇭 ${TEAM}`
      );
    },
  ];

  return pick(layouts)().trim().slice(0, 1900);
}

// ── Save appstate ─────────────────────────────────────────────────────────────
function saveAppstate(api) {
  try {
    const a = api.getAppState();
    if (a && Array.isArray(a)) fs.writeFileSync('./appstate.json', JSON.stringify(a, null, 2));
  } catch {}
}

// ── createPost wrapper ────────────────────────────────────────────────────────
function doCreatePost(api, body, attachment) {
  return new Promise((res, rej) => {
    if (typeof api.createPost !== 'function') return rej(new Error('api.createPost not available'));
    const msg = attachment ? { body, attachment } : { body };
    api.createPost(msg, (err, url) => err ? rej(err) : res(url));
  });
}

// ── Error handler ─────────────────────────────────────────────────────────────
function handleError(e, cycleFn) {
  const errStr = typeof e === 'string' ? e : (e?.message || JSON.stringify(e).slice(0, 200));
  const msg    = errStr.toLowerCase();
  if (msg.includes('checkpoint') || msg.includes('restricted') || msg.includes('suspended')) {
    console.error(`[AutoVideo] 🔒 RESTRICTION — 30 min backoff`);
    if (global.protection?.clearCheckpoint) global.protection.clearCheckpoint(globalApi);
    return setTimeout(cycleFn, 30 * 60 * 1000 + Math.random() * 5 * 60 * 1000);
  }
  console.error(`[AutoVideo] ❌ Error:`, errStr.slice(0, 150));
  state.errorCount = (state.errorCount || 0) + 1;
  const backoff = Math.min(state.errorCount * 2 * 60 * 1000, 20 * 60 * 1000);
  return setTimeout(cycleFn, backoff);
}

// ── Main 5-minute cycle ───────────────────────────────────────────────────────
async function runVideoCycle() {
  if (!state.enabled || !globalApi) return;

  console.log(`[AutoVideo #${state.count + 1}] 📰 Fetching news...`);
  let imgPath = null;

  try {
    const articles = await getNewsItems();
    if (!articles.length) throw new Error('No news articles fetched');

    articles.slice(0, 8).forEach(a => markSeen(a.id || a.link));

    const body = composePostBody(articles);
    const top  = articles[0];

    // Try article thumbnail first, then Pollinations AI image
    console.log(`[AutoVideo] 🖼️ Getting image for: ${top.title?.slice(0, 50)}`);
    const [thumbRes, aiRes] = await Promise.allSettled([
      top.thumb?.startsWith('http') ? downloadThumb(top.thumb) : Promise.resolve(null),
      generateNewsImage(top.title),
    ]);
    imgPath = (thumbRes.status === 'fulfilled' && thumbRes.value)
      ? thumbRes.value
      : (aiRes.status === 'fulfilled' ? aiRes.value : null);

    if (imgPath) {
      try {
        await doCreatePost(globalApi, body, fs.createReadStream(imgPath));
      } catch {
        // Image failed — try text only
        await doCreatePost(globalApi, body);
      }
      setTimeout(() => { try { fs.removeSync(imgPath); } catch {} }, 120000);
      const other = (thumbRes.value && thumbRes.value !== imgPath) ? thumbRes.value
                  : (aiRes.value   && aiRes.value   !== imgPath) ? aiRes.value : null;
      if (other) try { fs.removeSync(other); } catch {}
    } else {
      await doCreatePost(globalApi, body);
    }

    state.count++;
    state.lastPostedAt = new Date().toISOString();
    state.errorCount   = 0;
    persist();
    saveAppstate(globalApi);
    if (global.protection?.clearCheckpoint) global.protection.clearCheckpoint(globalApi);
    console.log(`[AutoVideo #${state.count}] ✅ News broadcast posted!  ${top.title?.slice(0, 55)}`);

  } catch (e) {
    if (imgPath) try { fs.removeSync(imgPath); } catch {}
    videoTimer = handleError(e, runVideoCycle);
    return;
  }

  const jitter = (Math.random() - 0.5) * 2 * 45000;
  videoTimer = setTimeout(runVideoCycle, INTERVAL_MS + jitter);
}

// ── Start / Stop ──────────────────────────────────────────────────────────────
function startAutoVideo(api) {
  globalApi     = api;
  state.enabled = true;
  persist();
  const firstDelay = 20000 + Math.random() * 20000;
  videoTimer = setTimeout(runVideoCycle, firstDelay);
  console.log(`[AutoVideo] ✅ Started — news broadcast every 5 min | First in ${Math.round(firstDelay / 1000)}s`);
}

function stopAutoVideo() {
  if (videoTimer) { clearTimeout(videoTimer); videoTimer = null; }
  state.enabled = false;
  persist();
  console.log('[AutoVideo] 🛑 Stopped');
}

// ── Module exports ────────────────────────────────────────────────────────────
module.exports.config = {
  name:            'autovideo',
  version:         VERSION,
  hasPermssion:    2,
  credits:         TEAM,
  description:     'Auto-posts Philippines News Broadcast (text + image) to Facebook WALL every 5 min. Sources: GMA, PhilStar, Inquirer, CNN PH, Rappler.',
  commandCategory: 'Admin',
  usages:          '[on | off | status]',
  cooldowns:       5,
};

module.exports.onLoad = function ({ api }) {
  loadPersistedState();
  if (state.enabled) {
    globalApi = api;
    console.log(`[AutoVideo] 🔄 Restored — resuming news broadcast cycle...`);
    setTimeout(() => startAutoVideo(api), 15000);
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P   = global.config?.PREFIX || '!';
  const sub = (args[0] || '').toLowerCase();

  if (!sub || sub === 'help') {
    return api.sendMessage(
      `╔═══════════════════════════════╗\n` +
      `║  📺 ${bold('AUTOVIDEO v' + VERSION)}          ║\n` +
      `║  🏷️  ${bold(TEAM)}   ║\n` +
      `╚═══════════════════════════════╝\n\n` +
      `📺 ${bold('PH NEWS BROADCAST sa Facebook WALL — 24/7!')}\n` +
      `🖼️ ${bold('Posts: News text + thumbnail/AI image')}\n` +
      `📡 ${bold('Sources:')} GMA · PhilStar · Inquirer · CNN PH · Rappler\n` +
      `⏱️ ${bold('Interval:')} Every 5 minutes\n\n` +
      `📋 ${bold('COMMANDS:')}\n${'─'.repeat(32)}\n` +
      `${P}autovideo on      — I-start\n` +
      `${P}autovideo off     — I-stop\n` +
      `${P}autovideo status  — Status\n\n` +
      `📊 ${bold('STATUS:')}\n` +
      `  • ${bold('State:')}       ${state.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
      `  • ${bold('Total posts:')} ${state.count}\n` +
      (state.lastPostedAt ? `  • ${bold('Last post:')}   ${new Date(state.lastPostedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}\n` : '') +
      `\n🔒 ${bold('Admin only')} | Posts to Facebook WALL`,
      threadID, messageID
    );
  }

  if (sub === 'on') {
    if (state.enabled) return api.sendMessage(`⚠️ ${bold('Naka-ON na ang AutoVideo.')}\nI-stop: ${P}autovideo off`, threadID, messageID);
    startAutoVideo(api);
    return api.sendMessage(
      `✅ ${bold('AUTOVIDEO v' + VERSION + ' — STARTED! 🇵🇭')}\n\n` +
      `📺 ${bold('Philippines News Broadcast sa Facebook WALL!')}\n` +
      `🖼️ ${bold('Text + thumbnail image — every 5 minutes')}\n` +
      `📡 ${bold('Sources:')} GMA · PhilStar · Inquirer · CNN PH · Rappler\n\n` +
      `🕒 ${bold('First post in ~20–40 seconds...')}\n` +
      `💡 I-stop: ${P}autovideo off\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  if (sub === 'off') {
    if (!state.enabled) return api.sendMessage(`⚠️ ${bold('Hindi naman naka-ON ang AutoVideo.')}\nI-start: ${P}autovideo on`, threadID, messageID);
    stopAutoVideo();
    return api.sendMessage(
      `🛑 ${bold('AUTOVIDEO — STOPPED!')}\n\nHindi na mag-po-post ng news.\n` +
      `📊 Total posts: ${bold(String(state.count))}\n💡 I-on ulit: ${P}autovideo on`,
      threadID, messageID
    );
  }

  if (sub === 'status') {
    return api.sendMessage(
      `📊 ${bold('AUTOVIDEO v' + VERSION + ' STATUS')}\n${'─'.repeat(32)}\n` +
      `  • ${bold('State:')}       ${state.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
      `  • ${bold('Posts to:')}    Facebook Wall/Timeline\n` +
      `  • ${bold('Frequency:')}   Every 5 minutes\n` +
      `  • ${bold('Format:')}      News text + image\n` +
      `  • ${bold('Total posts:')} ${state.count}\n` +
      `  • ${bold('Errors:')}      ${state.errorCount || 0}\n` +
      `  • ${bold('Last post:')}   ${state.lastPostedAt ? new Date(state.lastPostedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'N/A'}\n` +
      `\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  return api.sendMessage(`❓ ${P}autovideo [on|off|status]`, threadID, messageID);
};
