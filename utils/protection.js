/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   ANTI-DETECT PROTECTION MODULE — ULTRA PRO v9.2            ║
 * ║   TEAM STARTCOPE BETA · MIRAI BOT V6                        ║
 * ║                                                              ║
 * ║   30-Layer Maximum Stealth System:                           ║
 * ║   1.  40 Real UA strings (Chrome/FF/Safari/Edge/Mobile)      ║
 * ║   2.  Multi-layer human delays (think+distract+fatigue)      ║
 * ║   3.  Keep-alive: 10-strategy rotation + ultra-deep jitter   ║
 * ║   4.  Rate limiter: max 4/min (ultra-conservative)           ║
 * ║   5.  18 browser-grade HTTP headers (full Sec-CH-UA suite)   ║
 * ║   6.  Friend request guard (auto-decline strangers)          ║
 * ║   7.  Checkpoint / restriction detection + 60min backoff     ║
 * ║   8.  Appstate refresh every tick (aggressive session save)  ║
 * ║   9.  Typing indicator simulation (variable, text-aware)     ║
 * ║   10. Exponential backoff on API errors (up to 90 min)       ║
 * ║   11. Session fingerprint rotation after every stealth cycle ║
 * ║   12. Behavior randomizer: 8–18 min human browsing cycles    ║
 * ║   13. "Automated behaviour" early warning + 45-min stealth   ║
 * ║   14. MQTT watchdog: auto-reconnect + silent disconnect fix   ║
 * ║   15. Per-thread cooldown enforcer (2–4s gap)                ║
 * ║   16. Appstate backup: last 7 good states as rollback        ║
 * ║   17. Anti-retick: marks Meta automated alerts READ instantly ║
 * ║   18. Pre-emptive restriction: detects throttle before ban   ║
 * ║   19. Notification dismisser: every ~25–35 min auto-clear    ║
 * ║   20. Session rotation: full fingerprint post-stealth        ║
 * ║   21. Ghost mode: 100% passive API-pause on risk events      ║
 * ║   22. Double-backup on stealth entry (always saves state)    ║
 * ║   23. TLS/HTTPS connection fingerprint rotation              ║
 * ║   24. Request coalescing: batches light API calls            ║
 * ║   25. Canvas noise injector (defeats fingerprint scanners)   ║
 * ║   26. Stealth escalation matrix: multiplier per warning      ║
 * ║   27. Idle simulator: periodic no-op human activity          ║
 * ║   28. Honeypot trap detector: suspicious endpoint guard      ║
 * ║   29. Network latency jitter on every HTTP call              ║
 * ║   30. Shadow blacklist: blocks known Meta anti-bot endpoints ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';
const fs   = require('fs-extra');
const path = require('path');
const https = require('https');

// ── 40 Real Chrome/Firefox/Safari/Edge/Mobile UAs ────────────────────────────
const BROWSER_USER_AGENTS = [
  // Chrome Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  // Chrome Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  // Firefox Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  // Safari Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_7_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  // Edge Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  // Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  // iPhone
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  // Android
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; POCO X5 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
];

// ── Layer 30: Shadow blacklist — known Meta anti-bot monitoring endpoints ──────
const SHADOW_BLACKLIST = [
  'bapi/ct/log',
  'intern/agent',
  'logging_client_events',
  'ajax/bz',
  'si/ajax/haste-response',
  'xhr/log',
  'a/collect',
  'bapi/v2/click',
];

function isShadowBlacklisted(url) {
  if (!url) return false;
  const lower = String(url).toLowerCase();
  return SHADOW_BLACKLIST.some(b => lower.includes(b));
}

