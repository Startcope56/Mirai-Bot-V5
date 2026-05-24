/**
 * !sms — Free SMS sending + Phonebook contacts management
 * Uses TextBelt (FREE — no paid API key, key='textbelt')
 * Phonebook: save custom name+number pairs, send SMS to them
 * REST API: bot exposes /api/sms endpoint (no auth needed)
 *
 * Usage:
 *   !sms list                  — List all saved contacts
 *   !sms add [name] [number]   — Add a contact
 *   !sms delete [name]         — Delete a contact
 *   !sms send [name] [message] — Send SMS to a contact
 *   !sms send [+639XX] [msg]   — Send SMS direct to number
 *   !sms balance               — Check remaining free SMS credits
 */

const axios  = require('axios');
const fs     = require('fs-extra');
const path   = require('path');
const http   = require('http');
const bold   = require('../../utils/bold');

const VERSION  = '1.0.0';
const TEAM     = 'TEAM STARTCOPE BETA';
const DATA_DIR = path.join(process.cwd(), 'utils/data');
const CONTACTS_FILE = path.join(DATA_DIR, 'sms_contacts.json');
fs.ensureDirSync(DATA_DIR);

// ── Default contacts (pre-populated) ─────────────────────────────────────────
const DEFAULT_CONTACTS = [
  { name: '95.1 HOME RADIO',  number: '+639178951951', note: 'DZMB Home Radio Manila' },
  { name: 'DWRR 92.3',        number: '+639189231234', note: 'DWRR Magic 92.3 Manila' },
  { name: 'DZRH 666 AM',      number: '+639176661234', note: 'DZRH News Radio Manila' },
  { name: 'PAGASA',           number: '+6328284524',   note: 'PAGASA weather hotline' },
  { name: 'NDRRMC',           number: '+6328911406',   note: 'NDRRMC emergency' },
  { name: 'RED CROSS PH',     number: '+63143436474',  note: 'Philippine Red Cross' },
];

// ── Load / save contacts ──────────────────────────────────────────────────────
function loadContacts() {
  try {
    if (!fs.existsSync(CONTACTS_FILE)) {
      fs.writeFileSync(CONTACTS_FILE, JSON.stringify(DEFAULT_CONTACTS, null, 2));
    }
    const data = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
    return Array.isArray(data) ? data : DEFAULT_CONTACTS;
  } catch {
    return [...DEFAULT_CONTACTS];
  }
}

function saveContacts(contacts) {
  try { fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2)); } catch {}
}

function findContact(nameOrNumber, contacts) {
  const q = nameOrNumber.toLowerCase().replace(/\s+/g, ' ').trim();
  return contacts.find(c =>
    c.name.toLowerCase().includes(q) ||
    c.number.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
  ) || null;
}

// ── Format PH phone number ────────────────────────────────────────────────────
function formatPHNumber(raw) {
  const digits = raw.replace(/\D/g, '');
  // 09XXXXXXXXX → +639XXXXXXXXX
  if (digits.startsWith('09') && digits.length === 11) return '+63' + digits.slice(1);
  // 639XXXXXXXXX → +639XXXXXXXXX
  if (digits.startsWith('63') && digits.length === 12) return '+' + digits;
  // Already has +63
  if (raw.startsWith('+63')) return raw;
  // Short landline (02XXXXXXXX)
  if (digits.startsWith('02')) return '+63' + digits.slice(1);
  // Fallback
  if (digits.length >= 10) return '+63' + digits.slice(-10);
  return raw;
}

// ── Send SMS via TextBelt (FREE — key='textbelt' = 1 free/day) ───────────────
async function sendSMS(toNumber, message) {
  const formatted = formatPHNumber(toNumber);
  // TextBelt: POST https://textbelt.com/text
  // key='textbelt' is the FREE tier identifier — 1 SMS/day per IP
  const res = await axios.post('https://textbelt.com/text', {
    phone:   formatted,
    message: message.slice(0, 160),
    key:     'textbelt',
  }, { timeout: 15000 });
  return res.data;
}

// ── Check SMS balance via TextBelt ────────────────────────────────────────────
async function checkBalance() {
  const res = await axios.get('https://textbelt.com/quota/textbelt', { timeout: 10000 });
  return res.data;
}

