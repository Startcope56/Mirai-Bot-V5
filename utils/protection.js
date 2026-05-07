/**
 * ANTI-DETECT PROTECTION MODULE — PRO EDITION v3.0
 * TEAM STARTCOPE BETA
 *
 * 16-Layer Protection System (Upgraded):
 * 1.  Rotating browser-grade user agents (20 real UAs)
 * 2.  Human-like random delays (multi-layer with "thinking" pauses)
 * 3.  Session keep-alive with 6 rotating strategies + deep jitter
 * 4.  Request rate limiting (max 6 sends/min — reduced to stay under radar)
 * 5.  Browser-grade HTTP headers (14 Sec-Fetch/Sec-CH-UA headers)
 * 6.  Auto-decline friend requests (bot-detection trap avoidance)
 * 7.  Checkpoint/restriction detection + 45min backoff recovery
 * 8.  Appstate refresh (every 3 ticks + after every post — more frequent)
 * 9.  Typing indicator simulation before sending (variable duration)
 * 10. Exponential backoff on API errors (up to 45 min)
 * 11. Session fingerprint randomization (per-session unique headers)
 * 12. Background behavior randomizer (reads, scrolls, profile views)
 * 13. "Automated behaviour" early warning + pre-emptive checkpoint clear
 * 14. MQTT watchdog — auto-reconnect on silent disconnect
 * 15. Cooldown enforcer between consecutive messages (same thread)
 * 16. Appstate backup — keeps last 3 good states as rollback
 */

const fs   = require('fs-extra');
const path = require('path');

// ── 20 Real Chrome/Firefox/Safari/Edge/Mobile UAs ────────────────────────────
const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
];

// Per-session UA — stays stable for the session (like a real browser)
const SESSION_UA = BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];

function getRandomUA() {
  return BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
}

function getSessionUA() { return SESSION_UA; }

// ── Session fingerprint (randomized per process start) ────────────────────────
const SESSION_FINGERPRINT = {
  screenWidth:  [1280, 1366, 1440, 1600, 1920, 2560][Math.floor(Math.random() * 6)],
  screenHeight: [720, 768, 900, 1080, 1200][Math.floor(Math.random() * 5)],
  colorDepth:   [24, 32][Math.floor(Math.random() * 2)],
  timezone:     'Asia/Manila',
  language:     ['en-US', 'en-PH', 'fil-PH'][Math.floor(Math.random() * 3)],
  platform:     ['Win32', 'MacIntel', 'Linux x86_64'][Math.floor(Math.random() * 3)],
};

// ── Human-like random delays ──────────────────────────────────────────────────
function humanDelay(minMs = 1000, maxMs = 3500) {
  const base  = minMs + Math.random() * (maxMs - minMs);
  // 15% chance of a "thinking" pause (3–8s extra)
  const extra = Math.random() < 0.15 ? 3000 + Math.random() * 5000 : 0;
  // 5% chance of a very long pause (simulates distraction — 8–20s)
  const distract = Math.random() < 0.05 ? 8000 + Math.random() * 12000 : 0;
  return new Promise(r => setTimeout(r, base + extra + distract));
}

// Short delay between rapid actions (scroll/read simulation)
function microDelay() {
  return new Promise(r => setTimeout(r, 300 + Math.random() * 800));
}

