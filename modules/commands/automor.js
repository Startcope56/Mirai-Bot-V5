/**
 * !automor v4.0.0 — Auto-posts live Philippines news to Facebook TIMELINE/WALL
 * Single cycle every 59 minutes · 24/7 walang tigil · FREE, no API key
 * Sources: PhilStar, Rappler, Inquirer, CNN PH, GMA News, USGS Earthquakes
 * Uses api.createPost() — posts to bot's own Facebook wall, NOT group chat
 */

const fs       = require('fs-extra');
const path     = require('path');
const axios    = require('axios');
const bold     = require('../../utils/bold');

const VERSION  = '4.0.0';
const TEAM     = 'TEAM STARTCOPE BETA';
const INTERVAL = 59 * 60 * 1000; // 59 minutes per post

// ── Paths ─────────────────────────────────────────────────────────────────────
const DATA_DIR   = path.join(process.cwd(), 'utils/data');
const STATE_FILE = path.join(DATA_DIR, 'automor_state.json');
const SEEN_FILE  = path.join(DATA_DIR, 'automor_seen.json');
const TEMP_DIR   = path.join(DATA_DIR, 'automor_temp');
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(TEMP_DIR);

// ── State ─────────────────────────────────────────────────────────────────────
function loadStateFile()  { try { return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}; } catch { return {}; } }
function saveStateFile(d) { try { fs.writeFileSync(STATE_FILE, JSON.stringify(d, null, 2)); } catch {} }
function loadSeen()       { try { return fs.existsSync(SEEN_FILE)  ? JSON.parse(fs.readFileSync(SEEN_FILE,  'utf8')) : []; } catch { return []; } }
function saveSeen(arr)    { try { fs.writeFileSync(SEEN_FILE, JSON.stringify(arr)); } catch {} }

let state = { enabled: false, count: 0, lastPostedAt: null, errorCount: 0 };

function loadPersistedState() {
  const s = loadStateFile();
  if (s.enabled      !== undefined) state.enabled      = s.enabled;
  if (s.count        !== undefined) state.count        = s.count;
  if (s.lastPostedAt !== undefined) state.lastPostedAt = s.lastPostedAt;
  if (s.errorCount   !== undefined) state.errorCount   = s.errorCount;
}
function persist() { saveStateFile(state); }

