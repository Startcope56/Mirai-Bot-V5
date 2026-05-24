'use strict';
/**
 * !weather — Real-time weather + 59s video with location scene + radar map + Tagalog voice
 *
 * Usage:
 *   !weather [location]           — Image + text + Tagalog voice
 *   !weather video [location]     — 59-second cinematic weather video
 *   !weather female [location]    — Female Tagalog voice (BlessicaNeural)
 *   !weather male [location]      — Male Tagalog voice (AngeloNeural)
 *   !weather typhoon / bagyo      — Philippines typhoon + LPA tracker
 *   !weather apis                 — Show all APIs used (shareable)
 *
 * APIs used (all FREE, no API key):
 *   • wttr.in              — Real-time weather data + PNG cards
 *   • Open-Meteo           — Detailed forecast + free geocoding (lat/lon)
 *   • Rainviewer           — Free live rain radar (no key)
 *   • Pollinations AI      — Location scene image generation (no key)
 *   • Microsoft Edge TTS   — fil-PH-AngeloNeural / fil-PH-BlessicaNeural
 *   • PAGASA               — Philippines typhoon/LPA official data
 */

const axios           = require('axios');
const fs              = require('fs-extra');
const path            = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const { exec }        = require('child_process');
const bold            = require('../../utils/bold');

const TEMP_DIR = path.join(process.cwd(), 'utils/data/weather_temp');
fs.ensureDirSync(TEMP_DIR);

const UA      = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const cleanup = (fp) => { if (fp) setTimeout(() => fs.remove(fp).catch(() => {}), 300000); };

// ═══════════════════════════════════════════════════════════════════════════════
// API LIST — shareable
// ═══════════════════════════════════════════════════════════════════════════════
const API_INFO =
  `🌐 ${bold('MGA LIBRENG API NA GINAMIT SA WEATHER VIDEO')}\n` +
  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
  `1️⃣ ${bold('wttr.in')} — Real-time weather data + PNG card\n` +
  `   🔗 https://wttr.in/[lugar]?format=j1\n` +
  `   🖼️  https://wttr.in/[lugar].png\n` +
  `   ✅ Walang API key • Libre palagi\n\n` +
  `2️⃣ ${bold('Open-Meteo Geocoding')} — Lat/Lon ng lokasyon\n` +
  `   🔗 https://geocoding-api.open-meteo.com/v1/search?name=[lugar]\n` +
  `   ✅ Walang API key • Libre palagi\n\n` +
  `3️⃣ ${bold('Rainviewer')} — Radar map ng ulan at bagyo (LIVE)\n` +
  `   🔗 https://api.rainviewer.com/public/weather-maps.json\n` +
  `   🖼️  Tile: tilecache.rainviewer.com/v2/radar/{time}/512/{z}/{x}/{y}/2/1_1.png\n` +
  `   ✅ Walang API key • Libre palagi\n\n` +
  `4️⃣ ${bold('Pollinations AI')} — AI-generated location scene na may tao\n` +
  `   🔗 https://image.pollinations.ai/prompt/{prompt}?width=1280&height=720&model=flux\n` +
  `   ✅ Walang API key • Libre palagi\n\n` +
  `5️⃣ ${bold('Microsoft Edge TTS')} — Tagalog voice synthesis\n` +
  `   🎙️ Male:   fil-PH-AngeloNeural\n` +
  `   🎙️ Female: fil-PH-BlessicaNeural\n` +
  `   📦 npm: msedge-tts\n` +
  `   ✅ Walang API key • Libre palagi\n\n` +
  `6️⃣ ${bold('PAGASA')} — Philippines typhoon/LPA official data\n` +
  `   🔗 https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin.json\n` +
  `   🔗 https://bagong.pagasa.dost.gov.ph/tropical-cyclone/\n` +
  `   ✅ Walang API key • Government data\n\n` +
  `7️⃣ ${bold('FFmpeg')} — Video/audio processing\n` +
  `   📦 npm: fluent-ffmpeg + ffmpeg binary\n` +
  `   ✅ Open source • Libre palagi\n\n` +
  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
  `🏷️ ${bold('TEAM STARTCOPE BETA')} · Mirai Bot V3 🇵🇭`;