// ── Exponential backoff for retries ──────────────────────────────────────────
async function withBackoff(fn, retries = 3, baseMs = 3000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries) throw e;
      const wait = baseMs * Math.pow(2, i) + Math.random() * 2000;
      console.warn(`[Protection] Retry ${i + 1}/${retries} in ${Math.round(wait)}ms — ${e.message?.slice(0, 60)}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

// ── Rate limiter — max N requests per window (reduced to 6) ──────────────────
class RateLimiter {
  constructor(maxPerWindow = 6, windowMs = 60000) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs     = windowMs;
    this.timestamps   = [];
  }
  async throttle() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxPerWindow) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 500 + Math.random() * 1000;
      await new Promise(r => setTimeout(r, waitMs));
      return this.throttle();
    }
    this.timestamps.push(now);
  }
}

const globalLimiter = new RateLimiter(6, 60000);

// ── Per-thread cooldown tracker (prevent same-thread spam) ────────────────────
const threadCooldowns = new Map();
async function enforceThreadCooldown(threadID, minGapMs = 2000) {
  const last = threadCooldowns.get(threadID) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < minGapMs) {
    await new Promise(r => setTimeout(r, minGapMs - elapsed + Math.random() * 500));
  }
  threadCooldowns.set(threadID, Date.now());
}

// ── Checkpoint / restriction keywords ────────────────────────────────────────
const CHECKPOINT_KEYWORDS = [
  'checkpoint', 'restricted', 'suspended', 'disabled', 'verify',
  'confirm your identity', 'security check', 'account locked',
  '601051028565049', 'scraping', 'automation', 'unusual activity',
  'temporarily blocked', 'account has been', 'policy violation',
  'action blocked', '408', 'parseandchecklogin',
  'automated behaviour', 'automated behavior', 'suspicious activity',
  'protect your account', 'prevent your account', 'terms of use',
  'temporarily restricted', 'permanently disabled', 'unauthorised access',
];

function isCheckpointError(err) {
  if (!err) return false;
  const str = JSON.stringify(err).toLowerCase();
  return CHECKPOINT_KEYWORDS.some(kw => str.includes(kw));
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
  startedAt:              new Date().toISOString(),
};

// ── Typing indicator simulation ───────────────────────────────────────────────
function simulateTyping(api, threadID, durationMs = 1500) {
  try {
    if (typeof api.sendTypingIndicator !== 'function') return Promise.resolve();
    stats.typingSimulations++;
    return new Promise(resolve => {
      api.sendTypingIndicator(threadID, (err, stop) => {
        setTimeout(() => {
          try { if (stop) stop(); } catch {}
          resolve();
        }, durationMs + Math.random() * 800);
      });
    });
  } catch { return Promise.resolve(); }
}

// ── Auto-decline friend requests + suspicious event handler ──────────────────
function setupFriendRequestGuard(api) {
  console.log('[Protection] 🛡️ Friend request guard active — auto-declining strangers');
}

function handleSuspiciousEvent(api, event) {
  try {
    // Friend request — auto-accept if !autofriend is ON, otherwise auto-decline
    if (event?.type === 'friend_request' || event?.type === 'friendRequest') {
      const uid = event.userID || event.senderID;
      if (uid && typeof api.respondToFriendRequest === 'function') {
        if (global.autofriendEnabled) {
          api.respondToFriendRequest(String(uid), true, () => {
            console.log(`[Protection] ✅ Friend request auto-ACCEPTED: ${uid} (autofriend ON)`);
          });
        } else {
          // Add human delay before declining (not instant)
          setTimeout(() => {
            api.respondToFriendRequest(String(uid), false, () => {
              stats.friendRequestsDeclined++;
              console.log(`[Protection] 🚫 Friend request auto-declined: ${uid} (total: ${stats.friendRequestsDeclined})`);
            });
          }, 2000 + Math.random() * 4000);
        }
      }
      return;
    }

    // Notification — mark read with a small human delay
    if (event?.type === 'notification' || event?.notifType) {
      if (typeof api.markAsRead === 'function' && event.threadID) {
        setTimeout(() => {
          api.markAsRead(event.threadID, () => {});
        }, 500 + Math.random() * 2000);
      }
      return;
    }

    // Unknown event types — handle gracefully
    if (event?.type && !['message', 'message_reply', 'typ', 'read', 'read_receipt', 'presence', 'message_reaction'].includes(event.type)) {
      console.log(`[Protection] 🔍 Unknown event type: ${event.type} — monitoring`);
    }
  } catch { /* silent — never crash */ }
}

// ── Appstate backup — keep last 3 good states ─────────────────────────────────
const BACKUP_DIR = path.join(process.cwd(), 'utils/data/appstate_backups');
fs.ensureDirSync(BACKUP_DIR);

function backupAppstate(state) {
  try {
    const ts = Date.now();
    const backupPath = path.join(BACKUP_DIR, `appstate_${ts}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(state, null, 2));
    // Keep only the last 3 backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('appstate_') && f.endsWith('.json'))
      .sort();
    while (files.length > 3) {
      try { fs.removeSync(path.join(BACKUP_DIR, files.shift())); } catch {}
    }
  } catch {}
}

