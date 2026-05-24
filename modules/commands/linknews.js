'use strict';
/**
 * !linknews [keyword | latest]
 * Gumawa ng shareable HOME OF NEWS link na may magandang page + image + balita
 */

const axios = require('axios');
const fs    = require('fs-extra');
const path  = require('path');
const bold  = require('../../utils/bold');

const DATA_DIR   = path.join(process.cwd(), 'utils/data');
const LINKS_FILE = path.join(DATA_DIR, 'news_links.json');
fs.ensureDirSync(DATA_DIR);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

const RSS_FEEDS = [
  { name: 'PhilStar',        url: 'https://www.philstar.com/rss/headlines' },
  { name: 'Rappler',         url: 'https://www.rappler.com/rss/' },
  { name: 'Inquirer',        url: 'https://newsinfo.inquirer.net/feed' },
  { name: 'GMA News',        url: 'https://www.gmanetwork.com/news/rss/news.xml' },
  { name: 'CNN Philippines', url: 'https://cnnphilippines.com/rss/rss.html' },
  { name: 'PhilStar Nation', url: 'https://www.philstar.com/rss/nation' },
  { name: 'ABS-CBN',        url: 'https://news.abs-cbn.com/list/rss' },
];

function parseRSS(xml, source) {
  const items = [];
  const blocks = xml.split(/<item|<entry/);
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    const get = (tag) => {
      const cdata = b.match(new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`));
      if (cdata) return cdata[1].trim();
      const plain = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return plain ? plain[1].replace(/<[^>]+>/g, '').trim() : '';
    };
    const title = get('title');
    const link  = get('link') || b.match(/<link[^>]+href="([^"]+)"/)?.[1] || '';
    const desc  = (get('description') || get('summary') || get('content') || '').slice(0, 600);
    const thumb =
      b.match(/url="([^"]+\.(jpg|jpeg|png|webp))"/i)?.[1] ||
      b.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] ||
      b.match(/<enclosure[^>]+url="([^"]+\.(jpg|jpeg|png))"/i)?.[1] || '';
    const pubDate = get('pubDate') || get('published') || get('updated') || '';
    if (title && title.length > 4)
      items.push({ title, link, desc: desc.replace(/<[^>]+>/g, '').trim(), thumb, pubDate, source });
  }
  return items;
}

async function fetchAllNews() {
  const all = [];
  await Promise.all(RSS_FEEDS.map(async (f) => {
    try {
      const { data } = await axios.get(f.url, { timeout: 10000, headers: { 'User-Agent': UA } });
      for (const item of parseRSS(data, f.name)) all.push(item);
    } catch {}
  }));
  return all;
}

function searchNews(items, keyword) {
  if (!keyword || keyword === 'latest') return items.slice(0, 1);
  const kw = keyword.toLowerCase();
  const scored = items.map(it => {
    let score = 0;
    const titleL = it.title.toLowerCase();
    const descL  = (it.desc || '').toLowerCase();
    if (titleL.includes(kw)) score += 3;
    if (descL.includes(kw))  score += 1;
    return { ...it, score };
  }).filter(it => it.score > 0).sort((a, b) => b.score - a.score);
  return scored.length ? scored.slice(0, 1) : [];
}

function genId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function saveLink(id, data) {
  let links = {};
  try { links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')); } catch {}
  links[id] = { ...data, createdAt: Date.now() };
  const keys = Object.keys(links);
  if (keys.length > 1000) {
    const oldest = keys.sort((a, b) => (links[a].createdAt || 0) - (links[b].createdAt || 0)).slice(0, keys.length - 1000);
    for (const k of oldest) delete links[k];
  }
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links));
}

function getBaseUrl() {
  const dev  = process.env.REPLIT_DEV_DOMAIN;
  const slug = process.env.REPL_SLUG;
  if (dev)  return `https://${dev}`;
  if (slug) return `https://${slug}.repl.co`;
  return 'http://localhost:5000';
}

// ── Config ────────────────────────────────────────────────────────────────────
module.exports.config = {
  name:            'linknews',
  version:         '1.0.0',
  hasPermssion:    0,
  credits:         'TEAM STARTCOPE BETA',
  description:     'Gumawa ng shareable HOME OF NEWS link na may magandang page, image, at balita',
  commandCategory: 'News',
  usages:          '[keyword | latest]',
  cooldowns:       8,
};

// ── Run ───────────────────────────────────────────────────────────────────────
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P       = global.config?.PREFIX || '!';
  const keyword = args.join(' ').trim() || 'latest';

  if (args[0] === 'help' || args[0] === '-h') {
    return api.sendMessage(
      `🔴 ${bold('HOME OF NEWS — LINKNEWS')}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📰 Gumawa ng shareable link ng balita na may:\n` +
      `  ✅ Magandang news page (dark red theme)\n` +
      `  ✅ Larawan ng balita\n` +
      `  ✅ Buong headline at detalye\n` +
      `  ✅ HOME OF NEWS branding\n` +
      `  ✅ Open Graph para sa Facebook/Messenger preview\n\n` +
      `📋 ${bold('PAANO GAMITIN:')}\n` +
      `${P}linknews            — Pinakabagong balita\n` +
      `${P}linknews latest     — Pinakabagong balita\n` +
      `${P}linknews [keyword]  — Mag-search ng topic\n\n` +
      `📍 ${bold('MGA HALIMBAWA:')}\n` +
      `${P}linknews bagyo\n` +
      `${P}linknews duterte\n` +
      `${P}linknews earthquake\n` +
      `${P}linknews sports\n` +
      `${P}linknews naga city\n\n` +
      `🏷️ ${bold('TEAM STARTCOPE BETA')} 🇵🇭`,
      threadID, messageID
    );
  }

  api.setMessageReaction('⏳', messageID, () => {}, true);
  api.sendMessage(
    `🔍 Naghahanap ng balita${keyword !== 'latest' ? ` tungkol sa "${keyword}"` : ''}...\n` +
    `📰 Gagawa ng HOME OF NEWS link. Sandali lang!`,
    threadID
  );

  try {
    const allNews = await fetchAllNews();
    const results = searchNews(allNews, keyword);

    if (!results.length) {
      api.setMessageReaction('❌', messageID, () => {}, true);
      return api.sendMessage(
        `❌ ${bold('Walang nahanap na balita')} tungkol sa "${keyword}".\n\n` +
        `💡 Subukan:\n${P}linknews latest\n${P}linknews bagyo\n${P}linknews sports`,
        threadID, messageID
      );
    }

    const article = results[0];
    const id      = genId();
    const base    = getBaseUrl();
    const link    = `${base}/news/${id}`;

    saveLink(id, {
      title:        article.title,
      desc:         article.desc  || '',
      thumb:        article.thumb || '',
      source:       article.source,
      originalLink: article.link   || '',
      pubDate:      article.pubDate || '',
      keyword,
    });

    const now = new Date().toLocaleString('fil-PH', {
      timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
    });

    api.setMessageReaction('✅', messageID, () => {}, true);
    api.sendMessage(
      `🔴 ${bold('HOME OF NEWS')} 📰\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📰 ${bold(article.title)}\n\n` +
      (article.desc ? `📝 ${article.desc.slice(0, 200)}...\n\n` : '') +
      `📡 Source: ${bold(article.source)}\n` +
      `📅 ${now} (PH Time)\n\n` +
      `🔗 ${bold('I-click ang link para makita ang buong balita:')}\n` +
      `${link}\n\n` +
      `💡 I-share ang link sa grupo o sa mga kaibigan!\n` +
      `🏷️ ${bold('TEAM STARTCOPE BETA')} · HOME OF NEWS 🇵🇭`,
      threadID, messageID
    );

  } catch (e) {
    api.setMessageReaction('❌', messageID, () => {}, true);
    api.sendMessage(
      `❌ ${bold('Nabigo ang linknews.')}\n🔧 ${e.message?.slice(0, 120)}\n\n` +
      `💡 Subukan ulit: ${P}linknews latest`,
      threadID, messageID
    );
  }
};