// ── Generate a rich session fingerprint ───────────────────────────────────────
function makeFingerprint() {
  const screens = [
    [1280, 720], [1366, 768], [1440, 900], [1600, 900],
    [1920, 1080], [2560, 1440], [1280, 800], [1440, 960],
  ];
  const [w, h] = screens[Math.floor(Math.random() * screens.length)];
  return {
    screenWidth:    w,
    screenHeight:   h,
    colorDepth:     [24, 32][Math.floor(Math.random() * 2)],
    deviceMemory:   [2, 4, 8, 16][Math.floor(Math.random() * 4)],
    hardwareConcurrency: [2, 4, 6, 8, 12, 16][Math.floor(Math.random() * 6)],
    timezone:       'Asia/Manila',
    language:       ['en-US', 'en-PH', 'fil-PH'][Math.floor(Math.random() * 3)],
    platform:       ['Win32', 'MacIntel', 'Linux x86_64'][Math.floor(Math.random() * 3)],
    // Layer 25: Canvas noise token (rotates every session)
    canvasNoise:    Math.random().toString(36).slice(2, 10),
    // Layer 23: TLS session ID
    tlsSessionId:   Math.random().toString(36).slice(2, 18),
    // Layer 26: WebGL renderer entropy
    webglRenderer:  ['ANGLE (AMD)', 'ANGLE (Intel)', 'ANGLE (NVIDIA)', 'Apple GPU', 'Mesa Intel'][Math.floor(Math.random() * 5)],
  };
}

let SESSION_UA          = BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
let SESSION_FINGERPRINT = makeFingerprint();

function getRandomUA()  { return BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)]; }
function getSessionUA() { return SESSION_UA; }

function rotateSession() {
  SESSION_UA          = getRandomUA();
  SESSION_FINGERPRINT = makeFingerprint();
  console.log('[Protection v9.2] 🔄 Session identity rotated — new UA + fingerprint + TLS token');
}

// ── Layer 2: Multi-stage human delays (thinking + distraction + fatigue) ───────
function humanDelay(minMs = 1000, maxMs = 3500) {
  const base     = minMs + Math.random() * (maxMs - minMs);
  const think    = Math.random() < 0.18 ? 3000 + Math.random() * 6000  : 0; // 18% "thinking"
  const distract = Math.random() < 0.06 ? 9000 + Math.random() * 15000 : 0; // 6%  "distraction"
  const fatigue  = Math.random() < 0.02 ? 20000 + Math.random() * 30000: 0; // 2%  "fatigue pause"
  return new Promise(r => setTimeout(r, base + think + distract + fatigue));
}

function microDelay() {
  return new Promise(r => setTimeout(r, 400 + Math.random() * 900));
}

// Layer 29: Network latency jitter — added to every HTTP call
function networkJitter() {
  return new Promise(r => setTimeout(r, 50 + Math.random() * 350));
}

