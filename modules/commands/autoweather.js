/**
 * !autoweather — Auto-posts live Philippines weather VIDEO to ALL group chats
 * Every 3 minutes · 24/7 walang tigil · FREE, no API key
 * Rotates through 50+ real Philippine cities
 * Posts VIDEO with Tagalog voice + background music to all GCs
 *
 * DIFFERENT from !automor:
 *   !automor  → posts to Facebook WALL/TIMELINE
 *   !autoweather → posts to ALL GROUP CHATS (sendMessage)
 */

const axios           = require('axios');
const fs              = require('fs-extra');
const path            = require('path');
const { exec }        = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const bold            = require('../../utils/bold');

const VERSION        = '1.0.0';
const TEAM           = 'TEAM STARTCOPE BETA';
const INTERVAL_MS    = 3 * 60 * 1000; // 3 minutes

const DATA_DIR   = path.join(process.cwd(), 'utils/data');
const STATE_FILE = path.join(DATA_DIR, 'autoweather_state.json');
const TEMP_DIR   = path.join(DATA_DIR, 'autoweather_temp');
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(TEMP_DIR);

// ── Comprehensive Philippine cities list ──────────────────────────────────────
const PH_LOCATIONS = [
  'Minalabac, Camarines Sur',
  'Naga City, Camarines Sur',
  'Masbate City, Masbate',
  'Manila, Metro Manila',
  'Quezon City, Metro Manila',
  'Makati City, Metro Manila',
  'Pasig City, Metro Manila',
  'Taguig City, Metro Manila',
  'Caloocan City, Metro Manila',
  'Marikina City, Metro Manila',
  'Malabon City, Metro Manila',
  'Navotas City, Metro Manila',
  'Pasay City, Metro Manila',
  'Parañaque City, Metro Manila',
  'Las Piñas City, Metro Manila',
  'Muntinlupa City, Metro Manila',
  'Valenzuela City, Metro Manila',
  'Cebu City, Cebu',
  'Lapu-Lapu City, Cebu',
  'Mandaue City, Cebu',
  'Davao City, Davao del Sur',
  'Baguio City, Benguet',
  'Cagayan de Oro, Misamis Oriental',
  'Iloilo City, Iloilo',
  'Zamboanga City, Zamboanga del Sur',
  'Bacolod City, Negros Occidental',
  'Antipolo City, Rizal',
  'Legazpi City, Albay',
  'Lucena City, Quezon',
  'Lipa City, Batangas',
  'Batangas City, Batangas',
  'San Fernando, Pampanga',
  'Tacloban City, Leyte',
  'General Santos City, South Cotabato',
  'Butuan City, Agusan del Norte',
  'Olongapo City, Zambales',
  'Dagupan City, Pangasinan',
  'San Jose del Monte, Bulacan',
  'Calamba City, Laguna',
  'Imus City, Cavite',
  'Bacoor City, Cavite',
  'Iligan City, Lanao del Norte',
  'Cotabato City, Maguindanao',
  'Cabanatuan City, Nueva Ecija',
  'San Fernando, La Union',
  'Vigan City, Ilocos Sur',
  'Laoag City, Ilocos Norte',
  'Tuguegarao City, Cagayan',
  'Puerto Princesa, Palawan',
  'Koronadal City, South Cotabato',
  'Surigao City, Surigao del Norte',
  'Pagadian City, Zamboanga del Sur',
  'Dipolog City, Zamboanga del Norte',
  'Dapitan City, Zamboanga del Norte',
  'Bislig City, Surigao del Sur',
  'Tandag City, Surigao del Sur',
  'Tagum City, Davao del Norte',
  'Panabo City, Davao del Norte',
  'Digos City, Davao del Sur',
  'Mati City, Davao Oriental',
  'Kidapawan City, Cotabato',
  'Kabacan, Cotabato',
  'Bayombong, Nueva Vizcaya',
  'Bontoc, Mountain Province',
  'Bangued, Abra',
  'Candon City, Ilocos Sur',
  'Alaminos City, Pangasinan',
  'Tayug, Pangasinan',
  'Palayan City, Nueva Ecija',
  'Gapan City, Nueva Ecija',
  'Tarlac City, Tarlac',
  'Malolos City, Bulacan',
  'Meycauayan City, Bulacan',
  'Balanga City, Bataan',
  'Orion, Bataan',
  'Cavite City, Cavite',
  'Tagaytay City, Cavite',
  'Trece Martires City, Cavite',
  'San Pablo City, Laguna',
  'Santa Cruz, Laguna',
  'Biñan City, Laguna',
  'Cabuyao City, Laguna',
  'Sta. Rosa City, Laguna',
  'Dasmariñas City, Cavite',
  'Cainta, Rizal',
  'Taytay, Rizal',
  'Angono, Rizal',
  'Morong, Rizal',
  'Tanay, Rizal',
  'Sorsogon City, Sorsogon',
  'Gubat, Sorsogon',
  'Bulan, Sorsogon',
  'Irosin, Sorsogon',
  'Polangui, Albay',
  'Tabaco City, Albay',
  'Daraga, Albay',
  'Pili, Camarines Sur',
  'Libmanan, Camarines Sur',
  'Sipocot, Camarines Sur',
  'Goa, Camarines Sur',
  'Iriga City, Camarines Sur',
  'Tigaon, Camarines Sur',
  'Magarao, Camarines Sur',
];

