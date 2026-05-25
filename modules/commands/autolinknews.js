/**
 * !autolinknews v1.0.0 — Auto-posts PH news LINKS to Facebook WALL
 * Every 15 minutes · Like GMA News Facebook posts (link preview with thumbnail)
 * Facebook auto-generates link cards (headline + thumbnail) from article URLs
 * Sources: GMA News, PhilStar, Inquirer, CNN PH, Rappler — FREE, no API key
 */

const fs    = require('fs-extra');
const path  = require('path');
const axios = require('axios');
const bold  = require('../../utils/bold');

const VERSION  = '1.0.0';
const TEAM     = 'TEAM STARTCOPE BETA';
const INTERVAL = 15 * 60 * 1000; // 15 minutes

const DATA_DIR   = path.join(process.cwd(), 'utils/data');
const STATE_FILE = path.join(DATA_DIR, 'autolinknews_state.json');
const SEEN_FILE  = path.join(DATA_DIR, 'autolinknews_seen.json');
fs.ensureDirSync(DATA_DIR);

// ── State ─────────────────────────────────────────────────────────────────────
function loadState()  { try { return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}; } catch { return {}; } }
function saveState(d) { try { fs.writeFileSync(STATE_FILE, JSON.stringify(d, null, 2)); } catch {} }
function loadSeen()   { try { return fs.existsSync(SEEN_FILE)  ? JSON.parse(fs.readFileSync(SEEN_FILE,  'utf8')) : []; } catch { return []; } }
function saveSeen(a)  { try { fs.writeFileSync(SEEN_FILE, JSON.stringify(a)); } catch {} }

let state = { enabled: false, count: 0, lastPostedAt: null, errorCount: 0 };
let seenLinks = new Set(loadSeen());

function loadPersistedState() {
  const s = loadState();
  if (s.enabled !== undefined) state.enabled = s.enabled;
  if (s.count   !== undefined) state.count   = s.count;
  if (s.lastPostedAt !== undefined) state.lastPostedAt = s.lastPostedAt;
  if (s.errorCount   !== undefined) state.errorCount   = s.errorCount;
}
function persist() { saveState(state); }

function markSeen(link) {
  seenLinks.add(String(link));
  if (seenLinks.size > 500) { const a = [...seenLinks]; seenLinks = new Set(a.slice(a.length - 300)); }
  saveSeen([...seenLinks]);
}

const pick  = (a) => a[Math.floor(Math.random() * a.length)];
const UA    = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