let seenNews = new Set(loadSeen());
function markSeen(id) {
  seenNews.add(String(id));
  if (seenNews.size > 800) { const a = [...seenNews]; seenNews = new Set(a.slice(a.length - 500)); }
  saveSeen([...seenNews]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const pick  = (a) => a[Math.floor(Math.random() * a.length)];
const UA    = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
async function httpGet(url) { return axios.get(url, { timeout: 10000, headers: { 'User-Agent': UA } }); }

// ── RSS parser ────────────────────────────────────────────────────────────────
function parseRSS(xml) {
  const items = [];
  const blocks = xml.split(/<item|<entry/);
  for (let i = 1; i < blocks.length; i++) {
    const b   = blocks[i];
    const get = (tag) => {
      const cd = b.match(new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`));
      if (cd) return cd[1].trim();
      const pl = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return pl ? pl[1].replace(/<[^>]+>/g, '').trim() : '';
    };
    const title   = get('title');
    const link    = get('link') || b.match(/<link[^>]+href="([^"]+)"/)?.[1] || '';
    const desc    = (get('description') || get('summary') || '').replace(/<[^>]+>/g, '').trim().slice(0, 250);
    const pubDate = get('pubDate') || get('published') || '';
    const thumb   = b.match(/url="([^"]+\.(jpg|jpeg|png|webp))"/i)?.[1] ||
                    b.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] ||
                    b.match(/<enclosure[^>]+url="([^"]+\.(jpg|jpeg|png))"/i)?.[1] || '';
    if (title && title.length > 3) items.push({ title, link, desc, pubDate, thumb });
  }
  return items;
}

const RSS_FEEDS = [
  { name: 'GMA News',          emoji: '📺', cat: 'GMA',      url: 'https://www.gmanetwork.com/news/rss/news.xml' },
  { name: 'PhilStar',          emoji: '🚨', cat: 'Breaking', url: 'https://www.philstar.com/rss/headlines' },
  { name: 'Inquirer',          emoji: '📰', cat: 'Inquirer', url: 'https://newsinfo.inquirer.net/feed' },
  { name: 'CNN Philippines',   emoji: '📺', cat: 'CNN',      url: 'https://cnnphilippines.com/rss/rss.html' },
  { name: 'Rappler',           emoji: '📡', cat: 'News',     url: 'https://www.rappler.com/rss/' },
  { name: 'PhilStar Nation',   emoji: '🏛️', cat: 'Nation',   url: 'https://www.philstar.com/rss/nation' },
  { name: 'PhilStar Business', emoji: '💼', cat: 'Business', url: 'https://www.philstar.com/rss/business' },
];

async function fetchAllRSS() {
  const out = [];
  await Promise.all(RSS_FEEDS.map(async (f) => {
    try {
      const { data } = await httpGet(f.url);
      for (const item of parseRSS(data)) {
        if (item.link) out.push({ ...item, source: f.name, emoji: f.emoji, cat: f.cat });
      }
    } catch {}
  }));
  return out;
}

async function fetchEarthquakes() {
  try {
    const { data } = await httpGet('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const PH = /Philippines|Mindanao|Luzon|Visayas|Davao|Cebu|Manila|Leyte|Samar|Palawan|Batangas|Bicol/i;
    return (parsed.features || [])
      .filter(e => PH.test(e.properties.place || ''))
      .map(e => ({
        title:   `M${e.properties.mag} Earthquake — ${e.properties.place}`,
        link:    e.properties.url || 'https://earthquake.usgs.gov',
        desc:    `Magnitude ${e.properties.mag}. Depth: ${Math.round(e.geometry?.coordinates?.[2] || 0)} km.`,
        pubDate: new Date(e.properties.time).toISOString(),
        thumb:   '', source: 'USGS', emoji: '🌋', cat: 'Earthquake', id: e.id,
      }));
  } catch { return []; }
}

async function getNextNews() {
  const [rss, quakes] = await Promise.all([fetchAllRSS(), fetchEarthquakes()]);
  const all   = [...quakes, ...rss];
  const fresh = all.filter(n => {
    const id = n.id || n.link;
    return id && !seenNews.has(String(id));
  });
  if (!fresh.length) { seenNews.clear(); saveSeen([]); return all[0] || null; }
  return fresh[0];
}

// ── Post composer ─────────────────────────────────────────────────────────────
const DIVIDERS = [
  '━━━━━━━━━━━━━━━━━━━━━━━━',
  '═══════════════════════',
  '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
  '•───────────────────•',
];

function composeNewsPost(news) {
  const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
  const div = pick(DIVIDERS);
  const layouts = [
    () =>
      `${news.emoji} [${news.cat.toUpperCase()}] ${news.source} 🇵🇭\n${div}\n\n` +
      `${news.title}\n\n` +
      (news.desc ? `${news.desc}\n\n` : '') +
      `📅 ${now} PH\n${div}\n${TEAM} | Philippines News 🇵🇭`,
    () =>
      `📡 PHILIPPINE NEWS UPDATE\n\n${news.emoji} ${news.cat.toUpperCase()} — ${news.source}\n\n` +
      `${news.title}\n\n` +
      (news.desc ? `${news.desc}\n\n` : '') +
      `📅 ${now} PH\n${TEAM} #PhilippinesNews`,
    () =>
      `🔴 LIVE NEWS — PHILIPPINES\n${div}\n\n${news.emoji} ${news.title}\n\n` +
      (news.desc ? `${news.desc}\n\n` : '') +
      `Source: ${news.source}\nTime: ${now} PH\n🇵🇭 ${TEAM}`,
  ];
  return pick(layouts)().trim().slice(0, 1900);
}

// ── Generate AI news image via Pollinations ───────────────────────────────────
async function generateNewsImage(title) {
  try {
    const prompt = encodeURIComponent(
      `Philippine news broadcast graphic, headline: "${title.slice(0, 55)}", ` +
      `dark navy blue background, red breaking news banner, professional TV news style, ` +
      `Philippines flag accent, crisp white text, high contrast, HD`
    );
    const url  = `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=600&nologo=true&model=flux&seed=${Math.floor(Math.random() * 99999)}`;
    const res  = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
    if (!res.data || res.data.byteLength < 2000) return null;
    const fp = path.join(TEMP_DIR, `news_img_${Date.now()}.jpg`);
    fs.writeFileSync(fp, Buffer.from(res.data));
    return fp;
  } catch { return null; }
}

// ── Download article thumbnail ────────────────────────────────────────────────
async function downloadThumb(url) {
  try {
    const fp  = path.join(TEMP_DIR, `thumb_${Date.now()}.jpg`);
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 12000, headers: { 'User-Agent': UA } });
    if (!res.data || res.data.byteLength < 5000) return null;
    fs.writeFileSync(fp, Buffer.from(res.data));
    return fp;
  } catch { return null; }
}

// ── createPost wrapper ────────────────────────────────────────────────────────
function doCreatePost(api, body, attachment) {
  return new Promise((res, rej) => {
    if (typeof api.createPost !== 'function') return rej(new Error('api.createPost not available'));
    const msg = attachment ? { body, attachment } : { body };
    api.createPost(msg, (err, url) => err ? rej(err) : res(url));
  });
}

function saveAppstate(api) {
  try {
    const s = api.getAppState();
    if (s && Array.isArray(s)) {
      fs.writeFileSync('./appstate.json', JSON.stringify(s, null, 2));
      fs.writeFileSync('./utils/data/fbstate.json', JSON.stringify(s, null, 2));
    }
  } catch {}
}

// ── Shared state ──────────────────────────────────────────────────────────────
let morTimer  = null;
let globalApi = null;

// ── Main 59-minute cycle ──────────────────────────────────────────────────────
async function runMorCycle() {
  if (!state.enabled || !globalApi) return;
  try {
    const news = await getNextNews();
    if (!news) {
      console.log('[AutoMOR] No fresh news — skipping this cycle');
    } else {
      const newsId = news.id || news.link;
      markSeen(newsId);
      const text = composeNewsPost(news);

      // Try article thumbnail first (real photo), then AI-generated image
      console.log(`[AutoMOR] 🖼️ Fetching image for: ${news.title?.slice(0, 50)}`);
      const [thumbResult, aiResult] = await Promise.allSettled([
        news.thumb?.startsWith('http') ? downloadThumb(news.thumb) : Promise.resolve(null),
        generateNewsImage(news.title),
      ]);

      const imgPath = (thumbResult.status === 'fulfilled' && thumbResult.value)
        ? thumbResult.value
        : (aiResult.status === 'fulfilled' ? aiResult.value : null);

      if (imgPath) {
        try {
          await doCreatePost(globalApi, text, fs.createReadStream(imgPath));
        } catch {
          await doCreatePost(globalApi, text);
        }
        setTimeout(() => { try { fs.removeSync(imgPath); } catch {} }, 120000);
        if (thumbResult.value && thumbResult.value !== imgPath) try { fs.removeSync(thumbResult.value); } catch {}
        if (aiResult.value   && aiResult.value   !== imgPath) try { fs.removeSync(aiResult.value);   } catch {}
      } else {
        await doCreatePost(globalApi, text);
      }

      state.count++;
      state.lastPostedAt = new Date().toISOString();
      state.errorCount   = 0;
      persist();
      saveAppstate(globalApi);
      if (global.protection?.clearCheckpoint) global.protection.clearCheckpoint(globalApi);
      console.log(`[AutoMOR #${state.count}] ✅ Posted: ${news.title?.slice(0, 60)}`);
    }
  } catch (e) {
    const errStr = typeof e === 'string' ? e : (e?.message || JSON.stringify(e).slice(0, 200));
    const msg    = errStr.toLowerCase();
    if (msg.includes('checkpoint') || msg.includes('restricted') || msg.includes('suspended')) {
      console.error(`[AutoMOR] 🔒 RESTRICTION — backing off 30 min:`, errStr.slice(0, 80));
      if (global.protection?.clearCheckpoint) global.protection.clearCheckpoint(globalApi);
      morTimer = setTimeout(runMorCycle, 30 * 60 * 1000 + Math.random() * 5 * 60 * 1000);
      return;
    }
    console.error(`[AutoMOR] ❌ error:`, errStr.slice(0, 200));
    state.errorCount = (state.errorCount || 0) + 1;
    const backoff = Math.min(state.errorCount * 3 * 60 * 1000, 20 * 60 * 1000);
    console.log(`[AutoMOR] ⏳ backoff: ${Math.round(backoff / 60000)} min`);
    morTimer = setTimeout(runMorCycle, backoff);
    return;
  }

  // Schedule next — 59 min ± 90 sec jitter
  const jitter = (Math.random() - 0.5) * 2 * 90000;
  morTimer = setTimeout(runMorCycle, INTERVAL + jitter);
  console.log(`[AutoMOR] ⏱️ Next post in ~59 min`);
}

function startAutoMor(api) {
  globalApi     = api;
  state.enabled = true;
  persist();
  const firstDelay = 30000 + Math.random() * 20000;
  morTimer = setTimeout(runMorCycle, firstDelay);
  console.log(`[AutoMOR] ✅ Started — every 59 minutes | First post in ${Math.round(firstDelay / 1000)}s`);
}

function stopAutoMor() {
  if (morTimer) { clearTimeout(morTimer); morTimer = null; }
  state.enabled = false;
  persist();
  console.log(`[AutoMOR] 🛑 Stopped`);
}

// ── Command exports ───────────────────────────────────────────────────────────
module.exports.config = {
  name:            'automor',
  version:         VERSION,
  hasPermssion:    2,
  credits:         TEAM,
  description:     'Auto-posts PH news with image to Facebook WALL every 59 minutes, 24/7',
  commandCategory: 'Admin',
  usages:          '[on | off | status]',
  cooldowns:       5
};

module.exports.onLoad = function ({ api }) {
  loadPersistedState();
  if (state.enabled) {
    globalApi = api;
    console.log(`[AutoMOR] 🔄 Restored — resuming 59-min news cycle...`);
    setTimeout(() => startAutoMor(api), 10000);
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P   = global.config?.PREFIX || '!';
  const sub = (args[0] || '').toLowerCase();

  if (!sub || sub === 'help') {
    return api.sendMessage(
      `╔═══════════════════════════════╗\n` +
      `║  📰 ${bold('AUTOMOR NEWS v' + VERSION)}      ║\n` +
      `║  🏷️  ${bold(TEAM)}   ║\n` +
      `╚═══════════════════════════════╝\n\n` +
      `🇵🇭 ${bold('LIVE PHILIPPINE NEWS — 24/7 NON-STOP!')}\n` +
      `🖼️ ${bold('Posts to: Facebook WALL/TIMELINE')}\n` +
      `⏱️ ${bold('Interval:')} Every 59 minutes (may jitter)\n\n` +
      `📡 ${bold('SOURCES (FREE, no API key):')}\n` +
      `  📺 GMA News · 🚨 PhilStar · 📰 Inquirer\n` +
      `  📡 Rappler · 📺 CNN PH · 🌋 USGS Earthquakes\n\n` +
      `📋 ${bold('COMMANDS:')}\n${'─'.repeat(32)}\n` +
      `${P}automor on      — I-start\n` +
      `${P}automor off     — I-stop\n` +
      `${P}automor status  — Status\n\n` +
      `📊 ${bold('STATUS:')}\n` +
      `  • ${bold('State:')}       ${state.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
      `  • ${bold('Total posts:')} ${state.count}\n` +
      (state.lastPostedAt ? `  • ${bold('Last post:')}   ${new Date(state.lastPostedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}\n` : '') +
      `\n🔒 ${bold('Admin only')} | Posts to Facebook WALL`,
      threadID, messageID
    );
  }

  if (sub === 'on') {
    if (state.enabled) return api.sendMessage(`⚠️ ${bold('Naka-ON na ang AutoMOR.')}\nI-stop: ${P}automor off`, threadID, messageID);
    startAutoMor(api);
    return api.sendMessage(
      `✅ ${bold('AUTOMOR NEWS v' + VERSION + ' — STARTED! 🇵🇭')}\n\n` +
      `📰 ${bold('Live Philippines News — 59 MINUTES INTERVAL!')}\n` +
      `🖼️ ${bold('Posts to: Facebook WALL/TIMELINE')}\n` +
      `📡 ${bold('Sources:')} GMA · PhilStar · Inquirer · Rappler · CNN PH · USGS\n\n` +
      `🕒 ${bold('First post in ~30–50 seconds...')}\n` +
      `💡 I-stop: ${P}automor off\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  if (sub === 'off') {
    if (!state.enabled) return api.sendMessage(`⚠️ ${bold('Hindi naman naka-ON ang AutoMOR.')}\nI-start: ${P}automor on`, threadID, messageID);
    stopAutoMor();
    return api.sendMessage(
      `🛑 ${bold('AUTOMOR NEWS — STOPPED!')}\n\n` +
      `Hindi na mag-po-post ng news sa Facebook wall.\n` +
      `📊 Total posts: ${bold(String(state.count))}\n` +
      `💡 I-on ulit: ${P}automor on`,
      threadID, messageID
    );
  }

  if (sub === 'status') {
    return api.sendMessage(
      `📊 ${bold('AUTOMOR STATUS')} 🇵🇭\n${'─'.repeat(32)}\n` +
      `  • ${bold('State:')}       ${state.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
      `  • ${bold('Posts to:')}    Facebook Wall/Timeline\n` +
      `  • ${bold('Frequency:')}   Every 59 minutes\n` +
      `  • ${bold('Total posts:')} ${state.count}\n` +
      `  • ${bold('Errors:')}      ${state.errorCount || 0}\n` +
      `  • ${bold('Seen cache:')}  ${seenNews.size} articles\n` +
      `  • ${bold('Last post:')}   ${state.lastPostedAt ? new Date(state.lastPostedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'N/A'}\n` +
      `\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  return api.sendMessage(`❓ ${P}automor [on|off|status]`, threadID, messageID);
};