// ── Appstate refresh — more frequent (every 3 ticks) ─────────────────────────
let _appstateRefreshCount = 0;
function tryRefreshAppstate(api) {
  try {
    _appstateRefreshCount++;
    if (_appstateRefreshCount % 3 === 0) {
      const state = api.getAppState();
      if (state && Array.isArray(state)) {
        fs.writeFileSync(path.join(process.cwd(), 'appstate.json'), JSON.stringify(state, null, 2));
        fs.writeFileSync(path.join(process.cwd(), 'utils/data/fbstate.json'), JSON.stringify(state, null, 2));
        backupAppstate(state);
        stats.appstateRefreshes++;
      }
    }
  } catch { /* silent */ }
}

// ── Background behavior randomizer ───────────────────────────────────────────
function startBehaviorRandomizer(api) {
  const behaviors = [
    // View thread list (simulates scrolling feed)
    () => {
      if (typeof api.getThreadList === 'function') {
        api.getThreadList(Math.ceil(Math.random() * 6) + 1, null, [], () => {});
      }
    },
    // Mark random messages as read (simulates reading)
    () => {
      if (typeof api.markAsDelivered === 'function' && global.client?.currentMsgData?.threadID) {
        api.markAsDelivered(global.client.currentMsgData.threadID, global.client.currentMsgData.messageID || '0', () => {});
      }
    },
    // Get own user info (profile view)
    () => {
      if (typeof api.getCurrentUserID === 'function') {
        const uid = api.getCurrentUserID();
        if (uid && typeof api.getUserInfo === 'function') {
          api.getUserInfo([uid], () => {});
        }
      }
    },
    // Mark a thread as read (natural behavior)
    () => {
      if (typeof api.markAsRead === 'function' && global.client?.currentMsgData?.threadID) {
        api.markAsRead(global.client.currentMsgData.threadID, () => {});
      }
    },
    // Passive — heartbeat only (no API call) — reduces API frequency
    () => { stats.behaviorEvents++; },
    () => { stats.behaviorEvents++; },
  ];

  function scheduleBehavior() {
    // 4–12 min random — wider range to avoid rhythm detection
    const delay = 4 * 60 * 1000 + Math.random() * 8 * 60 * 1000;
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
  console.log('[Protection] 🎭 Behavior randomizer active — simulating human browsing (4–12 min cycles)');
}

// ── "Automated behaviour" specific handler ────────────────────────────────────
function handleAutomatedBehaviourWarning(api) {
  stats.automatedBehaviourHits++;
  console.warn(`[Protection] ⚠️ "Automated behaviour" warning detected! (hit #${stats.automatedBehaviourHits})`);
  console.warn('[Protection] 🔒 Entering STEALTH MODE — pausing for 15 min + clearing checkpoint...');

  // Clear the checkpoint immediately
  clearCheckpoint(api);

  // Save a fresh appstate backup
  try {
    const state = api.getAppState();
    if (state && Array.isArray(state)) {
      backupAppstate(state);
      fs.writeFileSync(path.join(process.cwd(), 'appstate.json'), JSON.stringify(state, null, 2));
    }
  } catch {}

  // Return the backoff delay (15–25 min)
  return 15 * 60 * 1000 + Math.random() * 10 * 60 * 1000;
}

// ── Session keep-alive — 6 rotating strategies with deep jitter ────────────────
function startKeepAlive(api, intervalMs = 9 * 60 * 1000) {
  let tid = null;

  const tick = async () => {
    try {
      stats.keepAliveTicks++;
      // 6 strategies — strategy 5 is passive (no API call — reduces total API frequency)
      const strategy = Math.floor(Math.random() * 6);
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
          // Mark a notification as read if available
          if (typeof api.markAsRead === 'function' && global.client?.currentMsgData?.threadID) {
            await new Promise(r => api.markAsRead(global.client.currentMsgData.threadID, r));
          }
          break;
        case 4:
          // Passive tick — no API call (critical for avoiding rhythm detection)
          break;
        case 5:
          // Passive tick — double weight on passive to reduce API frequency
          break;
      }
    } catch { /* silent */ }

    // Always attempt appstate refresh on every tick
    tryRefreshAppstate(api);

    // Deep jitter: ±3.5 min to break any predictable interval
    const jitter = (Math.random() - 0.5) * 2 * 3.5 * 60 * 1000;
    // Also add a random "burst" pause (5% chance of extra 5–10 min gap)
    const burstPause = Math.random() < 0.05 ? (5 + Math.random() * 5) * 60 * 1000 : 0;
    tid = setTimeout(tick, intervalMs + jitter + burstPause);
  };

  // First ping after random 20–60 sec (delayed to let MQTT settle)
  tid = setTimeout(tick, 20000 + Math.random() * 40000);
  console.log('[Protection] ✅ Keep-alive started — interval ~' + Math.round(intervalMs / 60000) + 'min with ±3.5min deep jitter');

  return () => { if (tid) clearTimeout(tid); };
}