// ── REST API server (no auth needed) ─────────────────────────────────────────
let apiServer = null;
const API_PORT = 5050;

function startSmsApiServer() {
  if (apiServer) return;
  apiServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const url  = new URL(req.url, `http://localhost:${API_PORT}`);
    const path = url.pathname;

    // GET /api/sms/contacts — list all contacts
    if (req.method === 'GET' && path === '/api/sms/contacts') {
      const contacts = loadContacts();
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true, contacts, total: contacts.length }));
    }

    // POST /api/sms/contacts — add contact: {name, number}
    if (req.method === 'POST' && path === '/api/sms/contacts') {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', () => {
        try {
          const { name, number } = JSON.parse(body);
          if (!name || !number) { res.writeHead(400); return res.end(JSON.stringify({ ok: false, error: 'name and number required' })); }
          const contacts = loadContacts();
          contacts.push({ name, number: formatPHNumber(number), note: 'Added via API' });
          saveContacts(contacts);
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, message: `Contact ${name} saved` }));
        } catch { res.writeHead(400); res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' })); }
      });
      return;
    }

    // POST /api/sms/send — send SMS: {name_or_number, message}
    if (req.method === 'POST' && path === '/api/sms/send') {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', async () => {
        try {
          const { to, message } = JSON.parse(body);
          if (!to || !message) { res.writeHead(400); return res.end(JSON.stringify({ ok: false, error: 'to and message required' })); }
          const contacts = loadContacts();
          const contact  = findContact(to, contacts);
          const number   = contact ? contact.number : formatPHNumber(to);
          const result   = await sendSMS(number, message);
          res.writeHead(200);
          res.end(JSON.stringify({ ok: result.success, to: number, name: contact?.name, result }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // DELETE /api/sms/contacts/:name — delete contact
    if (req.method === 'DELETE' && path.startsWith('/api/sms/contacts/')) {
      const name = decodeURIComponent(path.replace('/api/sms/contacts/', ''));
      const contacts = loadContacts();
      const filtered = contacts.filter(c => c.name.toLowerCase() !== name.toLowerCase());
      saveContacts(filtered);
      res.writeHead(200);
      return res.end(JSON.stringify({ ok: true, message: `Deleted contact: ${name}` }));
    }


    res.writeHead(404);
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  });

  apiServer.listen(API_PORT, '0.0.0.0', () => {
    console.log(`[SMS API] 📡 REST API running on port ${API_PORT} — no auth required`);
    console.log(`[SMS API] 🔗 GET /api/sms/contacts | POST /api/sms/send`);
  });

  apiServer.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`[SMS API] Port ${API_PORT} in use — API server skipped`);
    }
  });
}

// ── PH time greeting ──────────────────────────────────────────────────────────
function phGreeting() {
  const h = (new Date().getUTCHours() + 8) % 24;
  if (h >= 5  && h < 12) return 'Magandang umaga';
  if (h >= 12 && h < 18) return 'Magandang hapon';
  if (h >= 18 && h < 22) return 'Magandang gabi';
  return 'Magandang hatinggabi';
}

// ── Module config ─────────────────────────────────────────────────────────────
module.exports.config = {
  name:            'sms',
  version:         VERSION,
  hasPermssion:    1,
  credits:         TEAM,
  description:     'Free SMS sender + Phonebook contacts. Uses TextBelt (no paid API key). REST API on port 5050.',
  commandCategory: 'Utility',
  usages:          'list | add [name] [number] | delete [name] | send [name/number] [message] | balance',
  cooldowns:       5,
};

