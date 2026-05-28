// DRIAN Economy Helper — Power Inc
const ITEMS = [
  { id: "pickaxe",   name: "⛏️ Pickaxe",    price: 800,   desc: "Increases work earnings by 30%" },
  { id: "laptop",    name: "💻 Laptop",      price: 2000,  desc: "Doubles work earnings" },
  { id: "shield",    name: "🛡️ Shield",      price: 1500,  desc: "Protects 50% of wallet from robbery" },
  { id: "mask",      name: "🎭 Robber Mask", price: 1200,  desc: "Increases robbery success rate" },
  { id: "briefcase", name: "💼 Briefcase",   price: 3000,  desc: "Doubles bank interest" },
  { id: "lucky",     name: "🍀 Lucky Charm", price: 2500,  desc: "Boosts all game luck by 15%" },
  { id: "vip",       name: "👑 VIP Card",    price: 5000,  desc: "All cooldowns reduced by 25%" }
];

const WORK_JOBS = [
  { title: "Programmer", emoji: "💻", min: 200, max: 500 },
  { title: "Doctor",     emoji: "👨‍⚕️", min: 350, max: 700 },
  { title: "Chef",       emoji: "👨‍🍳", min: 150, max: 400 },
  { title: "Teacher",    emoji: "👨‍🏫", min: 180, max: 380 },
  { title: "Engineer",   emoji: "👷", min: 250, max: 600 },
  { title: "Artist",     emoji: "🎨", min: 100, max: 350 },
  { title: "Driver",     emoji: "🚗", min: 120, max: 300 },
  { title: "Farmer",     emoji: "🌾", min: 100, max: 280 },
  { title: "Pilot",      emoji: "✈️", min: 400, max: 800 },
  { title: "Scientist",  emoji: "🔬", min: 300, max: 650 },
];

const CRIME_ACTIONS = [
  { action: "robbed a bank",      emoji: "🏦", risk: 0.45, min: 800,  max: 2500 },
  { action: "pickpocketed someone", emoji: "👝", risk: 0.35, min: 200, max: 600 },
  { action: "hacked a server",    emoji: "💻", risk: 0.50, min: 1000, max: 3000 },
  { action: "ran a scam",         emoji: "📱", risk: 0.40, min: 600,  max: 1800 },
  { action: "forged documents",   emoji: "📄", risk: 0.38, min: 500,  max: 1500 },
  { action: "smuggled goods",     emoji: "📦", risk: 0.55, min: 1200, max: 3500 },
];

function fmt(n) {
  if (n === undefined || n === null) n = 0;
  return Number(n).toLocaleString("en-US");
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cdFmt(ms) {
  if (ms <= 0) return "now";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60), rm = m % 60;
  return `${h}h ${rm}m`;
}

async function getEco(Currencies, userID) {
  let row = await Currencies.getData(userID);
  if (!row) {
    await Currencies.createData(userID, {
      money: 500,
      data: { bank: 0, lastDaily: 0, lastWork: 0, lastCrime: 0, lastRob: 0, inventory: [] }
    });
    row = await Currencies.getData(userID);
  }
  if (!row.data || typeof row.data !== "object") row.data = {};
  if (!row.data.bank)      row.data.bank = 0;
  if (!row.data.lastDaily) row.data.lastDaily = 0;
  if (!row.data.lastWork)  row.data.lastWork  = 0;
  if (!row.data.lastCrime) row.data.lastCrime = 0;
  if (!row.data.lastRob)   row.data.lastRob   = 0;
  if (!Array.isArray(row.data.inventory)) row.data.inventory = [];
  return row;
}

async function saveEco(Currencies, userID, money, data) {
  await Currencies.setData(userID, { money: Math.max(0, Math.round(money)), data });
}

function hasItem(eco, itemId) {
  return eco.data.inventory.includes(itemId);
}

module.exports = { ITEMS, WORK_JOBS, CRIME_ACTIONS, fmt, rand, cdFmt, getEco, saveEco, hasItem };