// ═══════════════════════════════════════════════════════════════════════════════
// GEOCODING — lat/lon from location name (Open-Meteo, FREE)
// ═══════════════════════════════════════════════════════════════════════════════
async function geocodeLocation(location) {
  try {
    const { data } = await axios.get(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
      { timeout: 8000, headers: { 'User-Agent': UA } }
    );
    if (data.results?.[0]) {
      const r = data.results[0];
      return { lat: r.latitude, lon: r.longitude, name: r.name, country: r.country };
    }
  } catch {}
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION SCENE — Pollinations AI (people walking, street view)
// ═══════════════════════════════════════════════════════════════════════════════
async function generateLocationScene(location, weatherDesc) {
  const h = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }));
  const timeOfDay = h >= 5 && h < 12 ? 'morning golden hour' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 19 ? 'sunset evening' : 'night cityscape';
  const d = (weatherDesc || '').toLowerCase();
  const mood = d.includes('rain') || d.includes('storm') ? 'rainy streets people with umbrellas puddles reflecting lights' :
               d.includes('thunder') ? 'dramatic stormy dark clouds lightning in distance' :
               d.includes('fog') || d.includes('mist') ? 'misty foggy atmospheric moody streets' :
               d.includes('cloud') ? 'partly cloudy nice weather people relaxing outdoors' :
               'bright sunny clear sky cheerful people shopping';
  const prompt = encodeURIComponent(
    `${location} Philippines street scene, ${timeOfDay}, ${mood}, ` +
    `Filipino people walking on sidewalk, local tricycles jeepneys, ` +
    `authentic Philippine city life, local shops and colorful buildings, ` +
    `photorealistic cinematic shot, 4K ultra HD, vibrant colors, natural lighting, ` +
    `wide angle photography, no text no watermark`
  );
  const fp  = path.join(TEMP_DIR, `wloc_${Date.now()}.jpg`);
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=1280&height=720&nologo=true&model=flux&seed=${Date.now() % 99999}`;
  const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 90000, headers: { 'User-Agent': UA } });
  if (!data || data.byteLength < 5000) throw new Error('Location scene image too small');
  fs.writeFileSync(fp, Buffer.from(data));
  return fp;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RADAR MAP — Rainviewer (FREE, no API key)
// ═══════════════════════════════════════════════════════════════════════════════
function latLonToTile(lat, lon, zoom) {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
      2 * Math.pow(2, zoom)
  );
  return { x, y };
}

async function downloadRadarTile(lat, lon) {
  try {
    const { data: meta } = await axios.get(
      'https://api.rainviewer.com/public/weather-maps.json',
      { timeout: 8000, headers: { 'User-Agent': UA } }
    );
    const past = meta.radar?.past;
    if (!past?.length) throw new Error('No radar data');
    const latest = past[past.length - 1];
    const host   = meta.host || 'https://tilecache.rainviewer.com';

    // Zoom 5 gives a wide region view — good for showing rain patterns around a city
    const zoom = 5;
    const { x, y } = latLonToTile(lat || 12.8797, lon || 121.7740, zoom);
    const tileUrl  = `${host}${latest.path}/512/${zoom}/${x}/${y}/2/1_1.png`;

    const fp = path.join(TEMP_DIR, `wradar_${Date.now()}.png`);
    const { data: tileData } = await axios.get(tileUrl, {
      responseType: 'arraybuffer', timeout: 12000, headers: { 'User-Agent': UA },
    });
    const buf = Buffer.from(tileData);
    if (buf.length < 200) throw new Error('Radar tile empty');
    fs.writeFileSync(fp, buf);
    return fp;
  } catch (e) {
    console.log('[Weather] Radar tile failed:', e.message?.slice(0, 60));
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// wttr.in helpers
// ═══════════════════════════════════════════════════════════════════════════════
async function getWeatherJSON(loc) {
  const { data } = await axios.get(
    `https://wttr.in/${encodeURIComponent(loc)}?format=j1`,
    { timeout: 15000, headers: { 'User-Agent': 'curl/7.68.0' } }
  );
  return typeof data === 'string' ? JSON.parse(data) : data;
}