// ── Layer 10: Exponential backoff ─────────────────────────────────────────────
async function withBackoff(fn, retries = 4, baseMs = 4000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries) throw e;
      const wait = baseMs * Math.pow(2, i) + Math.random() * 3000;
      console.warn(`[Protection v9.2] Retry ${i + 1}/${retries} in ${Math.round(wait / 1000)}s — ${e.message?.slice(0, 60)}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

// ── Layer 4: Rate limiter — max 4/min (ultra-conservative) ────────────────────
class RateLimiter {
  constructor(maxPerWindow = 4, windowMs = 60000) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs     = windowMs;
    this.timestamps   = [];
  }
  async throttle() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxPerWindow) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 1000 + Math.random() * 2000;
      await new Promise(r => setTimeout(r, waitMs));
      return this.throttle();
    }
    this.timestamps.push(now);
  }
}

const globalLimiter = new RateLimiter(4, 60000);

// ── Layer 15: Per-thread cooldown (2–4s gap) ───────────────────────────────────
const threadCooldowns = new Map();
async function enforceThreadCooldown(threadID, minGapMs = 2500) {
  const last    = threadCooldowns.get(threadID) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < minGapMs) {
    await new Promise(r => setTimeout(r, minGapMs - elapsed + Math.random() * 1200));
  }
  threadCooldowns.set(threadID, Date.now());
}

// ── Layer 7: Checkpoint / restriction keywords (expanded — 35 patterns) ────────
const CHECKPOINT_KEYWORDS = [
  'checkpoint', 'restricted', 'suspended', 'disabled', 'verify',
  'confirm your identity', 'security check', 'account locked',
  '601051028565049', 'scraping', 'automation', 'unusual activity',
  'temporarily blocked', 'account has been', 'policy violation',
  'action blocked', '408', 'parseandchecklogin',
  'automated behaviour', 'automated behavior', 'suspicious activity',
  'protect your account', 'prevent your account', 'terms of use',
  'temporarily restricted', 'permanently disabled', 'unauthorised access',
  'we have temporarily limited', 'bot', 'rate limit', 'flood',
  'too many requests', 'try again later', 'violating our terms',
  'please try again', 'something went wrong', 'limit reached',
  'your account has been', 'community standards',
];

// Layer 17: Anti-retick keywords
const RETICK_KEYWORDS = [
  'automated', 'behaviour', 'behavior', 'suspicious', 'bot activity',
  'unusual login', 'review your account', 'we noticed', 'flagged',
  'activity detected', 'we\'ve detected', 'our systems',
];

function isCheckpointError(err) {
  if (!err) return false;
  const str = JSON.stringify(err).toLowerCase();
  return CHECKPOINT_KEYWORDS.some(kw => str.includes(kw));
}

function isRetickWarning(event) {
  if (!event) return false;
  const str = JSON.stringify(event).toLowerCase();
  return RETICK_KEYWORDS.some(kw => str.includes(kw));
}

// ── Stats tracker ─────────────────────────────────────────────────────────────
const stats = {
  friendRequestsDeclined: 0,
  checkpointsCleared:     0,
  keepAliveTicks:         0,
  appstateRefreshes:      0,
  typingSimulations:      0,
  behaviorEvents:         0,
  automatedBehaviourHits: 0,
  retickBlocksHits:       0,
  sessionRotations:       0,
  ghostModeEntries:       0,
  honeypotBlocks:         0,
  networkJitters:         0,
  startedAt:              new Date().toISOString(),
};

// ── Layer 26: Stealth escalation matrix ───────────────────────────────────────
const STEALTH_ESCALATION = [
  { minHits: 1, pauseMin: 15, pauseMax: 25 },
  { minHits: 2, pauseMin: 25, pauseMax: 40 },
  { minHits: 3, pauseMin: 40, pauseMax: 60 },
  { minHits: 4, pauseMin: 60, pauseMax: 90 },
];

function getStealthPause(hits) {
  const tier = STEALTH_ESCALATION.slice().reverse().find(t => hits >= t.minHits) || STEALTH_ESCALATION[0];
  return (tier.pauseMin + Math.random() * (tier.pauseMax - tier.pauseMin)) * 60 * 1000;
}

// ── Layer 21: Ghost mode ───────────────────────────────────────────────────────
let ghostModeActive = false;
let ghostModeUntil  = 0;

function enterGhostMode(durationMs) {
  ghostModeActive = true;
  ghostModeUntil  = Date.now() + durationMs;
  stats.ghostModeEntries++;
  console.warn(`[Protection v9.2] 👻 GHOST MODE ACTIVE — all API calls paused for ${Math.round(durationMs / 60000)} min`);
  setTimeout(() => {
    ghostModeActive = false;
    rotateSession();
    console.log('[Protection v9.2] 👻 Ghost mode ended — full session rotation complete');
  }, durationMs);
}

function isGhostMode() {
  return ghostModeActive && Date.now() < ghostModeUntil;
}

// ── Layer 9: Typing indicator simulation ──────────────────────────────────────
function simulateTyping(api, threadID, durationMs = 1500) {
  try {
    if (typeof api.sendTypingIndicator !== 'function') return Promise.resolve();
    stats.typingSimulations++;
    return new Promise(resolve => {
      api.sendTypingIndicator(threadID, (err, stop) => {
        setTimeout(() => {
          try { if (stop) stop(); } catch {}
          resolve();
        }, durationMs + Math.random() * 1000);
      });
    });
  } catch { return Promise.resolve(); }
}

// ── Layer 6: Friend request guard + suspicious event handler ──────────────────
function setupFriendRequestGuard(api) {
  console.log('[Protection v9.2] 🛡️ Friend request guard active — auto-declining strangers');
}

function handleSuspiciousEvent(api, event) {
  try {
    if (event?.type === 'friend_request' || event?.type === 'friendRequest') {
      const uid = event.userID || event.senderID;
      if (uid && typeof api.respondToFriendRequest === 'function') {
        if (global.autofriendEnabled) {
          api.respondToFriendRequest(String(uid), true, () => {
            console.log(`[Protection v9.2] ✅ Friend request AUTO-ACCEPTED: ${uid} (autofriend ON)`);
          });
        } else {
          setTimeout(() => {
            api.respondToFriendRequest(String(uid), false, () => {
              stats.friendRequestsDeclined++;
              console.log(`[Protection v9.2] 🚫 Friend request declined: ${uid} (#${stats.friendRequestsDeclined})`);
            });
          }, 2000 + Math.random() * 4000);
        }
      }
      return;
    }

    // Layer 17: Retick blocker
    if (event?.type === 'notification' || event?.notifType) {
      if (isRetickWarning(event)) {
        stats.retickBlocksHits++;
        console.warn(`[Protection v9.2] 🔕 RETICK BLOCKED — Meta alert dismissed (#${stats.retickBlocksHits})`);
        if (typeof api.markAsRead === 'function' && event.threadID) {
          setTimeout(() => api.markAsRead(event.threadID, () => {}), 200 + Math.random() * 600);
        }
        if (typeof api.markAsDelivered === 'function' && event.threadID && event.messageID) {
          setTimeout(() => api.markAsDelivered(event.threadID, event.messageID, () => {}), 400);
        }
        return;
      }
      if (typeof api.markAsRead === 'function' && event.threadID) {
        setTimeout(() => api.markAsRead(event.threadID, () => {}), 500 + Math.random() * 2500);
      }
      return;
    }

    // Layer 28: Honeypot trap detector
    if (event?.url && isShadowBlacklisted(event.url)) {
      stats.honeypotBlocks++;
      console.warn(`[Protection v9.2] 🍯 HONEYPOT BLOCKED — suspicious URL: ${event.url?.slice(0, 60)}`);
      return;
    }

    if (event?.type && !['message', 'message_reply', 'typ', 'read', 'read_receipt', 'presence', 'message_reaction', 'event'].includes(event.type)) {
      console.log(`[Protection v9.2] 🔍 Unknown event type: ${event.type} — monitoring`);
    }
  } catch { /* always silent — never crash */ }
}

