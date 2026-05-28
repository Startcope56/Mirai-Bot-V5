/**
 * DRIAN FCA — Anti-Detection Layer v1.0
 * Power Inc
 *
 * Wraps the Facebook Chat API with:
 *  • Per-send human delay (jitter)
 *  • Rate limiting (max 5 sends / minute)
 *  • Header randomizer per request
 *  • Stealth mode auto-pause on suspicious signals
 *  • Typing simulation before every message
 */

const UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1",
];

const LANG_POOL = [
  "en-US,en;q=0.9,fil;q=0.8",
  "en-US,en;q=0.9",
  "fil-PH,fil;q=0.9,en;q=0.8",
  "en-GB,en;q=0.9,en-US;q=0.8",
];

let sendCount = 0;
let windowStart = Date.now();
let stealthUntil = 0;
const MAX_PER_MIN = 5;

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function randomHeaders() {
  return {
    "User-Agent":        UA_POOL[rand(0, UA_POOL.length - 1)],
    "Accept-Language":   LANG_POOL[rand(0, LANG_POOL.length - 1)],
    "Sec-Ch-Ua-Mobile":  Math.random() > 0.8 ? "?1" : "?0",
    "X-FB-LSD":          Math.random().toString(36).slice(2, 14),
  };
}

async function rateLimitCheck() {
  const now = Date.now();
  if (now - windowStart >= 60000) { sendCount = 0; windowStart = now; }
  if (sendCount >= MAX_PER_MIN) {
    const wait = 60000 - (now - windowStart) + rand(500, 2000);
    console.log(`[DRIAN FCA] Rate limit — waiting ${Math.ceil(wait / 1000)}s`);
    await sleep(wait);
    sendCount = 0; windowStart = Date.now();
  }
  sendCount++;
}

async function humanDelay(textLength = 0) {
  const base = rand(900, 2800);
  const typing = Math.min(textLength * 30, 3000);
  await sleep(base + typing);
}

async function stealthCheck() {
  const now = Date.now();
  if (now < stealthUntil) {
    const wait = stealthUntil - now;
    console.log(`[DRIAN FCA] Stealth mode — ${Math.ceil(wait / 60000)}m remaining`);
    await sleep(wait);
  }
}

function enterStealth(minutes = 20) {
  stealthUntil = Date.now() + minutes * 60000;
  console.warn(`[DRIAN FCA] ⚠️ Stealth mode activated — ${minutes} minutes`);
}

/**
 * Wraps api.sendMessage with full DRIAN FCA protection.
 * Drop-in replacement for api.sendMessage.
 */
async function safeSend(api, msg, threadID, callback, messageID) {
  try {
    await stealthCheck();
    await rateLimitCheck();
    const textLen = typeof msg === "string" ? msg.length : (msg.body?.length || 50);
    await humanDelay(textLen);

    // Typing indicator
    try { await new Promise(r => api.sendTypingIndicator(threadID, r)); } catch {}
    await sleep(rand(300, 800));

    return api.sendMessage(msg, threadID, callback, messageID);
  } catch (e) {
    const errMsg = (e.message || "").toLowerCase();
    if (errMsg.includes("automated") || errMsg.includes("restricted") || errMsg.includes("checkpoint")) {
      enterStealth(rand(15, 25));
    }
    throw e;
  }
}

module.exports = { safeSend, enterStealth, randomHeaders, humanDelay, sleep, rand };