module.exports.onLoad = function ({ api }) {
  loadContacts();
  startSmsApiServer();
  console.log(`[SMS] ✅ SMS command loaded — ${loadContacts().length} contacts in phonebook`);
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P   = global.config?.PREFIX || '!';
  const sub = (args[0] || '').toLowerCase();

  // ── HELP ──────────────────────────────────────────────────────────────────
  if (!sub || sub === 'help') {
    const contacts = loadContacts();
    return api.sendMessage(
      `╔═══════════════════════════════╗\n` +
      `║  📱 ${bold('SMS COMMAND v' + VERSION)}        ║\n` +
      `║  🏷️  ${bold(TEAM)}   ║\n` +
      `╚═══════════════════════════════╝\n\n` +
      `📲 ${bold('FREE SMS — Walang bayad na API key!')}\n` +
      `📒 ${bold('Phonebook:')} ${contacts.length} contacts saved\n` +
      `🌐 ${bold('REST API:')} Port 5050 (walang auth)\n\n` +
      `📋 ${bold('COMMANDS:')}\n${'─'.repeat(35)}\n` +
      `${P}sms list                    — Lahat ng contacts\n` +
      `${P}sms add [name] [number]     — Mag-save ng contact\n` +
      `${P}sms delete [name]           — Burahin ang contact\n` +
      `${P}sms send [name] [message]   — Mag-send ng SMS\n` +
      `${P}sms send [+639XX] [message] — Direct sa number\n` +
      `${P}sms balance                 — Remaining SMS credits\n\n` +
      `📡 ${bold('REST API (no auth):')}\n` +
      `  GET  :5050/api/sms/contacts\n` +
      `  POST :5050/api/sms/send {to, message}\n` +
      `  POST :5050/api/sms/contacts {name, number}\n\n` +
      `💡 ${bold('Halimbawa:')}\n` +
      `${P}sms send 95.1 HOME RADIO Kumusta po!\n` +
      `${P}sms add Naga City Hall +6295430000\n\n` +
      `🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (sub === 'list') {
    const contacts = loadContacts();
    if (!contacts.length) {
      return api.sendMessage(`📒 ${bold('Walang contact na saved.')}\n💡 ${P}sms add [name] [number]`, threadID, messageID);
    }
    const lines = contacts.map((c, i) =>
      `${String(i + 1).padStart(2, ' ')}. ${bold(c.name)}\n    📞 ${c.number}${c.note ? `\n    💬 ${c.note}` : ''}`
    ).join('\n\n');
    return api.sendMessage(
      `📒 ${bold('SMS PHONEBOOK')} — ${contacts.length} contacts\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${lines}\n\n` +
      `💡 ${P}sms send [name] [message]\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  // ── ADD ───────────────────────────────────────────────────────────────────
  if (sub === 'add') {
    // Find where number starts (last word that looks like a phone number)
    const rest = args.slice(1);
    const numIdx = rest.findIndex(w => /^[+0-9]/.test(w) && w.replace(/\D/g, '').length >= 7);
    if (numIdx === -1) {
      return api.sendMessage(
        `❌ ${bold('Kulang ang info.')}\n💡 Gamitin:\n${P}sms add [name] [number]\n\nHalimbawa:\n${P}sms add 95.1 HOME RADIO +639178951951`,
        threadID, messageID
      );
    }
    const name   = rest.slice(0, numIdx).join(' ').trim();
    const number = formatPHNumber(rest[numIdx]);
    if (!name) {
      return api.sendMessage(`❌ Lagyan ng pangalan. Halimbawa: ${P}sms add Radio Station +63912345678`, threadID, messageID);
    }
    const contacts = loadContacts();
    const existing = contacts.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing !== -1) {
      contacts[existing].number = number;
      saveContacts(contacts);
      return api.sendMessage(`✅ ${bold('Na-update:')} ${name}\n📞 ${number}`, threadID, messageID);
    }
    contacts.push({ name, number, note: `Added by bot on ${new Date().toLocaleDateString('fil-PH', { timeZone: 'Asia/Manila' })}` });
    saveContacts(contacts);
    return api.sendMessage(
      `✅ ${bold('Na-save ang contact!')}\n📛 ${bold(name)}\n📞 ${number}\n\n💡 I-send: ${P}sms send ${name} [message]`,
      threadID, messageID
    );
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (sub === 'delete' || sub === 'remove') {
    const name     = args.slice(1).join(' ').trim();
    const contacts = loadContacts();
    const idx      = contacts.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
    if (idx === -1) {
      return api.sendMessage(`❌ Hindi makita ang "${name}" sa phonebook.\n💡 ${P}sms list para makita ang lahat.`, threadID, messageID);
    }
    contacts.splice(idx, 1);
    saveContacts(contacts);
    return api.sendMessage(`🗑️ ${bold('Na-delete:')} ${name}`, threadID, messageID);
  }

  // ── BALANCE ───────────────────────────────────────────────────────────────
  if (sub === 'balance' || sub === 'quota') {
    try {
      const data = await checkBalance();
      return api.sendMessage(
        `📊 ${bold('SMS BALANCE (TextBelt)')}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `  • ${bold('Remaining:')} ${data.quotaRemaining ?? data.quota ?? 'N/A'} SMS\n` +
        `  • ${bold('Provider:')} TextBelt (key=textbelt)\n` +
        `  • ${bold('Free tier:')} 1 SMS/araw\n\n` +
        `💡 Limitado ang free tier. Para sa mas maraming SMS,\n` +
        `   bumili ng credits sa textbelt.com`,
        threadID, messageID
      );
    } catch (e) {
      return api.sendMessage(`❌ Hindi ma-check ang balance: ${e.message?.slice(0, 80)}`, threadID, messageID);
    }
  }

  // ── SEND ──────────────────────────────────────────────────────────────────
  if (sub === 'send') {
    const rest = args.slice(1);
    if (rest.length < 2) {
      return api.sendMessage(
        `❌ ${bold('Kulang ang info.')}\n💡 Gamitin:\n` +
        `${P}sms send [contact name] [message]\n` +
        `${P}sms send [+639XX] [message]\n\nHalimbawa:\n` +
        `${P}sms send 95.1 HOME RADIO Kumusta! Request po ng kanta.\n` +
        `${P}sms send +639171234567 Helo! Kumusta ka?`,
        threadID, messageID
      );
    }

    const contacts = loadContacts();

    // Try matching a contact name first (check 1..N words)
    let contactMatch = null;
    let msgStart     = 1;
    for (let n = Math.min(rest.length - 1, 5); n >= 1; n--) {
      const candidate = rest.slice(0, n).join(' ');
      const found     = findContact(candidate, contacts);
      if (found) { contactMatch = found; msgStart = n; break; }
    }

    // If no contact match, first arg must be a number
    let toNumber;
    let contactName;
    if (contactMatch) {
      toNumber    = contactMatch.number;
      contactName = contactMatch.name;
    } else {
      const rawNum = rest[0];
      if (!/^[+0-9]/.test(rawNum)) {
        return api.sendMessage(
          `❌ Hindi makita ang contact "${rawNum}".\n💡 ${P}sms list para sa lahat ng contacts.`,
          threadID, messageID
        );
      }
      toNumber    = formatPHNumber(rawNum);
      contactName = toNumber;
    }

    const message = rest.slice(msgStart).join(' ').trim();
    if (!message) {
      return api.sendMessage(`❌ Walang mensahe. ${P}sms send [name] [message]`, threadID, messageID);
    }

    api.setMessageReaction('📤', messageID, () => {}, true);
    api.sendMessage(
      `📤 ${bold('Nagse-send ng SMS...')}\n📞 To: ${contactName}\n💬 "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}"`,
      threadID
    );

    try {
      const result = await sendSMS(toNumber, message);
      if (result.success) {
        api.setMessageReaction('✅', messageID, () => {}, true);
        return api.sendMessage(
          `✅ ${bold('Na-send ang SMS!')}\n\n` +
          `📞 ${bold('To:')} ${contactName}\n` +
          `💬 ${bold('Message:')} "${message.slice(0, 100)}"\n` +
          `📊 ${bold('Quota left:')} ${result.quotaRemaining ?? 'N/A'} SMS\n\n` +
          `${phGreeting()}! 🇵🇭 — Mula sa ${bold(TEAM)}`,
          threadID, messageID
        );
      } else {
        throw new Error(result.error || result.message || 'SMS send failed');
      }
    } catch (e) {
      api.setMessageReaction('❌', messageID, () => {}, true);
      const errMsg = e.message?.toLowerCase() || '';
      let hint = '';
      if (errMsg.includes('quota') || errMsg.includes('exceeded')) {
        hint = '\n💡 Naubos na ang free quota ngayon. Bukas na muli!';
      } else if (errMsg.includes('invalid')) {
        hint = '\n💡 Siguraduhing tama ang number format: +639XXXXXXXXX';
      }
      return api.sendMessage(
        `❌ ${bold('Hindi na-send ang SMS.')}\n🔧 ${e.message?.slice(0, 100)}${hint}`,
        threadID, messageID
      );
    }
  }

  return api.sendMessage(
    `❓ Hindi kilala ang command.\n💡 Gamitin: ${P}sms list / add / delete / send / balance`,
    threadID, messageID
  );
};