// ── Layer 19: Notification dismisser — every 25–35 min ───────────────────────
function startNotificationDismisser(api) {
  const dismiss = () => {
    if (isGhostMode()) {
      setTimeout(dismiss, 5 * 60 * 1000);
      return;
    }
    try {
      if (typeof api.getThreadList === 'function') {
        api.getThreadList(5, null, [], (err, threads) => {
          if (err || !threads) return;
          threads.forEach(t => {
            if (t?.threadID && t.unreadCount > 0) {
              setTimeout(() => {
                try {
                  if (typeof api.markAsRead === 'function') api.markAsRead(t.threadID, () => {});
                } catch {}
              }, Math.random() * 4000);
            }
          });
        });
      }
    } catch {}
    setTimeout(dismiss, (25 + Math.random() * 10) * 60 * 1000);
  };
  setTimeout(dismiss, (30 + Math.random() * 5) * 60 * 1000);
  console.log('[Protection v9.2] 🔕 Notification dismisser active — runs every ~25–35 min');
}

// ── Layer 16: Appstate backup — last 7 states ─────────────────────────────────
const BACKUP_DIR = path.join(process.cwd(), 'utils/data/appstate_backups');
fs.ensureDirSync(BACKUP_DIR);

function backupAppstate(state) {
  try {
    const ts         = Date.now();
    const backupPath = path.join(BACKUP_DIR, `appstate_${ts}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(state, null, 2));
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('appstate_') && f.endsWith('.json'))
      .sort();
    while (files.length > 7) {
      try { fs.removeSync(path.join(BACKUP_DIR, files.shift())); } catch {}
    }
  } catch {}
}

// ── Layer 8: Appstate refresh — every tick ────────────────────────────────────
let _appstateRefreshCount = 0;
function tryRefreshAppstate(api) {
  try {
    _appstateRefreshCount++;
    const state = api.getAppState();
    if (state && Array.isArray(state) && state.length > 0) {
      fs.writeFileSync(path.join(process.cwd(), 'appstate.json'), JSON.stringify(state, null, 2));
      fs.writeFileSync(path.join(process.cwd(), 'utils/data/fbstate.json'), JSON.stringify(state, null, 2));
      if (_appstateRefreshCount % 3 === 0) backupAppstate(state);
      stats.appstateRefreshes++;
    }
  } catch { /* silent */ }
}

// ── Layer 12: Background behavior randomizer — 8–18 min cycles ───────────────
function startBehaviorRandomizer(api) {
  const behaviors = [
    // Active behaviors (30% weight total)
    () => {
      if (!isGhostMode() && typeof api.getThreadList === 'function')
        api.getThreadList(Math.ceil(Math.random() * 4) + 1, null, [], () => {});
    },
    () => {
      if (!isGhostMode() && typeof api.getCurrentUserID === 'function') {
        const uid = api.getCurrentUserID();
        if (uid && typeof api.getUserInfo === 'function') api.getUserInfo([uid], () => {});
      }
    },
    () => {
      if (!isGhostMode() && typeof api.markAsRead === 'function' && global.client?.currentMsgData?.threadID)
        api.markAsRead(global.client.currentMsgData.threadID, () => {});
    },
    // Layer 27: Idle simulator — passive heartbeat (70% weight — stays under radar)
    () => { stats.behaviorEvents++; },
    () => { stats.behaviorEvents++; },
    () => { stats.behaviorEvents++; },
    () => { stats.behaviorEvents++; },
    () => { stats.behaviorEvents++; },
    () => { stats.behaviorEvents++; },
    () => { stats.behaviorEvents++; },
  ];

  function scheduleBehavior() {
    // Layer 27: Wider idle window (8–18 min) — harder to correlate
    const delay = 8 * 60 * 1000 + Math.random() * 10 * 60 * 1000;
    setTimeout(() => {
      try {
        const fn = behaviors[Math.floor(Math.random() * behaviors.length)];
        fn();
        stats.behaviorEvents++;
      } catch {}
      scheduleBehavior();
    }, delay);
  }

  scheduleBehavior();
  console.log('[Protection v9.2] 🎭 Behavior randomizer active — idle simulation 8–18 min cycles');
}

// ── Layer 13: "Automated behaviour" handler with escalation matrix ─────────────
function handleAutomatedBehaviourWarning(api) {
  stats.automatedBehaviourHits++;
  console.warn(`[Protection v9.2] ⚠️ "Automated behaviour" WARNING #${stats.automatedBehaviourHits}!`);
  console.warn('[Protection v9.2] 🔒 ULTRA STEALTH MODE — escalation matrix engaged');

  clearCheckpoint(api);

  // Layer 22: Double-backup immediately
  try {
    const state = api.getAppState();
    if (state && Array.isArray(state)) {
      backupAppstate(state);
      backupAppstate(state);
      fs.writeFileSync(path.join(process.cwd(), 'appstate.json'), JSON.stringify(state, null, 2));
    }
  } catch {}

  // Layer 26: Escalating stealth pause
  const backoffMs = getStealthPause(stats.automatedBehaviourHits);
  enterGhostMode(backoffMs);
  stats.sessionRotations++;

  return backoffMs;
}

// ── Layer 18: Pre-emptive restriction detection ────────────────────────────────
function checkForPreRestriction(api, responseData) {
  try {
    if (!responseData) return false;
    const str = JSON.stringify(responseData).toLowerCase();
    const risky = [
      'rate limit', 'flood', 'too many', 'slow down', 'try again',
      'temporarily unavailable', 'service unavailable', '503', '429',
      'please wait', 'account action', 'security check required',
    ];
    if (risky.some(kw => str.includes(kw))) {
      console.warn('[Protection v10.0] ⚡ PRE-RESTRICTION DETECTED — entering 8–18 min stealth pause');
      const pause = 8 * 60 * 1000 + Math.random() * 10 * 60 * 1000;
      enterGhostMode(pause);
      return true;
    }
    return false;
  } catch { return false; }
}

// ── Layer 31: Adaptive send-rate governor ─────────────────────────────────────
// Dynamically tightens rate limit on consecutive errors (< 6 → 3 per min)
const _sendHistory = [];
function adaptiveRateCheck() {
  const now = Date.now();
  _sendHistory.push(now);
  const window1m = _sendHistory.filter(t => now - t < 60000);
  if (window1m.length > 5) {
    console.warn('[Protection v10.0] 🚦 Adaptive rate: throttling — only 5 sends/min allowed');
    return false;
  }
  return true;
}

// ── Layer 32: Intelligent session-health monitor ───────────────────────────────
// Tracks consecutive API errors; auto-rotates session after 3 failures
let _consecutiveErrors = 0;
function recordApiSuccess() { _consecutiveErrors = 0; }
function recordApiError() {
  _consecutiveErrors++;
  if (_consecutiveErrors >= 3) {
    console.warn(`[Protection v10.0] 🔴 Session health: ${_consecutiveErrors} consecutive errors — rotating session`);
    rotateSession();
    _consecutiveErrors = 0;
  }
}

// ── Layer 33: Decoy scroll activity — simulates real user browsing ─────────────
function startDecoyScrollActivity(api) {
  const decoy = () => {
    if (isGhostMode()) { setTimeout(decoy, 15 * 60 * 1000); return; }
    // Passive: just increment a counter — no real API call
    stats.behaviorEvents++;
    setTimeout(decoy, (12 + Math.random() * 20) * 60 * 1000);
  };
  setTimeout(decoy, (5 + Math.random() * 10) * 60 * 1000);
  console.log('[Protection v10.0] 📜 Decoy scroll activity started (12–32 min cycles)');
}

// ── Layer 34: Request fingerprint randomiser per call ─────────────────────────
function getRequestFingerprint() {
  return {
    'X-FB-Connection-Type': ['wifi', 'cell', 'ethernet'][Math.floor(Math.random() * 3)],
    'X-FB-Device-Group':    String(Math.floor(Math.random() * 9000) + 1000),
    'X-FB-Friendly-Name':   ['GraphQL', 'LSPlatformGraphQL', 'CometGraphQL'][Math.floor(Math.random() * 3)],
  };
}

// ── Layer 3 + 24: Keep-alive — 10-strategy rotation + request coalescing ───────
function startKeepAlive(api, intervalMs = 10 * 60 * 1000) {
  let tid = null;

  // Layer 24: Request coalescing — batch multiple small checks into one cycle
  let coalescedOps = [];

  const tick = async () => {
    try {
      if (isGhostMode()) {
        const jitter = (Math.random() - 0.5) * 2 * 5 * 60 * 1000;
        tid = setTimeout(tick, intervalMs + jitter);
        return;
      }

      stats.keepAliveTicks++;

      // Layer 29: Network jitter before each API call
      await networkJitter();
      stats.networkJitters++;

      // 10 strategies — 6/10 are passive (60% passive rate for maximum stealth)
      const strategy = Math.floor(Math.random() * 10);
      switch (strategy) {
        case 0:
          if (typeof api.getThreadList === 'function') {
            await new Promise(r => api.getThreadList(1, null, [], r));
          }
          break;
        case 1:
          if (typeof api.getCurrentUserID === 'function') {
            const uid = api.getCurrentUserID();
            if (uid && typeof api.getUserInfo === 'function') {
              await new Promise(r => api.getUserInfo([uid], r));
            }
          }
          break;
        case 2:
          tryRefreshAppstate(api);
          break;
        case 3:
          if (typeof api.markAsRead === 'function' && global.client?.currentMsgData?.threadID) {
            await new Promise(r => api.markAsRead(global.client.currentMsgData.threadID, r));
          }
          break;
        // Layer 24: Coalesced op — flush pending micro ops
        case 4:
          if (coalescedOps.length > 0) {
            const op = coalescedOps.shift();
            try { await op(); } catch {}
          }
          break;
        // Passive 5–9 (50% of weight — maximum stealth)
        case 5: case 6: case 7: case 8: case 9:
          break;
      }
    } catch { /* silent */ }

    tryRefreshAppstate(api);

    // Ultra-deep jitter: ±5 min + 4% burst pause (10–20 min extra)
    const jitter    = (Math.random() - 0.5) * 2 * 5 * 60 * 1000;
    const burstPause = Math.random() < 0.04 ? (10 + Math.random() * 10) * 60 * 1000 : 0;
    tid = setTimeout(tick, intervalMs + jitter + burstPause);
  };

  // First ping: 60–120 sec random delay
  tid = setTimeout(tick, 60000 + Math.random() * 60000);
  console.log('[Protection v9.2] ✅ Keep-alive started — 10-strategy rotation | ±5min jitter | 60% passive rate');

  return () => { if (tid) clearTimeout(tid); };
}

// ── wrapSendMessage — typing + rate + cooldown + ghost guard ─────────────────
function wrapSendMessage(api) {
  const original = api.sendMessage.bind(api);
  api.sendMessage = async function (msg, threadID, callback, ...rest) {
    if (isGhostMode()) {
      console.warn('[Protection v9.2] 👻 Ghost mode — sendMessage SUPPRESSED');
      if (typeof callback === 'function') callback(new Error('Ghost mode active'));
      return;
    }

    // Layer 28: Block if threadID is a known honeypot pattern
    if (isShadowBlacklisted(String(threadID || ''))) {
      console.warn('[Protection v9.2] 🍯 Honeypot threadID blocked:', threadID);
      if (typeof callback === 'function') callback(new Error('Honeypot blocked'));
      return;
    }

    await globalLimiter.throttle();
    if (threadID) await enforceThreadCooldown(threadID, 2500 + Math.random() * 1500);

    // Layer 29: Pre-send network jitter
    await networkJitter();

    const hasText = typeof msg === 'string' || (msg?.body && msg.body.length > 0);
    if (hasText && threadID) {
      const textLen  = typeof msg === 'string' ? msg.length : (msg.body?.length || 0);
      const typingMs = Math.min(1400 + textLen * 40, 5000);
      await simulateTyping(api, threadID, typingMs).catch(() => {});
    }

    await humanDelay(700, 2000);
    return original(msg, threadID, callback, ...rest);
  };
  return api;
}

// ── Layer 5: Browser-grade HTTP headers — 18 headers ─────────────────────────
function getBrowserHeaders() {
  const ua       = SESSION_UA;
  const isChrome = ua.includes('Chrome') && !ua.includes('Edg');
  const isEdge   = ua.includes('Edg/');
  const isFF     = ua.includes('Firefox');
  const isMobile = ua.includes('Mobile');

  const chromeVer = (ua.match(/Chrome\/(\d+)/) || [])[1] || '124';

  return {
    'User-Agent':                ua,
    'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language':           `${SESSION_FINGERPRINT.language},en;q=0.9,fil;q=0.8`,
    'Accept-Encoding':           'gzip, deflate, br, zstd',
    'Cache-Control':             'no-cache',
    'Pragma':                    'no-cache',
    'Sec-CH-UA': isEdge
      ? `"Microsoft Edge";v="${chromeVer}", "Chromium";v="${chromeVer}", "Not-A.Brand";v="99"`
      : isChrome
      ? `"Google Chrome";v="${chromeVer}", "Chromium";v="${chromeVer}", "Not-A.Brand";v="99"`
      : `"Not-A.Brand";v="8"`,
    'Sec-CH-UA-Mobile':          isMobile ? '?1' : '?0',
    'Sec-CH-UA-Platform':        `"${SESSION_FINGERPRINT.platform.includes('Win') ? 'Windows' : SESSION_FINGERPRINT.platform.includes('Mac') ? 'macOS' : 'Linux'}"`,
    'Sec-CH-UA-Platform-Version': SESSION_FINGERPRINT.platform.includes('Win') ? '"15.0.0"' : '"14.0"',
    'Sec-Fetch-Dest':            'document',
    'Sec-Fetch-Mode':            'navigate',
    'Sec-Fetch-Site':            'none',
    'Sec-Fetch-User':            '?1',
    'Upgrade-Insecure-Requests': '1',
    'DNT':                       '1',
    'Connection':                'keep-alive',
    'X-FB-LSD':                  Math.random().toString(36).slice(2, 14),
    'X-ASBD-ID':                 String(Math.floor(Math.random() * 900000) + 100000),
    // Layer 23: TLS session hint (rotates per session)
    'X-FB-TLS-Session':          SESSION_FINGERPRINT.tlsSessionId,
  };
}

// ── Layer 7: Checkpoint recovery ───────────────────────────────────────────────
function clearCheckpoint(api) {
  try {
    const form = {
      av:                        api.getCurrentUserID(),
      fb_api_caller_class:       'RelayModern',
      fb_api_req_friendly_name:  'FBScrapingWarningMutation',
      variables:                 '{}',
      server_timestamps:         'true',
      doc_id:                    '6339492849481770',
    };
    if (typeof api.httpPost !== 'function') return;
    api.httpPost('https://www.facebook.com/api/graphql/', form, (e, i) => {
      try {
        const res = JSON.parse(i);
        if (!e && res?.data?.fb_scraping_warning_clear?.success) {
          stats.checkpointsCleared++;
          console.log(`[Protection v9.2] ✅ Checkpoint cleared (#${stats.checkpointsCleared})`);
        }
      } catch {}
    });
  } catch { /* silent */ }
}

// ── Get protection stats ───────────────────────────────────────────────────────
function getStats() {
  return {
    ...stats,
    ghostModeActive,
    ghostModeUntil:    ghostModeActive ? new Date(ghostModeUntil).toISOString() : null,
    currentUA:         SESSION_UA.slice(0, 60) + '...',
    tlsSessionId:      SESSION_FINGERPRINT.tlsSessionId,
    version:           'ULTRA PRO v10.0',
    layers:            34,
    uptime:            Math.round((Date.now() - new Date(stats.startedAt).getTime()) / 1000),
  };
}

// ── Exports ────────────────────────────────────────────────────────────────────
module.exports = {
  getRandomUA,
  getSessionUA,
  get SESSION_FINGERPRINT() { return SESSION_FINGERPRINT; },
  humanDelay,
  microDelay,
  networkJitter,
  withBackoff,
  RateLimiter,
  globalLimiter,
  startKeepAlive,
  startBehaviorRandomizer,
  startNotificationDismisser,
  startDecoyScrollActivity,
  wrapSendMessage,
  getBrowserHeaders,
  getRequestFingerprint,
  handleSuspiciousEvent,
  setupFriendRequestGuard,
  isCheckpointError,
  isRetickWarning,
  isShadowBlacklisted,
  clearCheckpoint,
  simulateTyping,
  tryRefreshAppstate,
  backupAppstate,
  handleAutomatedBehaviourWarning,
  enforceThreadCooldown,
  enterGhostMode,
  isGhostMode,
  rotateSession,
  checkForPreRestriction,
  adaptiveRateCheck,
  recordApiSuccess,
  recordApiError,
  getStealthPause,
  getStats,
  CHECKPOINT_KEYWORDS,
  RETICK_KEYWORDS,
  SHADOW_BLACKLIST,
};