let locationIndex = 0;

function getNextLocation() {
  const loc = PH_LOCATIONS[locationIndex % PH_LOCATIONS.length];
  locationIndex++;
  return loc;
}

// ── State helpers ─────────────────────────────────────────────────────────────
function loadState() {
  try { return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}; }
  catch { return {}; }
}
function saveState(d) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(d, null, 2)); } catch {}
}

let state = { enabled: false, count: 0, lastPostedAt: null, lastLocation: null };

function loadPersistedState() {
  const s = loadState();
  if (s.enabled      !== undefined) state.enabled      = s.enabled;
  if (s.count        !== undefined) state.count        = s.count;
  if (s.lastPostedAt !== undefined) state.lastPostedAt = s.lastPostedAt;
  if (s.lastLocation !== undefined) state.lastLocation = s.lastLocation;
  if (s.locationIndex !== undefined) locationIndex     = s.locationIndex;
}
function persist() {
  saveState({ ...state, locationIndex });
}

let weatherTimer = null;
let globalApi    = null;

const UA      = 'curl/7.68.0';
const cleanup = (fp) => setTimeout(() => fs.remove(fp).catch(() => {}), 300000);

function runCmd(cmd, ms = 120000) {
  return new Promise((res, rej) =>
    exec(cmd, { maxBuffer: 1024 * 1024 * 200, timeout: ms }, (e, _, se) =>
      e ? rej(new Error(se?.slice(0, 300) || e.message)) : res()
    )
  );
}

// ── wttr.in weather data ──────────────────────────────────────────────────────
async function getWeatherJSON(loc) {
  const { data } = await axios.get(
    `https://wttr.in/${encodeURIComponent(loc)}?format=j1`,
    { timeout: 15000, headers: { 'User-Agent': UA } }
  );
  return typeof data === 'string' ? JSON.parse(data) : data;
}

// ── Download weather image with PNG validation + Pollinations fallback ────────
async function downloadWeatherImage(loc) {
  const fp = path.join(TEMP_DIR, `aw_img_${Date.now()}.png`);
  try {
    const { data } = await axios.get(
      `https://wttr.in/${encodeURIComponent(loc)}.png?1`,
      { responseType: 'arraybuffer', timeout: 25000, headers: { 'User-Agent': UA } }
    );
    const buf = Buffer.from(data);
    // Validate PNG header: 89 50 4E 47
    if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      fs.writeFileSync(fp, buf);
      return fp;
    }
    throw new Error('Not a valid PNG');
  } catch {
    // Pollinations AI fallback
    const prompt = encodeURIComponent(
      `Philippine weather forecast broadcast card for ${loc}, ` +
      `professional TV meteorology style, dark navy blue gradient background, ` +
      `weather icons sun clouds rain, temperature and humidity display, ` +
      `Philippines map accent, clean modern broadcast UI, high contrast, ultra HD`
    );
    const url = `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=600&nologo=true&model=flux&seed=${Date.now() % 99999}`;
    const { data: imgData } = await axios.get(url, { responseType: 'arraybuffer', timeout: 75000 });
    if (!imgData || imgData.byteLength < 2000) throw new Error('Pollinations image too small');
    fs.writeFileSync(fp, Buffer.from(imgData));
    return fp;
  }
}