// ── News RSS feeds ─────────────────────────────────────────────────────────────
const RSS_FEEDS = [
  { name: 'GMA News',        emoji: '📺', cat: 'GMA',      url: 'https://www.gmanetwork.com/news/rss/news.xml' },
  { name: 'PhilStar',        emoji: '🚨', cat: 'Breaking', url: 'https://www.philstar.com/rss/headlines' },
  { name: 'Inquirer',        emoji: '📰', cat: 'Inquirer', url: 'https://newsinfo.inquirer.net/feed' },
  { name: 'CNN Philippines', emoji: '📺', cat: 'CNN PH',   url: 'https://cnnphilippines.com/rss/rss.html' },
  { name: 'Rappler',         emoji: '📡', cat: 'Rappler',  url: 'https://www.rappler.com/rss/' },
  { name: 'PhilStar Nation', emoji: '🏛️', cat: 'Nation',   url: 'https://www.philstar.com/rss/nation' },
  { name: 'Inquirer Nation', emoji: '🇵🇭', cat: 'Nation',   url: 'https://newsinfo.inquirer.net/category/nation/feed' },
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
    if (title && title.length > 3 && link?.startsWith('http')) {
      items.push({ title, link, desc, pubDate });
    }
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

async function getNextNews() {
  const all   = await fetchAllNews();
  const fresh = all.filter(n => n.link && !seenLinks.has(n.link));
  if (!fresh.length) { seenLinks.clear(); saveSeen([]); return all[0] || null; }
  return fresh[0];
}

// ── Compose Facebook post body — GMA News style ───────────────────────────────
// Facebook AUTOMATICALLY renders the link preview card (thumbnail + title + description)
// when a URL is included in the post body. This is exactly how GMA News posts work.
const DIVIDERS = ['━━━━━━━━━━━━━━━━━━━━━━━━', '═══════════════════════', '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬'];
const HASHTAGS_PH = [
  '#PhilippinesNews #BreakingNews #Balita',
  '#GMANews #BalitaAtBayan #Philippines',
  '#BreakingNews #PinoyNews #Pilipinas',
  '#LatestNews #Balita #PhilippinesNews',
];

function composeNewsLinkPost(news) {
  const now  = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
  const div  = pick(DIVIDERS);
  const tags = pick(HASHTAGS_PH);

  // GMA-style layouts — headline + short desc + link + hashtags
  const layouts = [
    () =>
      `${news.emoji} [${news.cat.toUpperCase()}] ${news.source}\n${div}\n\n` +
      `${news.title}\n\n` +
      (news.desc ? `${news.desc}\n\n` : '') +
      `🔗 ${news.link}\n\n` +
      `📅 ${now} PH\n${tags}\n🇵🇭 ${TEAM}`,

    () =>
      `📡 PHILIPPINE NEWS UPDATE 🇵🇭\n${div}\n\n` +
      `${news.emoji} ${news.title}\n\n` +
      (news.desc ? `${news.desc}\n\n` : '') +
      `📰 Source: ${news.source}\n` +
      `🔗 ${news.link}\n\n` +
      `📅 ${now} PH\n${tags}\n${TEAM}`,

    () =>
      `🔴 ${news.cat.toUpperCase()} — ${news.source} 🇵🇭\n\n` +
      `${news.title}\n\n` +
      (news.desc ? `${news.desc}\n\n` : '') +
      `👉 Basahin ang buong balita:\n${news.link}\n\n` +
      `📅 ${now} PH | ${tags}\n${TEAM}`,

    // Pure GMA style — just headline + link (cleanest link preview)
    () =>
      `${news.emoji} ${news.title}\n\n` +
      (news.desc ? `${news.desc}\n\n` : '') +
      `${news.link}\n\n` +
      `📅 ${now} PH | ${news.source}\n${tags}`,
  ];

  return pick(layouts)().trim().slice(0, 1900);
}

// ── createPost wrapper ────────────────────────────────────────────────────────
function doCreatePost(api, body) {
  return new Promise((res, rej) => {
    if (typeof api.createPost !== 'function') return rej(new Error('api.createPost not available'));
    api.createPost({ body }, (err, url) => err ? rej(err) : res(url));
  });
}

function saveAppstate(api) {
  try {
    const a = api.getAppState();
    if (a && Array.isArray(a)) fs.writeFileSync('./appstate.json', JSON.stringify(a, null, 2));
  } catch {}
}

// ── Shared timers ─────────────────────────────────────────────────────────────
let linkTimer = null;
let globalApi = null;

// ── Main 15-minute cycle ──────────────────────────────────────────────────────
async function runLinkCycle() {
  if (!state.enabled || !globalApi) return;

  try {
    const news = await getNextNews();
    if (!news) {
      console.log('[AutoLinkNews] No fresh news — skipping');
    } else {
      markSeen(news.link);
      const body = composeNewsLinkPost(news);
      const postUrl = await doCreatePost(globalApi, body);
      state.count++;
      state.lastPostedAt = new Date().toISOString();
      state.errorCount   = 0;
      persist();
      saveAppstate(globalApi);
      if (global.protection?.clearCheckpoint) global.protection.clearCheckpoint(globalApi);
      console.log(`[AutoLinkNews #${state.count}] ✅ Posted link: ${news.title?.slice(0, 50)}`);
    }
  } catch (e) {
    const errStr = typeof e === 'string' ? e : (e?.message || String(e));
    const msg    = errStr.toLowerCase();
    if (msg.includes('checkpoint') || msg.includes('restricted') || msg.includes('suspended')) {
      console.error(`[AutoLinkNews] 🔒 RESTRICTION — 30 min backoff`);
      if (global.protection?.clearCheckpoint) global.protection.clearCheckpoint(globalApi);
      linkTimer = setTimeout(runLinkCycle, 30 * 60 * 1000 + Math.random() * 5 * 60 * 1000);
      return;
    }
    console.error(`[AutoLinkNews] ❌ Error:`, errStr.slice(0, 150));
    state.errorCount = (state.errorCount || 0) + 1;
    const backoff = Math.min(state.errorCount * 3 * 60 * 1000, 20 * 60 * 1000);
    console.log(`[AutoLinkNews] ⏳ Backoff: ${Math.round(backoff / 60000)} min`);
    linkTimer = setTimeout(runLinkCycle, backoff);
    return;
  }

  // Schedule next — 15 min ± 90 sec jitter
  const jitter = (Math.random() - 0.5) * 2 * 90000;
  linkTimer = setTimeout(runLinkCycle, INTERVAL + jitter);
  console.log('[AutoLinkNews] ⏱️ Next link post in ~15 min');
}

function startAutoLinkNews(api) {
  globalApi     = api;
  state.enabled = true;
  persist();
  const firstDelay = 15000 + Math.random() * 15000;
  linkTimer = setTimeout(runLinkCycle, firstDelay);
  console.log(`[AutoLinkNews] ✅ Started — every 15 min | First in ${Math.round(firstDelay / 1000)}s`);
}

function stopAutoLinkNews() {
  if (linkTimer) { clearTimeout(linkTimer); linkTimer = null; }
  state.enabled = false;
  persist();
  console.log('[AutoLinkNews] 🛑 Stopped');
}

// ── Module exports ────────────────────────────────────────────────────────────
module.exports.config = {
  name:            'autolinknews',
  version:         VERSION,
  hasPermssion:    2,
  credits:         TEAM,
  description:     'Auto-posts PH news LINKS to Facebook WALL every 15 min. Facebook shows thumbnail preview like GMA News. FREE, no API key.',
  commandCategory: 'Admin',
  usages:          '[on | off | status]',
  cooldowns:       5,
};

module.exports.onLoad = function ({ api }) {
  loadPersistedState();
  if (state.enabled) {
    globalApi = api;
    console.log('[AutoLinkNews] 🔄 Restored — resuming link news cycle...');
    setTimeout(() => startAutoLinkNews(api), 8000);
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P   = global.config?.PREFIX || '!';
  const sub = (args[0] || '').toLowerCase();

  if (!sub || sub === 'help') {
    return api.sendMessage(
      `╔═══════════════════════════════╗\n` +
      `║  🔗 ${bold('AUTOLINKNEWS v' + VERSION)}      ║\n` +
      `║  🏷️  ${bold(TEAM)}   ║\n` +
      `╚═══════════════════════════════╝\n\n` +
      `📺 ${bold('Auto-posts PH News LINKS sa Facebook WALL!')}\n` +
      `🖼️ ${bold('Facebook auto-generates link preview card')}\n` +
      `   (Thumbnail + Title + Description — tulad ng GMA News!)\n\n` +
      `📡 ${bold('SOURCES (FREE, no API key):')}\n` +
      `  📺 GMA News   📰 PhilStar   📰 Inquirer\n` +
      `  📺 CNN PH     📡 Rappler    ⚽ GMA Sports\n\n` +
      `📋 ${bold('COMMANDS:')}\n${'─'.repeat(32)}\n` +
      `${P}autolinknews on      — I-start\n` +
      `${P}autolinknews off     — I-stop\n` +
      `${P}autolinknews status  — Status\n\n` +
      `📊 ${bold('STATUS:')}\n` +
      `  • ${bold('State:')}       ${state.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
      `  • ${bold('Interval:')}    Every 15 minutes\n` +
      `  • ${bold('Total posts:')} ${state.count}\n` +
      `  • ${bold('Seen cache:')}  ${seenLinks.size} links\n` +
      (state.lastPostedAt ? `  • ${bold('Last post:')}   ${new Date(state.lastPostedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}\n` : '') +
      `\n💡 ${bold('HOW IT WORKS:')}\n` +
      `  Kapag nag-post ng article link sa Facebook,\n` +
      `  auto-generate ang link card — Mukha, headline,\n` +
      `  at description — tulad ng GMA News posts! 🇵🇭\n\n` +
      `🔒 ${bold('Admin only')} | Posts to Facebook WALL`,
      threadID, messageID
    );
  }

  if (sub === 'on') {
    if (state.enabled) return api.sendMessage(`⚠️ ${bold('Naka-ON na ang AutoLinkNews.')}\nI-stop: ${P}autolinknews off`, threadID, messageID);
    startAutoLinkNews(api);
    return api.sendMessage(
      `✅ ${bold('AUTOLINKNEWS v' + VERSION + ' — STARTED! 🇵🇭')}\n\n` +
      `🔗 ${bold('PH News Links sa Facebook WALL — 24/7!')}\n` +
      `🖼️ ${bold('Facebook auto-generates link preview with thumbnail')}\n` +
      `⏱️ ${bold('Every 15 minutes')}\n` +
      `📡 ${bold('Sources:')} GMA · PhilStar · Inquirer · CNN PH · Rappler\n\n` +
      `🕒 ${bold('First post in ~15–30 seconds...')}\n` +
      `💡 I-stop: ${P}autolinknews off\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  if (sub === 'off') {
    if (!state.enabled) return api.sendMessage(`⚠️ ${bold('Hindi naman naka-ON ang AutoLinkNews.')}\nI-start: ${P}autolinknews on`, threadID, messageID);
    stopAutoLinkNews();
    return api.sendMessage(
      `🛑 ${bold('AUTOLINKNEWS — STOPPED!')}\n\n` +
      `Hindi na mag-po-post ng news links.\n` +
      `📊 Total posts: ${bold(String(state.count))}\n` +
      `💡 I-on ulit: ${P}autolinknews on`,
      threadID, messageID
    );
  }

  if (sub === 'status') {
    return api.sendMessage(
      `📊 ${bold('AUTOLINKNEWS v' + VERSION + ' STATUS')}\n${'─'.repeat(32)}\n` +
      `  • ${bold('State:')}       ${state.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
      `  • ${bold('Posts to:')}    Facebook Wall/Timeline\n` +
      `  • ${bold('Frequency:')}   Every 15 minutes\n` +
      `  • ${bold('Format:')}      News link → FB auto-thumbnail\n` +
      `  • ${bold('Total posts:')} ${state.count}\n` +
      `  • ${bold('Errors:')}      ${state.errorCount || 0}\n` +
      `  • ${bold('Seen cache:')}  ${seenLinks.size} links\n` +
      `  • ${bold('Last post:')}   ${state.lastPostedAt ? new Date(state.lastPostedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'N/A'}\n` +
      `\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  return api.sendMessage(`❓ ${P}autolinknews [on|off|status]`, threadID, messageID);
};