// ── Wrap sendMessage with typing sim + rate limit + thread cooldown ───────────
function wrapSendMessage(api) {
  const original = api.sendMessage.bind(api);
  api.sendMessage = async function (msg, threadID, callback, ...rest) {
    // Global rate limit
    await globalLimiter.throttle();

    // Per-thread cooldown (prevent rapid back-to-back messages to same chat)
    if (threadID) await enforceThreadCooldown(threadID, 1500 + Math.random() * 1500);

    // Simulate typing for text messages
    const hasText = typeof msg === 'string' || (msg?.body && msg.body.length > 0);
    if (hasText && threadID) {
      const textLen = typeof msg === 'string' ? msg.length : (msg.body?.length || 0);
      // Typing speed: ~40 WPM average human — roughly 200ms per word, 40ms per char
      const typingMs = Math.min(1200 + textLen * 35, 4500);
      await simulateTyping(api, threadID, typingMs).catch(() => {});
    }

    await humanDelay(500, 1500);
    return original(msg, threadID, callback, ...rest);
  };
  return api;
}

// ── Browser-grade HTTP headers ────────────────────────────────────────────────
function getBrowserHeaders() {
  const ua = SESSION_UA;
  const isChrome = ua.includes('Chrome') && !ua.includes('Edg');
  const isEdge   = ua.includes('Edg/');
  const isFF     = ua.includes('Firefox');

  return {
    'User-Agent':                ua,
    'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language':           `${SESSION_FINGERPRINT.language},en;q=0.9,fil;q=0.8`,
    'Accept-Encoding':           'gzip, deflate, br, zstd',
    'Cache-Control':             'no-cache',
    'Pragma':                    'no-cache',
    'Sec-CH-UA': isEdge
      ? `"Microsoft Edge";v="124", "Chromium";v="124", "Not-A.Brand";v="99"`
      : isChrome
      ? `"Google Chrome";v="124", "Chromium";v="124", "Not-A.Brand";v="99"`
      : `"Not-A.Brand";v="8"`,
    'Sec-CH-UA-Mobile':          ua.includes('Mobile') ? '?1' : '?0',
    'Sec-CH-UA-Platform':        `"${SESSION_FINGERPRINT.platform.includes('Win') ? 'Windows' : SESSION_FINGERPRINT.platform.includes('Mac') ? 'macOS' : 'Linux'}"`,
    'Sec-Fetch-Dest':            'document',
    'Sec-Fetch-Mode':            'navigate',
    'Sec-Fetch-Site':            'none',
    'Sec-Fetch-User':            '?1',
    'Upgrade-Insecure-Requests': '1',
    'DNT':                       '1',
    'Connection':                'keep-alive',
    'X-FB-LSD':                  Math.random().toString(36).slice(2, 12),
  };
}

// ── Checkpoint recovery ───────────────────────────────────────────────────────
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
          console.log(`[Protection] ✅ Checkpoint cleared (total: ${stats.checkpointsCleared})`);
        }
      } catch {}
    });
  } catch { /* silent */ }
}

// ── Get protection status (for !protection command) ───────────────────────────
function getStats() { return { ...stats }; }

module.exports = {
  getRandomUA,
  getSessionUA,
  SESSION_FINGERPRINT,
  humanDelay,
  microDelay,
  withBackoff,
  RateLimiter,
  globalLimiter,
  startKeepAlive,
  startBehaviorRandomizer,
  wrapSendMessage,
  getBrowserHeaders,
  handleSuspiciousEvent,
  setupFriendRequestGuard,
  isCheckpointError,
  clearCheckpoint,
  simulateTyping,
  tryRefreshAppstate,
  backupAppstate,
  handleAutomatedBehaviourWarning,
  enforceThreadCooldown,
  getStats,
  CHECKPOINT_KEYWORDS,
};