function parseWeather(data, fallbackLoc) {
  const cur  = data.current_condition?.[0] || {};
  const area = data.nearest_area?.[0];
  return {
    place:    area?.areaName?.[0]?.value || fallbackLoc,
    country:  area?.country?.[0]?.value  || 'Philippines',
    tempC:    cur.temp_C        || '?',
    feelsC:   cur.FeelsLikeC   || '?',
    humidity: cur.humidity      || '?',
    windKmph: cur.windspeedKmph || '?',
    windDir:  cur.winddir16Point || '?',
    desc:     cur.weatherDesc?.[0]?.value || 'N/A',
    maxC:     data.weather?.[0]?.maxtempC || '?',
    minC:     data.weather?.[0]?.mintempC || '?',
    uvIndex:  cur.uvIndex       || '?',
    pressure: cur.pressure      || '?',
  };
}

// ── Tagalog condition mapper ──────────────────────────────────────────────────
function tagalogCondition(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('sunny') || d.includes('clear'))         return 'maliwanag at maaraw';
  if (d.includes('partly cloudy'))                         return 'bahagyang maulap';
  if (d.includes('cloudy') || d.includes('overcast'))     return 'maulap';
  if (d.includes('thunder') || d.includes('storm'))       return 'may kulog at kidlat';
  if (d.includes('heavy rain') || d.includes('pouring'))  return 'malakas na ulan';
  if (d.includes('rain') || d.includes('drizzle'))        return 'makulimlim at may ulan';
  if (d.includes('fog') || d.includes('mist'))            return 'may ambon at ulap';
  if (d.includes('haze'))                                 return 'maalikabok';
  return desc;
}

// ── Build Tagalog weather script (100% Tagalog, walang English) ───────────────
function buildTagalogScript(w, loc) {
  const now = new Date().toLocaleString('fil-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  if (!w) {
    return `Magandang araw po! Ito ang weather update para sa ${loc}. ` +
      `Pakitingnan ang larawan para sa kumpletong forecast. Manatiling ligtas. Salamat po!`;
  }

  const cond = tagalogCondition(w.desc);
  return (
    `Magandang araw po sa inyong lahat! Ito ang pinakabagong weather update para sa ${w.place}, ` +
    `ika-${now}. ` +
    `Kasalukuyang temperatura ay ${w.tempC} degrees Celsius, ` +
    `at pakiramdam ay ${w.feelsC} degrees. ` +
    `Ang lagay ng panahon ay ${cond}. ` +
    `Halumigmig: ${w.humidity} porsyento. ` +
    `Hangin: ${w.windKmph} kilometro bawat oras patungong ${w.windDir}. ` +
    `Pinakamataas ngayon: ${w.maxC} degrees. Pinakamababa: ${w.minC} degrees. ` +
    `Para sa mga bagyo at storm signal, bisitahin ang PAGASA. ` +
    `Mag-ingat po kayo lagi at manatiling ligtas. ` +
    `Ito ay awtomatikong weather update mula sa inyong bot. ` +
    `Nagmamahal sa inyo, Mirai Bot. Salamat po at mabuhay!`
  );
}