async function downloadWeatherImage(loc) {
  const fp = path.join(TEMP_DIR, `wimg_${Date.now()}.png`);
  try {
    const { data } = await axios.get(
      `https://wttr.in/${encodeURIComponent(loc)}.png?1`,
      { responseType: 'arraybuffer', timeout: 25000, headers: { 'User-Agent': 'curl/7.68.0' } }
    );
    const buf = Buffer.from(data);
    if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      fs.writeFileSync(fp, buf); return fp;
    }
    throw new Error('Not a valid PNG');
  } catch {
    const prompt = encodeURIComponent(
      `Philippine weather forecast card for ${loc}, professional meteorology, ` +
      `dark navy gradient, weather icons, ultra HD broadcast quality`
    );
    const url = `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=600&nologo=true&model=flux&seed=${Date.now() % 99999}`;
    const { data: imgData } = await axios.get(url, { responseType: 'arraybuffer', timeout: 70000 });
    if (!imgData || imgData.byteLength < 2000) throw new Error('Fallback image too small');
    fs.writeFileSync(fp, Buffer.from(imgData));
    return fp;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGASA typhoon check
// ═══════════════════════════════════════════════════════════════════════════════
async function checkPAGASA() {
  try {
    const { data } = await axios.get('https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin.json', { timeout: 12000, headers: { 'User-Agent': UA } });
    const d = typeof data === 'string' ? JSON.parse(data) : data;
    return { active: !!(d.cyclon || d.cyclone || d.tropical_cyclone), raw: d };
  } catch {}
  try {
    const { data } = await axios.get('https://bagong.pagasa.dost.gov.ph/tropical-cyclone/public-storm-warning-signals', { timeout: 12000, headers: { 'User-Agent': UA } });
    const storm = data.match(/(?:Typhoon|Tropical Storm|Tropical Depression|Severe Tropical Storm)\s+([A-Z][a-zA-Z]+)/g) || [];
    const lpa   = /low pressure area|LPA/i.test(data);
    return { active: storm.length > 0 || lpa, storms: storm, lpa };
  } catch {}
  return { active: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHELL HELPER
// ═══════════════════════════════════════════════════════════════════════════════
function run(cmd, timeoutMs = 90000) {
  return new Promise((res, rej) =>
    exec(cmd, { maxBuffer: 1024 * 1024 * 200, timeout: timeoutMs }, (e, _, se) =>
      e ? rej(new Error(se?.slice(0, 300) || e.message)) : res()
    )
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TTS — male: AngeloNeural | female: BlessicaNeural
// ═══════════════════════════════════════════════════════════════════════════════
async function makeVoice(text, gender = 'male') {
  const fp  = path.join(TEMP_DIR, `wvoice_${Date.now()}.mp3`);
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    gender === 'female' ? 'fil-PH-BlessicaNeural' : 'fil-PH-AngeloNeural',
    OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
  );
  const { audioStream } = tts.toStream(text, {
    rate: gender === 'female' ? '-3%' : '-5%',
    pitch: gender === 'female' ? '+2Hz' : '+0Hz',
  });
  await new Promise((res, rej) => {
    const chunks = [];
    audioStream.on('data',  d => chunks.push(d));
    audioStream.on('end',   () => { fs.writeFileSync(fp, Buffer.concat(chunks)); res(); });
    audioStream.on('error', rej);
    setTimeout(() => rej(new Error('TTS timeout')), 40000);
  });
  if (!fs.existsSync(fp) || fs.statSync(fp).size < 500) throw new Error('TTS output empty');
  return fp;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND MUSIC
// ═══════════════════════════════════════════════════════════════════════════════
const WEATHER_CHORD =
  '(0.22*sin(2*PI*220*t)+0.18*sin(2*PI*277*t)+0.15*sin(2*PI*330*t)' +
  '+0.12*sin(2*PI*415*t)+0.08*sin(2*PI*554*t))*(1+0.4*sin(2*PI*0.8*t))';

async function makeWeatherBgMusic(durationSec, outPath) {
  await run([
    'ffmpeg -y',
    `-f lavfi -i "aevalsrc=${WEATHER_CHORD}*0.38:s=44100:d=${Math.ceil(durationSec + 3)}"`,
    `-filter_complex "[0:a]volume=0.80,aecho=0.7:0.5:200|420:0.25|0.12[out]"`,
    '-map "[out]" -ar 44100 -ac 2 -b:a 64k',
    `"${outPath}"`,
  ].join(' '), 30000);
}

async function mixVoiceWithBg(voiceFp) {
  const bgFp  = path.join(TEMP_DIR, `wbg_${Date.now()}.mp3`);
  const mixFp = path.join(TEMP_DIR, `wmix_${Date.now()}.mp3`);
  const durRaw = await new Promise(r =>
    exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voiceFp}"`, (_, o) => r(o?.trim()))
  );
  const dur = Math.ceil(parseFloat(durRaw) || 20) + 2;
  try {
    await makeWeatherBgMusic(dur, bgFp);
    await run([
      'ffmpeg -y',
      `-i "${voiceFp}" -i "${bgFp}"`,
      `-filter_complex "[1:a]volume=0.20[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]"`,
      '-map "[out]" -ar 44100 -ac 2 -b:a 128k',
      `"${mixFp}"`,
    ].join(' '), 30000);
    if (!fs.existsSync(mixFp) || fs.statSync(mixFp).size < 1000) throw new Error('mix empty');
    cleanup(bgFp); return mixFp;
  } catch {
    cleanup(bgFp); return voiceFp;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEATHER VIDEO V2 — cinematic: location scene + radar + overlays
// ═══════════════════════════════════════════════════════════════════════════════
async function makeWeatherVideoV2({ locationImg, radarImg, audioFp, w, location, gender }) {
  const outFp  = path.join(TEMP_DIR, `wvid_${Date.now()}.mp4`);
  const TARGET = 59;

  const loc    = (w?.place || location).replace(/['"\\:<>]/g, '').slice(0, 55);
  const country= (w?.country && !/phil/i.test(w.country) ? `, ${w.country}` : '').replace(/['"\\]/g, '');
  const tempC  = w?.tempC   || '?';
  const feelsC = w?.feelsC  || '?';
  const hum    = w?.humidity || '?';
  const wind   = `${w?.windKmph || '?'} km/h ${w?.windDir || ''}`.replace(/['"\\]/g, '').slice(0, 20);
  const desc   = tagalogCondition(w?.desc || '').replace(/['"\\:<>]/g, '').slice(0, 28);
  const maxC   = w?.maxC   || '?';
  const minC   = w?.minC   || '?';
  const press  = w?.pressure || '?';
  const uv     = w?.uvIndex  || '?';
  const voiceLabel = (gender === 'female') ? '🎙️ BLESSICA' : '🎙️ ANGELO';
  const now    = new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).replace(/['"\\]/g, '').slice(0, 28);

  // ── Build filter chain ─────────────────────────────────────────────────────
  // Inputs: [0]=locationScene  [1]=radar (optional)  [2 or 1]=audio
  const hasRadar    = radarImg && fs.existsSync(radarImg);
  const audioIdx    = hasRadar ? 2 : 1;
  const inputParts  = [
    `-loop 1 -i "${locationImg}"`,
    hasRadar ? `-loop 1 -i "${radarImg}"` : '',
    `-i "${audioFp}"`,
  ].filter(Boolean).join(' ');

  // Main video filter
  const vfBase = [
    // Scale scene to 854x480
    `[0:v]scale=854:480:force_original_aspect_ratio=cover,crop=854:480[scene]`,

    // Dark gradient overlay at bottom for text readability
    `[scene]drawbox=x=0:y=310:w=854:h=170:color=black@0.70:t=fill[d1]`,

    // Semi-transparent top header bar (dark navy)
    `[d1]drawbox=x=0:y=0:w=854:h=58:color=0x001A3D@0.88:t=fill[d2]`,

    // Red "BREAKING" accent bar under header
    `[d2]drawbox=x=0:y=55:w=854:h=5:color=0xCC0000@0.95:t=fill[d3]`,

    // Bottom ticker bar
    `[d3]drawbox=x=0:y=460:w=854:h=20:color=0x001133@0.92:t=fill[d4]`,

    // Radar widget background (top right corner)
    hasRadar ? `[d4]drawbox=x=654:y=65:w=192:h=118:color=0x000D26@0.92:t=fill[d5]` : `[d4]copy[d5]`,

    // Radar widget border
    hasRadar ? `[d5]drawbox=x=654:y=65:w=192:h=118:color=0x0066CC@0.70:t=2[d6]` : `[d5]copy[d6]`,

    // ── TEXT OVERLAYS ────────────────────────────────────────────────────────

    // Station name (top center)
    `[d6]drawtext=text='📡 WEATHER UPDATE · TEAM STARTCOPE BETA':fontsize=13:fontcolor=white:` +
    `fontweight=bold:x=(w-tw)/2:y=14[t1]`,

    // Date+time (top left)
    `[t1]drawtext=text='📅 ${now}':fontsize=11:fontcolor=0xAADDFF:x=10:y=40[t2]`,

    // Voice indicator (top right, before radar)
    `[t2]drawtext=text='${voiceLabel}':fontsize=11:fontcolor=0xFFCC00:x=w-tw-10:y=40[t3]`,

    // HUGE temperature (bottom left — main focus)
    `[t3]drawtext=text='${tempC}°C':fontsize=72:fontcolor=white:fontweight=bold:` +
    `box=1:boxcolor=0x000000@0.35:boxborderw=6:x=18:y=320[t4]`,

    // Feels like
    `[t4]drawtext=text='Pakiramdam: ${feelsC}°C':fontsize=14:fontcolor=0xCCEEFF:x=22:y=408[t5]`,

    // Condition badge
    `[t5]drawtext=text='${desc}':fontsize=17:fontcolor=white:fontweight=bold:` +
    `box=1:boxcolor=0xCC0000@0.80:boxborderw=5:x=22:y=430[t6]`,

    // High/Low
    `[t6]drawtext=text='▲ ${maxC}°C  ▼ ${minC}°C':fontsize=13:fontcolor=0xFFDD88:x=22:y=458[t7]`,

    // Right side: Weather details
    `[t7]drawtext=text='💧 Halumigmig: ${hum}%':fontsize=14:fontcolor=white:x=380:y=320[t8]`,
    `[t8]drawtext=text='💨 Hangin: ${wind}':fontsize=14:fontcolor=white:x=380:y=342[t9]`,
    `[t9]drawtext=text='🌡️ Presyon: ${press} hPa':fontsize=14:fontcolor=0xCCEEFF:x=380:y=364[t10]`,
    `[t10]drawtext=text='☀️ UV Index: ${uv}':fontsize=14:fontcolor=0xFFEE88:x=380:y=386[t11]`,

    // Location name (bottom center, large)
    `[t11]drawtext=text='📍 ${loc}${country}':fontsize=19:fontcolor=0xFFFF88:fontweight=bold:` +
    `x=(w-tw)/2:y=466[t12]`,

    // Radar label
    hasRadar ?
    `[t12]drawtext=text='🌧 RADAR MAP':fontsize=10:fontcolor=0x88CCFF:x=658:y=68[t13]` :
    `[t12]copy[t13]`,

    // Scrolling ticker: weather details
    `[t13]drawtext=text='🌤 ${loc}${country}  |  Temp: ${tempC}°C  |  ${desc}  |  Hangin: ${wind}  |  Halumigmig: ${hum}%  |  UV: ${uv}  |  Pinagkukunan: wttr.in · Rainviewer · Pollinations AI  |  HOME OF WEATHER':` +
    `fontsize=11:fontcolor=white:x='w-mod(t*65\\,w+tw)':y=463[outv]`,
  ].join(';');

  let radarOverlay = '';
  let radarMap     = '';
  if (hasRadar) {
    radarMap     = `[1:v]scale=188:112,format=rgba[rl];`;
    radarOverlay = `[outv][rl]overlay=x=656:y=78[finalv]`;
  }

  const finalOut = hasRadar ? '[finalv]' : '[outv]';
  const filterComplex = hasRadar
    ? `${vfBase};${radarMap}${radarOverlay}`
    : vfBase;

  const mapArg = hasRadar
    ? `-map "${finalOut}" -map ${audioIdx}:a`
    : `-map "${finalOut}" -map ${audioIdx}:a`;

  const cmd =
    `ffmpeg -y ${inputParts} ` +
    `-filter_complex "${filterComplex}" ` +
    `${mapArg} ` +
    `-c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p ` +
    `-af "apad=whole_dur=${TARGET}" ` +
    `-c:a aac -b:a 128k -t ${TARGET} "${outFp}" 2>&1`;

  try {
    await run(cmd, 150000);
    if (fs.existsSync(outFp) && fs.statSync(outFp).size > 30000) return outFp;
  } catch (e) {
    console.log('[Weather Video] Full composite failed:', e.message?.slice(0, 80));
  }

  // ── Fallback: simpler single-image video ──────────────────────────────────
  const cmd2 =
    `ffmpeg -y -loop 1 -i "${locationImg}" -i "${audioFp}" ` +
    `-vf "scale=854:480:force_original_aspect_ratio=cover,crop=854:480,` +
    `drawbox=x=0:y=0:w=854:h=56:color=0x001A3D@0.85:t=fill,` +
    `drawbox=x=0:y=310:w=854:h=170:color=black@0.65:t=fill,` +
    `drawtext=text='🌤 WEATHER UPDATE - ${loc.slice(0, 40)}':fontsize=15:fontcolor=white:x=(w-tw)/2:y=16,` +
    `drawtext=text='${tempC}°C':fontsize=72:fontcolor=white:x=18:y=318,` +
    `drawtext=text='${desc}':fontsize=17:fontcolor=0xFFCC00:x=22:y=432,` +
    `drawtext=text='📍 ${loc}${country}':fontsize=17:fontcolor=0xFFFF88:x=(w-tw)/2:y=460" ` +
    `-c:v libx264 -preset fast -crf 26 -pix_fmt yuv420p ` +
    `-af "apad=whole_dur=${TARGET}" ` +
    `-c:a aac -b:a 96k -t ${TARGET} "${outFp}" 2>&1`;

  await run(cmd2, 120000);
  if (!fs.existsSync(outFp) || fs.statSync(outFp).size < 10000) throw new Error('Video generation failed completely');
  return outFp;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSE / FORMAT helpers
// ═══════════════════════════════════════════════════════════════════════════════
function parseWeather(data, fallbackLoc) {
  const cur  = data.current_condition?.[0] || {};
  const area = data.nearest_area?.[0];
  return {
    place:      area?.areaName?.[0]?.value || fallbackLoc,
    country:    area?.country?.[0]?.value  || '',
    tempC:      cur.temp_C       || '?',
    feelsC:     cur.FeelsLikeC   || '?',
    humidity:   cur.humidity     || '?',
    windKmph:   cur.windspeedKmph || '?',
    windDir:    cur.winddir16Point || '?',
    desc:       cur.weatherDesc?.[0]?.value || 'N/A',
    visibility: cur.visibility   || '?',
    pressure:   cur.pressure     || '?',
    uvIndex:    cur.uvIndex      || '?',
    maxC:       data.weather?.[0]?.maxtempC || '?',
    minC:       data.weather?.[0]?.mintempC || '?',
  };
}

function tagalogCondition(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('sunny') || d.includes('clear'))        return 'Maliwanag at Maaraw';
  if (d.includes('partly cloudy'))                        return 'Bahagyang Maulap';
  if (d.includes('cloudy') || d.includes('overcast'))    return 'Maulap';
  if (d.includes('thunder') || d.includes('storm'))      return 'May Kulog at Kidlat';
  if (d.includes('heavy rain') || d.includes('pouring')) return 'Malakas na Ulan';
  if (d.includes('rain') || d.includes('drizzle'))       return 'Makulimlim, May Ulan';
  if (d.includes('fog') || d.includes('mist'))           return 'May Ambon at Ulap';
  if (d.includes('snow'))                                 return 'May Niyebe';
  if (d.includes('haze'))                                 return 'Maalikabok';
  return desc || 'N/A';
}

const PH_RE = /philippines|pilipinas|manila|cebu|davao|naga|quezon|makati|baguio|cagayan|zamboanga|batangas|pampanga|laguna|bicol|visayas|mindanao|luzon|iloilo|pasig|taguig|legazpi|tacloban|antipolo|caloocan|marikina|lucena|lipa|olongapo|dagupan|butuan|bacolod|general santos/i;

// ── Tagalog male weather script ───────────────────────────────────────────────
function buildMaleScript(w, location, isPhil) {
  const cond = tagalogCondition(w?.desc || '');
  const h    = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false });
  const greeting = parseInt(h) < 12 ? 'Magandang umaga' : parseInt(h) < 18 ? 'Magandang hapon' : 'Magandang gabi';

  let script =
    `${greeting} po sa inyong lahat! Ako si Angelo, ang inyong weather anchor. ` +
    `Ito ang pinakabagong ulat ng panahon para sa ${w?.place || location}. ` +
    `Ang kasalukuyang temperatura ay ${w?.tempC || '?'} degrees Celsius, ` +
    `at ang pakiramdam sa katawan ay ${w?.feelsC || '?'} degrees. ` +
    `Ang kalagayan ng panahon ay ${cond}. ` +
    `Ang halumigmig ay ${w?.humidity || '?'} porsyento. ` +
    `Ang bilis ng hangin ay ${w?.windKmph || '?'} kilometro bawat oras, ` +
    `patungong ${w?.windDir || 'hindi kilala'}. ` +
    `Ang pinakamataas na temperatura ngayon ay ${w?.maxC || '?'} degrees, ` +
    `at ang pinakamababa ay ${w?.minC || '?'} degrees Celsius. `;

  if (isPhil) {
    script += `Para sa mga babala tungkol sa bagyo at storm signal, ` +
      `mangyaring subaybayan ang opisyal na pahayag ng PAGASA. `;
  }

  script +=
    `Mag-ingat po kayo lagi sa inyong pag-byahe. ` +
    `Manatiling ligtas ang lahat. ` +
    `Ito po ay ang inyong weather update mula sa Team Startcope Beta. ` +
    `Salamat po sa pakikinig at magandang araw sa inyong lahat!`;

  return script;
}

// ── Tagalog female weather script (BlessicaNeural) ───────────────────────────
function buildFemaleScript(w, location, isPhil) {
  const cond = tagalogCondition(w?.desc || '');
  const h    = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false });
  const greeting = parseInt(h) < 12 ? 'Magandang umaga' : parseInt(h) < 18 ? 'Magandang hapon' : 'Magandang gabi';

  let script =
    `${greeting} po! Ako si Blessica, at ito ang inyong weather update para sa ${w?.place || location}. ` +
    `Ngayon, ang temperatura ay ${w?.tempC || '?'} degrees Celsius. ` +
    `Ang pakiramdam sa katawan ay ${w?.feelsC || '?'} degrees dahil sa halumigmig na ${w?.humidity || '?'} porsyento. ` +
    `Ang kalagayan ng panahon ay ${cond}. ` +
    `Ang hangin ay umiihip sa bilis na ${w?.windKmph || '?'} kilometro bawat oras, ` +
    `patungong ${w?.windDir || 'hindi kilala'}. ` +
    `Inaasahang maaabot ng temperatura ang ${w?.maxC || '?'} degrees ngayong araw, ` +
    `habang ang pinakamababa ay magiging ${w?.minC || '?'} degrees Celsius. `;

  if (isPhil) {
    script += `Para sa mga kababayan na apektado ng panahon, ` +
      `mangyaring makinig sa mga opisyal na babala ng PAGASA. ` +
      `Ang inyong kaligtasan ang pinakamahalaga. `;
  }

  script +=
    `Kung lalabas kayo ngayon, siguraduhing magdala ng payong kung kinakailangan. ` +
    `Ingatan ang inyong sarili at ang inyong pamilya. ` +
    `Ito po ang weather update mula sa Team Startcope Beta. ` +
    `Salamat po at manatiling ligtas ang lahat. Hanggang sa muli!`;

  return script;
}

function buildTyphoonScript(pg, w, gender) {
  const anchor = gender === 'female' ? 'Ako si Blessica' : 'Ako si Angelo';
  let script = `Magandang araw po! ${anchor}, at ito ang emergency weather update para sa Pilipinas. `;
  if (pg.active) {
    script += `BABALA! May aktibong tropical weather system na natukoy sa Pilipinas. `;
    if (pg.storms?.length) script += `${pg.storms.join(', ')}. `;
    if (pg.lpa) script += `May Low Pressure Area o LPA na aktibo sa ating hangganan. `;
    script += `Mangyaring subaybayan ang mga opisyal na abiso ng PAGASA para sa kaligtasan ng lahat. `;
  } else {
    script += `Mabuting balita — wala pang aktibong bagyo sa Pilipinas sa kasalukuyan. Ang kalagayan ng panahon ay normal. `;
  }
  if (w) {
    script += `Sa Manila, ang temperatura ay ${w.tempC} degrees Celsius at ang kalagayan ay ${tagalogCondition(w.desc)}. `;
  }
  script += `Manatiling ligtas ang lahat. Salamat sa pakikinig mula sa Team Startcope Beta. Mabuhay tayong lahat!`;
  return script;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.config = {
  name:            'weather',
  version:         '3.0.0',
  hasPermssion:    0,
  credits:         'TEAM STARTCOPE BETA',
  description:     'Cinematic weather video — location scene + radar map + male/female Tagalog voice. FREE.',
  commandCategory: 'Utility',
  usages:          '[location] | video [location] | female [location] | male [location] | typhoon | bagyo | apis',
  cooldowns:       10,
};

// ═══════════════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P = global.config?.PREFIX || '!';

  // ── No args → help ─────────────────────────────────────────────────────────
  if (!args.length) {
    return api.sendMessage(
      `🌤️ ${bold('WEATHER V3 — CINEMATIC VIDEO + RADAR + TAGALOG VOICE!')}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🆕 ${bold('BAGONG FEATURES:')}\n` +
      `  🏙️ AI-generated location scene na may mga tao\n` +
      `  🌧️ Live rain radar map (Rainviewer)\n` +
      `  🎙️ Babae at lalaki na Tagalog na boses\n` +
      `  📺 Cinematic 59-segundo na video\n\n` +
      `📋 ${bold('MGA COMMAND:')}\n` +
      `${P}weather [lugar]           — Image + text + boses\n` +
      `${P}weather video [lugar]     — Cinematic 59s video\n` +
      `${P}weather female [lugar]    — Babae na boses (Blessica)\n` +
      `${P}weather male [lugar]      — Lalaki na boses (Angelo)\n` +
      `${P}weather typhoon           — PH typhoon tracker\n` +
      `${P}weather apis              — Listahan ng mga API\n\n` +
      `📍 ${bold('MGA HALIMBAWA:')}\n` +
      `${P}weather video Naga City\n` +
      `${P}weather female Manila\n` +
      `${P}weather video Cebu Philippines\n` +
      `${P}weather typhoon\n\n` +
      `🎙️ Voice 1: fil-PH-AngeloNeural (lalaki)\n` +
      `🎙️ Voice 2: fil-PH-BlessicaNeural (babae)\n` +
      `🏷️ ${bold('TEAM STARTCOPE BETA')} 🇵🇭`,
      threadID, messageID
    );
  }

  const sub = args[0].toLowerCase();

  // ── APIs info ───────────────────────────────────────────────────────────────
  if (sub === 'apis' || sub === 'api') {
    api.setMessageReaction('📋', messageID, () => {}, true);
    return api.sendMessage(API_INFO, threadID, messageID);
  }

  // ── Typhoon/Bagyo tracker ───────────────────────────────────────────────────
  if (sub === 'typhoon' || sub === 'bagyo') {
    const genderArg = args[1]?.toLowerCase() === 'female' ? 'female' : 'male';
    api.setMessageReaction('🌀', messageID, () => {}, true);
    api.sendMessage(`⏳ ${bold('Sinusuri ang datos ng PAGASA + Rainviewer radar...')} Sandali lang po.`, threadID);

    try {
      const [phJSON, imgFp, pagasa] = await Promise.allSettled([
        getWeatherJSON('Manila Philippines'),
        downloadWeatherImage('Manila Philippines'),
        checkPAGASA(),
      ]);

      const w   = phJSON.status === 'fulfilled'  ? parseWeather(phJSON.value, 'Manila') : null;
      const img = imgFp.status === 'fulfilled'   ? imgFp.value : null;
      const pg  = pagasa.status === 'fulfilled'  ? pagasa.value : { active: false };
      const now = new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

      let body =
        `🌀 ${bold('PHILIPPINES TYPHOON TRACKER')} 🇵🇭\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 ${now} (Oras ng Pilipinas)\n\n`;

      if (pg.active) {
        body += `⚠️ ${bold('MAY AKTIBONG TROPICAL WEATHER SYSTEM!')}\n`;
        if (pg.storms?.length) body += `🌀 ${bold('Bagyo:')} ${pg.storms.join(', ')}\n`;
        if (pg.lpa) body += `🌩️ ${bold('Low Pressure Area (LPA) aktibo')}\n`;
        body += `\n📻 Subaybayan ang PAGASA para sa pinakabagong balita!\n`;
      } else {
        body += `✅ ${bold('Walang aktibong bagyo')}\n` +
          `Normal ang kalagayan ng panahon sa Pilipinas.\n`;
      }

      if (w) {
        body +=
          `\n🌡️ ${bold('Manila ngayon:')}\n` +
          `  Temp: ${w.tempC}°C | Pakiramdam: ${w.feelsC}°C\n` +
          `  Langit: ${w.desc}\n` +
          `  Hangin: ${w.windKmph} km/h ${w.windDir}\n` +
          `  Halumigmig: ${w.humidity}%\n` +
          `  Presyon: ${w.pressure} hPa\n`;
      }

      body +=
        `\n🌧️ ${bold('Radar:')} Rainviewer (api.rainviewer.com)\n` +
        `📡 ${bold('Pinagkukunan:')} PAGASA · wttr.in\n` +
        `🔗 pagasa.dost.gov.ph\n\n` +
        `📋 ${bold('Para sa listahan ng APIs:')} ${P}weather apis`;

      const voiceText = buildTyphoonScript(pg, w, genderArg);
      const rawVoice  = await makeVoice(voiceText, genderArg).catch(() => null);
      const voice     = rawVoice ? await mixVoiceWithBg(rawVoice).catch(() => rawVoice) : null;

      api.setMessageReaction('✅', messageID, () => {}, true);
      if (img) {
        await new Promise(r => api.sendMessage({ body, attachment: fs.createReadStream(img) }, threadID, r));
        cleanup(img);
      } else {
        await new Promise(r => api.sendMessage(body, threadID, r));
      }
      if (voice) {
        const vLabel = genderArg === 'female'
          ? '🎙️ Babae na Tagalog voice (BlessicaNeural) + music:'
          : '🎙️ Tagalog weather bulletin (AngeloNeural) + music:';
        api.sendMessage({ body: vLabel, attachment: fs.createReadStream(voice) }, threadID, () => cleanup(voice));
      }
      return;

    } catch (e) {
      api.setMessageReaction('❌', messageID, () => {}, true);
      return api.sendMessage(`❌ ${bold('Hindi nakuha ang typhoon data.')}\n${e.message}`, threadID, messageID);
    }
  }

  // ── Parse subcommand + gender + location ────────────────────────────────────
  let isVideo = false;
  let gender  = 'male';
  let locParts = [...args];

  if (sub === 'video')  { isVideo = true;   locParts = args.slice(1); }
  if (sub === 'female') { gender  = 'female'; locParts = args.slice(1); }
  if (sub === 'male')   { gender  = 'male';   locParts = args.slice(1); }

  // Support: !weather video female [location] or !weather female video [location]
  if (isVideo && locParts[0]?.toLowerCase() === 'female') { gender = 'female'; locParts = locParts.slice(1); }
  if (isVideo && locParts[0]?.toLowerCase() === 'male')   { gender = 'male';   locParts = locParts.slice(1); }
  if (!isVideo && locParts[0]?.toLowerCase() === 'video') { isVideo = true;    locParts = locParts.slice(1); }

  const location = locParts.join(' ').trim();
  if (!location) {
    return api.sendMessage(
      `❌ Magbigay ng lugar.\nHalimbawa: ${P}weather ${isVideo ? 'video ' : ''}${gender === 'female' ? 'female ' : ''}Naga City`,
      threadID, messageID
    );
  }

  const genderLabel = gender === 'female'
    ? '👩 Babae (BlessicaNeural)'
    : '👨 Lalaki (AngeloNeural)';

  api.setMessageReaction('🌤️', messageID, () => {}, true);
  api.sendMessage(
    isVideo
      ? `⏳ ${bold('Gumagawa ng cinematic weather video para sa')} ${bold(location)}...\n` +
        `🎙️ Boses: ${genderLabel}\n` +
        `🏙️ Kumukuha ng location scene at radar map...\n` +
        `⏱️ Inaabangan: 1–3 minuto`
      : `⏳ ${bold('Kinukuha ang panahon para sa')} ${bold(location)}...`,
    threadID
  );

  try {
    const [jsonRes, imgRes, geoRes] = await Promise.allSettled([
      getWeatherJSON(location),
      downloadWeatherImage(location),
      geocodeLocation(location),
    ]);

    if (jsonRes.status === 'rejected' && imgRes.status === 'rejected') {
      throw new Error('Hindi maabot ang weather service. Tingnan ang pangalan ng lugar.');
    }

    const wData  = jsonRes.status === 'fulfilled' ? jsonRes.value : null;
    const imgFp  = imgRes.status === 'fulfilled'  ? imgRes.value : null;
    const geo    = geoRes.status === 'fulfilled'  ? geoRes.value : null;
    const w      = wData ? parseWeather(wData, location) : null;
    const isPhil = PH_RE.test(location);
    const now    = new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

    const condTagalog   = tagalogCondition(w?.desc || '');
    const hasTyphoon    = w && /typhoon|tropical storm|depression|low pressure|LPA/i.test(w.desc);
    const overlayLabel  = w ? `${w.place}${w.country && !isPhil ? ', ' + w.country : ''}` : location;

    let body =
      `🌤️ ${bold('WEATHER UPDATE')} — ${bold(overlayLabel)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 ${now} (Oras ng PH)\n` +
      `🎙️ Boses: ${genderLabel}\n`;

    if (hasTyphoon) body += `\n⚠️ ${bold('MAY TROPICAL WEATHER SYSTEM NA NATUKOY!')}\n`;

    if (w) {
      body +=
        `\n🌡️ ${bold('Temperatura:')}  ${w.tempC}°C  (Pakiramdam ${w.feelsC}°C)\n` +
        `🌤️ ${bold('Kalagayan:')}   ${condTagalog}\n` +
        `💧 ${bold('Halumigmig:')}  ${w.humidity}%\n` +
        `💨 ${bold('Hangin:')}      ${w.windKmph} km/h ${w.windDir}\n` +
        `👁️ ${bold('Visibility:')} ${w.visibility} km\n` +
        `🌡️ ${bold('Presyon:')}    ${w.pressure} hPa\n` +
        `☀️ ${bold('UV Index:')}   ${w.uvIndex}\n` +
        `📈 ${bold('Pinakamataas:')} ${w.maxC}°C  |  ${bold('Pinakamababa:')} ${w.minC}°C\n`;
    }

    if (isPhil) body += `\n🇵🇭 ${bold('PH typhoon:')} pagasa.dost.gov.ph`;
    body +=
      `\n\n📡 ${bold('Pinagkukunan:')} wttr.in · Rainviewer · Pollinations AI · Open-Meteo\n` +
      `📋 ${bold('Lahat ng APIs:')} ${P}weather apis`;

    const speechText = gender === 'female'
      ? buildFemaleScript(w, location, isPhil)
      : buildMaleScript(w, location, isPhil);

    // ── VIDEO MODE ──────────────────────────────────────────────────────────
    if (isVideo) {
      const [locImgRes, radarRes, rawVoiceRes] = await Promise.allSettled([
        generateLocationScene(overlayLabel, w?.desc || ''),
        downloadRadarTile(geo?.lat, geo?.lon),
        makeVoice(speechText, gender),
      ]);

      // Location scene — fallback to wttr image if Pollinations fails
      const locationImg = locImgRes.status === 'fulfilled'
        ? locImgRes.value
        : imgFp || null;

      if (!locationImg) throw new Error('Walang background image para sa video.');

      const radarImg  = radarRes.status === 'fulfilled'   ? radarRes.value : null;
      const rawVoice  = rawVoiceRes.status === 'fulfilled' ? rawVoiceRes.value : null;

      if (!rawVoice) throw new Error('Hindi nagawa ang Tagalog voice.');

      const audioFp = await mixVoiceWithBg(rawVoice).catch(() => rawVoice);
      const videoFp = await makeWeatherVideoV2({ locationImg, radarImg, audioFp, w, location: overlayLabel, gender });

      api.setMessageReaction('✅', messageID, () => {}, true);

      const vidCaption =
        body +
        `\n\n🎬 ${bold('59-segundo cinematic weather video!')}\n` +
        `🏙️ ${bold('Location scene:')} AI-generated (Pollinations)\n` +
        (radarImg ? `🌧️ ${bold('Radar:')} Rainviewer live rain radar\n` : '') +
        `🎙️ ${bold('Tagalog voice:')} ${gender === 'female' ? 'fil-PH-BlessicaNeural (babae)' : 'fil-PH-AngeloNeural (lalaki)'}`;

      return api.sendMessage(
        { body: vidCaption, attachment: fs.createReadStream(videoFp) },
        threadID,
        () => {
          cleanup(locationImg !== imgFp ? locationImg : null);
          cleanup(radarImg);
          cleanup(rawVoice !== audioFp ? rawVoice : null);
          cleanup(audioFp);
          cleanup(videoFp);
          cleanup(imgFp);
        }
      );
    }

    // ── IMAGE + VOICE MODE ──────────────────────────────────────────────────
    const rawVoice = await makeVoice(speechText, gender).catch(() => null);
    const voiceFp  = rawVoice ? await mixVoiceWithBg(rawVoice).catch(() => rawVoice) : null;
    api.setMessageReaction('✅', messageID, () => {}, true);

    if (imgFp) {
      await new Promise(r => api.sendMessage({ body, attachment: fs.createReadStream(imgFp) }, threadID, r));
      cleanup(imgFp);
    } else {
      await new Promise(r => api.sendMessage(body, threadID, r));
    }

    if (voiceFp) {
      const vLabel = gender === 'female'
        ? '🎙️ Babae na Tagalog weather bulletin (BlessicaNeural) + music:'
        : '🎙️ Tagalog weather bulletin (AngeloNeural) + music:';
      api.sendMessage(
        { body: vLabel, attachment: fs.createReadStream(voiceFp) },
        threadID,
        () => cleanup(voiceFp)
      );
    }
    return;

  } catch (e) {
    api.setMessageReaction('❌', messageID, () => {}, true);
    return api.sendMessage(
      `❌ ${bold('Nabigo ang weather.')}\n🔧 ${e.message?.slice(0, 120)}\n\n` +
      `💡 Subukan: ${P}weather video Naga City`,
      threadID, messageID
    );
  }
};