// ── Tagalog TTS voice ─────────────────────────────────────────────────────────
async function makeTagalogVoice(script) {
  const fp  = path.join(TEMP_DIR, `aw_voice_${Date.now()}.mp3`);
  const tts = new MsEdgeTTS();
  await tts.setMetadata('fil-PH-AngeloNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(script, { rate: '-6%', pitch: '+0Hz' });
  await new Promise((res, rej) => {
    const chunks = [];
    audioStream.on('data',  d => chunks.push(d));
    audioStream.on('end',   () => { fs.writeFileSync(fp, Buffer.concat(chunks)); res(); });
    audioStream.on('error', rej);
    setTimeout(() => rej(new Error('TTS timeout')), 35000);
  });
  if (!fs.existsSync(fp) || fs.statSync(fp).size < 500) throw new Error('TTS output empty');
  return fp;
}

// ── Breaking-news background music (D minor chord — urgent broadcast feel) ────
const NEWS_BG_CHORD =
  '(0.28*sin(2*PI*146*t)+0.22*sin(2*PI*293*t)+0.18*sin(2*PI*349*t)' +
  '+0.14*sin(2*PI*440*t)+0.10*sin(2*PI*587*t))*(1+0.55*sin(2*PI*1.2*t))';

async function makeNewsBg(durationSec, outPath) {
  await runCmd([
    'ffmpeg -y',
    `-f lavfi -i "aevalsrc=${NEWS_BG_CHORD}*0.45:s=44100:d=${Math.ceil(durationSec + 2)}"`,
    `-filter_complex "[0:a]volume=0.85,aecho=0.8:0.6:180|360:0.30|0.15[out]"`,
    '-map "[out]" -ar 44100 -ac 2 -b:a 64k',
    `"${outPath}"`,
  ].join(' '), 30000);
}

async function mixVoiceWithBg(voiceFp) {
  const bgFp  = path.join(TEMP_DIR, `aw_bg_${Date.now()}.mp3`);
  const mixFp = path.join(TEMP_DIR, `aw_mix_${Date.now()}.mp3`);
  try {
    const durRaw = await new Promise(r =>
      exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voiceFp}"`, (_, o) => r(o?.trim()))
    );
    const dur = Math.ceil(parseFloat(durRaw) || 25) + 2;
    await makeNewsBg(dur, bgFp);
    await runCmd([
      'ffmpeg -y',
      `-i "${voiceFp}" -i "${bgFp}"`,
      `-filter_complex "[1:a]volume=0.20[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]"`,
      `-map "[out]" -ar 44100 -ac 2 -b:a 128k`,
      `"${mixFp}"`,
    ].join(' '), 30000);
    if (!fs.existsSync(mixFp) || fs.statSync(mixFp).size < 1000) throw new Error('mix empty');
    try { fs.removeSync(bgFp); } catch {}
    return mixFp;
  } catch (e) {
    try { fs.removeSync(bgFp); } catch {}
    return voiceFp;
  }
}

// ── 59-second weather video ───────────────────────────────────────────────────
function makeWeatherVideo(imgFp, audioFp, locationLabel, w) {
  return new Promise((resolve, reject) => {
    const outFp    = path.join(TEMP_DIR, `aw_vid_${Date.now()}.mp4`);
    const TARGET   = 59;
    const label    = locationLabel.replace(/['"\\:]/g, '').slice(0, 55);
    const tempTxt  = w ? `${w.tempC}°C | ${tagalogCondition(w.desc).slice(0, 30)}` : 'Pakitingnan ang larawan';

    const cmd =
      `ffmpeg -y -loop 1 -i "${imgFp}" -i "${audioFp}" ` +
      `-vf "zoompan=z='min(zoom+0.0008,1.30)':d=1500:s=1080x600,` +
      `drawtext=text='WEATHER UPDATE':fontsize=34:fontcolor=white:` +
      `box=1:boxcolor=0x003399@0.90:boxborderw=12:x=16:y=16,` +
      `drawtext=text='${label}':fontsize=26:fontcolor=white:` +
      `box=1:boxcolor=black@0.65:boxborderw=8:x=(w-tw)/2:y=h-90,` +
      `drawtext=text='${tempTxt}':fontsize=20:fontcolor=yellow:` +
      `box=1:boxcolor=black@0.55:boxborderw=6:x=(w-tw)/2:y=h-50,` +
      `drawtext=text='TEAM STARTCOPE BETA':fontsize=14:fontcolor=white@0.80:` +
      `box=1:boxcolor=black@0.40:boxborderw=4:x=(w-tw)/2:y=h-20" ` +
      `-c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p ` +
      `-af "apad=whole_dur=${TARGET}" ` +
      `-c:a aac -b:a 128k -t ${TARGET} "${outFp}" 2>&1`;

    exec(cmd, { timeout: 150000, maxBuffer: 1024 * 1024 * 300 }, (e) => {
      if (!e && fs.existsSync(outFp) && fs.statSync(outFp).size > 50000) return resolve(outFp);
      // Fallback: simple video
      const cmd2 =
        `ffmpeg -y -loop 1 -i "${imgFp}" -i "${audioFp}" ` +
        `-c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p ` +
        `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ` +
        `-af "apad=whole_dur=${TARGET}" ` +
        `-c:a aac -b:a 96k -t ${TARGET} "${outFp}" 2>&1`;
      exec(cmd2, { timeout: 150000 }, (e2) => {
        if (e2 || !fs.existsSync(outFp) || fs.statSync(outFp).size < 10000) return reject(new Error('ffmpeg failed'));
        resolve(outFp);
      });
    });
  });
}

// ── Save appstate helper ──────────────────────────────────────────────────────
function saveAppstate(api) {
  try {
    const appState = api.getAppState();
    if (appState && Array.isArray(appState)) {
      fs.writeFileSync('./appstate.json', JSON.stringify(appState, null, 2));
      fs.writeFileSync('./utils/data/fbstate.json', JSON.stringify(appState, null, 2));
    }
  } catch {}
}

// ── Get all active thread IDs ─────────────────────────────────────────────────
function getAllThreadIDs() {
  try {
    const ids = [...(global.data?.allThreadID || [])];
    return ids.filter(id => id && String(id).length > 5);
  } catch { return []; }
}

// ── Error handler with backoff ────────────────────────────────────────────────
function handleError(e, cycleFn) {
  const errStr = typeof e === 'string' ? e : (e?.message || JSON.stringify(e).slice(0, 200));
  const msg    = errStr.toLowerCase();
  if (msg.includes('checkpoint') || msg.includes('restricted') || msg.includes('suspended')) {
    console.error(`[AutoWeather] 🔒 RESTRICTION — backing off 30 min:`, errStr.slice(0, 80));
    if (global.protection?.clearCheckpoint) global.protection.clearCheckpoint(globalApi);
    return setTimeout(cycleFn, 30 * 60 * 1000 + Math.random() * 5 * 60 * 1000);
  }
  console.error(`[AutoWeather] ❌ Error:`, errStr.slice(0, 150));
  state.errorCount = (state.errorCount || 0) + 1;
  const backoff = Math.min(state.errorCount * 2 * 60 * 1000, 15 * 60 * 1000);
  console.log(`[AutoWeather] ⏳ Backoff: ${Math.round(backoff / 60000)} min`);
  return setTimeout(cycleFn, backoff);
}

// ── Main weather cycle ────────────────────────────────────────────────────────
async function runWeatherCycle() {
  if (!state.enabled || !globalApi) return;

  const location = getNextLocation();
  state.lastLocation = location;
  console.log(`[AutoWeather] 🌤️ Fetching weather for: ${location}`);

  let imgFp = null, voiceFp = null, audioFp = null, videoFp = null;

  try {
    // Fetch weather data + image in parallel
    const [jsonRes, imgRes] = await Promise.allSettled([
      getWeatherJSON(location),
      downloadWeatherImage(location),
    ]);

    const wData = jsonRes.status === 'fulfilled' ? jsonRes.value : null;
    imgFp       = imgRes.status === 'fulfilled'  ? imgRes.value  : null;
    const w     = wData ? parseWeather(wData, location) : null;

    if (!imgFp) throw new Error(`No weather image for ${location}`);

    // Build text body for the GC message
    const now = new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
    let body =
      `🌤️ ${bold('WEATHER UPDATE')} — ${bold(w ? w.place : location)} 🇵🇭\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 ${now} (Oras ng Pilipinas)\n\n`;

    if (w) {
      body +=
        `🌡️ ${bold('Temperatura:')} ${w.tempC}°C (Pakiramdam ${w.feelsC}°C)\n` +
        `🌤️ ${bold('Kalagayan:')}  ${w.desc}\n` +
        `💧 ${bold('Halumigmig:')} ${w.humidity}%\n` +
        `💨 ${bold('Hangin:')}     ${w.windKmph} km/h ${w.windDir}\n` +
        `📈 ${bold('Mataas:')} ${w.maxC}°C | ${bold('Mababa:')} ${w.minC}°C\n` +
        `☀️ ${bold('UV Index:')}  ${w.uvIndex}\n`;
    }

    body +=
      `\n🎬 ${bold('59-segundo na weather video na may Tagalog voice!')}\n` +
      `📡 ${bold('Pinagkukunan:')} wttr.in · TEAM STARTCOPE BETA\n` +
      `🔗 pagasa.dost.gov.ph`;

    // Generate Tagalog voice
    const script = buildTagalogScript(w, location);
    voiceFp      = await makeTagalogVoice(script);
    audioFp      = await mixVoiceWithBg(voiceFp).catch(() => voiceFp);

    // Generate 59-second video
    const overlayLabel = w ? `${w.place}, Philippines` : location;
    videoFp = await makeWeatherVideo(imgFp, audioFp, overlayLabel, w);

    // Send to ALL group chats
    const threadIDs = getAllThreadIDs();
    if (!threadIDs.length) {
      console.log('[AutoWeather] ⚠️ No thread IDs found — skipping send');
    } else {
      let sent = 0;
      for (const tid of threadIDs) {
        try {
          await new Promise((res, rej) => {
            globalApi.sendMessage(
              { body, attachment: fs.createReadStream(videoFp) },
              tid,
              (err) => err ? rej(err) : res()
            );
          });
          sent++;
          // Small delay between threads to avoid rate limiting
          if (sent < threadIDs.length) await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
        } catch (sendErr) {
          console.log(`[AutoWeather] ⚠️ Failed to send to thread ${tid}:`, sendErr.message?.slice(0, 60));
        }
      }
      console.log(`[AutoWeather #${state.count + 1}] ✅ Sent to ${sent}/${threadIDs.length} GCs — ${location}`);
    }

    state.count++;
    state.lastPostedAt = new Date().toISOString();
    state.errorCount   = 0;
    persist();
    saveAppstate(globalApi);
    if (global.protection?.clearCheckpoint) global.protection.clearCheckpoint(globalApi);

  } catch (e) {
    weatherTimer = handleError(e, runWeatherCycle);
    return;
  } finally {
    // Cleanup temp files
    if (imgFp)   cleanup(imgFp);
    if (voiceFp && voiceFp !== audioFp) cleanup(voiceFp);
    if (audioFp) cleanup(audioFp);
    if (videoFp) cleanup(videoFp);
  }

  // Schedule next run — 3 min ± 30–60 sec jitter
  const jitter = (Math.random() - 0.5) * 2 * (30000 + Math.random() * 30000);
  weatherTimer = setTimeout(runWeatherCycle, INTERVAL_MS + jitter);
}

// ── Start / Stop ──────────────────────────────────────────────────────────────
function startAutoWeather(api) {
  globalApi     = api;
  state.enabled = true;
  persist();

  const firstDelay = 15000 + Math.random() * 15000; // 15–30 sec
  weatherTimer = setTimeout(runWeatherCycle, firstDelay);
  console.log(`[AutoWeather] ✅ Started — weather video every 3 min to all GCs`);
  console.log(`[AutoWeather] ⏱️ First post in ${Math.round(firstDelay / 1000)}s — ${PH_LOCATIONS.length} PH cities`);
}

function stopAutoWeather() {
  if (weatherTimer) { clearTimeout(weatherTimer); weatherTimer = null; }
  state.enabled = false;
  persist();
  console.log('[AutoWeather] 🛑 Stopped');
}

// ── Command exports ───────────────────────────────────────────────────────────
module.exports.config = {
  name:            'autoweather',
  version:         VERSION,
  hasPermssion:    2,
  credits:         TEAM,
  description:     'Auto-posts Philippines weather VIDEO to all GCs every 3 min — 50+ cities, Tagalog voice, 59s video',
  commandCategory: 'Admin',
  usages:          '[on | off | status]',
  cooldowns:       5,
};

module.exports.onLoad = function ({ api }) {
  loadPersistedState();
  if (state.enabled) {
    globalApi = api;
    console.log(`[AutoWeather] 🔄 Restored — resuming weather cycle...`);
    setTimeout(() => startAutoWeather(api), 12000);
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P   = global.config?.PREFIX || '!';
  const sub = (args[0] || '').toLowerCase();

  if (!sub || sub === 'help') {
    return api.sendMessage(
      `╔═══════════════════════════════╗\n` +
      `║  🌤️ ${bold('AUTOWEATHER v' + VERSION)}         ║\n` +
      `║  🏷️  ${bold(TEAM)}   ║\n` +
      `╚═══════════════════════════════╝\n\n` +
      `🇵🇭 ${bold('AUTO WEATHER VIDEO — 24/7 SA LAHAT NG GC!')}\n` +
      `📹 ${bold('Nagse-send ng 59-segundo na weather video')}\n` +
      `🎙️ ${bold('Tagalog voice')} na may background music\n` +
      `🌍 ${bold('50+ Philippine cities')} — auto-rotating\n\n` +
      `📋 ${bold('KASAMA SA LISTAHAN:')}\n` +
      `  Minalabac · Naga City · Masbate · Manila\n` +
      `  Cebu · Davao · Baguio · Iloilo · Zamboanga\n` +
      `  At ${PH_LOCATIONS.length - 5} pang mga lungsod!\n\n` +
      `📋 ${bold('COMMANDS:')}\n${'─'.repeat(32)}\n` +
      `${P}autoweather on      — I-start\n` +
      `${P}autoweather off     — I-stop\n` +
      `${P}autoweather status  — Tingnan ang status\n\n` +
      `📊 ${bold('STATUS:')}\n` +
      `  • ${bold('State:')} ${state.enabled ? '🟢 ON' : '🔴 OFF'}\n` +
      `  • ${bold('Total posts:')} ${state.count}\n` +
      `  • ${bold('Huling lugar:')} ${state.lastLocation || 'wala pa'}\n` +
      (state.lastPostedAt ? `  • ${bold('Huling post:')} ${new Date(state.lastPostedAt).toLocaleString('fil-PH', { timeZone: 'Asia/Manila' })}\n` : '') +
      `\n🔒 ${bold('Admin only')} | Nagse-send sa lahat ng GC\n` +
      `⚡ ${bold('KAIBA sa AutoMOR:')} AutoWeather → GC | AutoMOR → Wall`,
      threadID, messageID
    );
  }

  if (sub === 'on') {
    if (state.enabled) {
      return api.sendMessage(
        `⚠️ ${bold('Naka-ON na ang AutoWeather.')}\nI-stop: ${P}autoweather off`,
        threadID, messageID
      );
    }
    startAutoWeather(api);
    return api.sendMessage(
      `✅ ${bold('AUTOWEATHER — NAGSIMULA NA! 🌤️🇵🇭')}\n\n` +
      `📹 ${bold('59-segundo na weather video bawat 3 minuto!')}\n` +
      `🎙️ ${bold('Tagalog voice')} + background music\n` +
      `📡 ${bold('Nagse-send sa LAHAT NG GROUP CHATS')}\n\n` +
      `🌍 ${bold(`${PH_LOCATIONS.length} Philippine cities ang covered:`)}\n` +
      `  Minalabac · Naga City · Masbate · Manila\n` +
      `  Cebu · Davao · Baguio · at marami pa!\n\n` +
      `🕒 ${bold('Una pang video sa loob ng 30 segundo...')}\n\n` +
      `💡 I-stop: ${P}autoweather off\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  if (sub === 'off') {
    if (!state.enabled) {
      return api.sendMessage(
        `⚠️ ${bold('Hindi pa naka-ON ang AutoWeather.')}\nI-start: ${P}autoweather on`,
        threadID, messageID
      );
    }
    stopAutoWeather();
    return api.sendMessage(
      `🛑 ${bold('AUTOWEATHER — NATIGIL.')}\n\n` +
      `📊 ${bold('Kabuuang posts:')} ${state.count}\n` +
      `📍 ${bold('Huling lugar:')} ${state.lastLocation || 'wala'}\n` +
      (state.lastPostedAt ? `🕒 ${bold('Huling post:')} ${new Date(state.lastPostedAt).toLocaleString('fil-PH', { timeZone: 'Asia/Manila' })}\n` : '') +
      `\n💡 I-restart: ${P}autoweather on\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  if (sub === 'status') {
    const threadIDs = getAllThreadIDs();
    return api.sendMessage(
      `📊 ${bold('AUTOWEATHER STATUS')}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `  • ${bold('State:')} ${state.enabled ? '🟢 RUNNING' : '🔴 STOPPED'}\n` +
      `  • ${bold('Total posts:')} ${state.count}\n` +
      `  • ${bold('Kasalukuyang GCs:')} ${threadIDs.length}\n` +
      `  • ${bold('Susunod na lugar:')} ${PH_LOCATIONS[locationIndex % PH_LOCATIONS.length]}\n` +
      `  • ${bold('Kabuuang cities:')} ${PH_LOCATIONS.length}\n` +
      `  • ${bold('Interval:')} 3 minuto ± jitter\n` +
      (state.lastLocation ? `  • ${bold('Huling lugar:')} ${state.lastLocation}\n` : '') +
      (state.lastPostedAt ? `  • ${bold('Huling post:')} ${new Date(state.lastPostedAt).toLocaleString('fil-PH', { timeZone: 'Asia/Manila' })}\n` : '') +
      `\n🏷️ ${bold(TEAM)}`,
      threadID, messageID
    );
  }

  return api.sendMessage(
    `❌ Hindi kilala ang command.\n💡 Gamitin: ${P}autoweather on/off/status`,
    threadID, messageID
  );
};
