/**
 * !weather — Real-time weather with image, Tagalog voice, and video
 * Uses wttr.in (FREE, no API key) + PAGASA public data + msedge-tts Tagalog voice
 *
 * Usage:
 *   !weather [location]           — Image + text + Tagalog voice
 *   !weather video [location]     — 59-second weather video with Tagalog voice
 *   !weather typhoon / bagyo      — Philippines typhoon/LPA tracker
 *   !weather male [location]      — Force male Tagalog voice
 *   !weather female [location]    — Force female Tagalog voice
 */

const axios           = require('axios');
const fs              = require('fs-extra');
const path            = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const { exec }        = require('child_process');
const bold            = require('../../utils/bold');

const TEMP_DIR = path.join(process.cwd(), 'utils/data/weather_temp');
fs.ensureDirSync(TEMP_DIR);

const UA      = 'curl/7.68.0';
const cleanup = (fp) => setTimeout(() => fs.remove(fp).catch(() => {}), 300000);

// ── Real Philippine city locations for video overlays ────────────────────────
const PH_CITIES = [
  'Naga City, Camarines Sur',
  'Manila, Metro Manila',
  'Cebu City, Cebu',
  'Davao City, Davao del Sur',
  'Baguio City, Benguet',
  'Cagayan de Oro, Misamis Oriental',
  'Iloilo City, Iloilo',
  'Zamboanga City, Zamboanga del Sur',
  'Bacolod City, Negros Occidental',
  'Antipolo City, Rizal',
  'Quezon City, Metro Manila',
  'Makati City, Metro Manila',
  'Pasig City, Metro Manila',
  'Taguig City, Metro Manila',
  'Marikina City, Metro Manila',
  'Caloocan City, Metro Manila',
  'Legazpi City, Albay',
  'Lucena City, Quezon',
  'Lipa City, Batangas',
  'San Fernando, Pampanga',
  'Tacloban City, Leyte',
  'General Santos City, South Cotabato',
  'Butuan City, Agusan del Norte',
  'Olongapo City, Zambales',
  'Dagupan City, Pangasinan',
];

// ── wttr.in helpers ───────────────────────────────────────────────────────────
async function getWeatherJSON(loc) {
  const { data } = await axios.get(
    `https://wttr.in/${encodeURIComponent(loc)}?format=j1`,
    { timeout: 15000, headers: { 'User-Agent': UA } }
  );
  return typeof data === 'string' ? JSON.parse(data) : data;
}

async function downloadWeatherImage(loc) {
  const fp = path.join(TEMP_DIR, `wimg_${Date.now()}.png`);
  const { data } = await axios.get(
    `https://wttr.in/${encodeURIComponent(loc)}.png?1&lang=tl`,
    { responseType: 'arraybuffer', timeout: 25000, headers: { 'User-Agent': UA } }
  );
  fs.writeFileSync(fp, Buffer.from(data));
  return fp;
}

// ── PAGASA typhoon check ──────────────────────────────────────────────────────
async function checkPAGASA() {
  const sources = [
    { url: 'https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin.json', type: 'json' },
    { url: 'https://bagong.pagasa.dost.gov.ph/tropical-cyclone/public-storm-warning-signals', type: 'html' },
  ];
  for (const s of sources) {
    try {
      const { data } = await axios.get(s.url, { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (s.type === 'json') {
        const d = typeof data === 'string' ? JSON.parse(data) : data;
        return { active: !!(d.cyclon || d.cyclone || d.tropical_cyclone), raw: d };
      }
      const storm = data.match(/(?:Typhoon|Tropical Storm|Tropical Depression|Severe Tropical Storm)\s+(["']?)([A-Z][a-zA-Z]+)\1/g) || [];
      const lpa   = /low pressure area|LPA/i.test(data);
      return { active: storm.length > 0 || lpa, storms: storm, lpa };
    } catch {}
  }
  return { active: false };
}

// ── Run a shell command ───────────────────────────────────────────────────────
function run(cmd, timeoutMs = 90000) {
  return new Promise((res, rej) =>
    exec(cmd, { maxBuffer: 1024 * 1024 * 100, timeout: timeoutMs }, (e, _, se) =>
      e ? rej(new Error(se?.slice(0, 300) || e.message)) : res()
    )
  );
}

// ── Tagalog TTS voice ─────────────────────────────────────────────────────────
// male: fil-PH-AngeloNeural | female: fil-PH-BlessicaNeural
async function makeVoice(text, gender = 'male') {
  const fp  = path.join(TEMP_DIR, `wvoice_${Date.now()}.mp3`);
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    gender === 'female' ? 'fil-PH-BlessicaNeural' : 'fil-PH-AngeloNeural',
    OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
  );
  const { audioStream } = tts.toStream(text, { rate: '-5%', pitch: '+0Hz' });
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

// ── Breaking-news background music via ffmpeg synth ───────────────────────────
const NEWS_BG_CHORD =
  '(0.28*sin(2*PI*146*t)+0.22*sin(2*PI*293*t)+0.18*sin(2*PI*349*t)' +
  '+0.14*sin(2*PI*440*t)+0.10*sin(2*PI*587*t))' +
  '*(1+0.55*sin(2*PI*1.2*t))';

async function makeNewsBgMusic(durationSec, outPath) {
  const cmd = [
    'ffmpeg -y',
    `-f lavfi -i "aevalsrc=${NEWS_BG_CHORD}*0.45:s=44100:d=${durationSec}"`,
    `-filter_complex "[0:a]volume=0.85,aecho=0.8:0.6:180|360:0.30|0.15[out]"`,
    '-map "[out]"',
    '-ar 44100 -ac 2 -b:a 64k',
    `"${outPath}"`,
  ].join(' ');
  await run(cmd, 30000);
}

// ── Mix TTS voice with news background music ──────────────────────────────────
async function mixVoiceWithBg(voiceFp) {
  const bgFp  = path.join(TEMP_DIR, `wbg_${Date.now()}.mp3`);
  const mixFp = path.join(TEMP_DIR, `wmix_${Date.now()}.mp3`);

  const durRaw = await new Promise(r =>
    exec(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voiceFp}"`,
      (_, out) => r(out?.trim())
    )
  );
  const dur = Math.ceil(parseFloat(durRaw) || 20) + 2;

  try {
    await makeNewsBgMusic(dur, bgFp);
    const mixCmd = [
      'ffmpeg -y',
      `-i "${voiceFp}"`,
      `-i "${bgFp}"`,
      `-filter_complex`,
      `"[1:a]volume=0.22[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]"`,
      `-map "[out]"`,
      '-ar 44100 -ac 2 -b:a 128k',
      `"${mixFp}"`,
    ].join(' ');
    await run(mixCmd, 30000);
    if (!fs.existsSync(mixFp) || fs.statSync(mixFp).size < 1000) throw new Error('mix too small');
    try { fs.removeSync(bgFp); } catch {}
    return mixFp;
  } catch (e) {
    try { fs.removeSync(bgFp); } catch {}
    console.log('[Weather] BG mix failed, using plain voice:', e.message?.slice(0, 60));
    return voiceFp;
  }
}

// ── Weather VIDEO — always exactly 59 seconds ─────────────────────────────────
function makeWeatherVideo(imgFp, voiceFp, locationLabel) {
  return new Promise((resolve, reject) => {
    const outFp = path.join(TEMP_DIR, `wvid_${Date.now()}.mp4`);
    const label = locationLabel.replace(/['"\\]/g, '').slice(0, 60);
    const TARGET_SEC = 59;

    // Build a 59s video: zoom-pan on weather image + voice overlay padded/trimmed to 59s
    // If voice is shorter than 59s, pad with silence. If longer, cut at 59s.
    const cmd =
      `ffmpeg -y -loop 1 -i "${imgFp}" -i "${voiceFp}" ` +
      `-vf "zoompan=z='min(zoom+0.0010,1.35)':d=1500:s=854x480,` +
      `drawtext=text='${label}':fontsize=28:fontcolor=white:` +
      `box=1:boxcolor=black@0.55:boxborderw=8:x=(w-tw)/2:y=18,` +
      `drawtext=text='WEATHER UPDATE':fontsize=18:fontcolor=yellow:` +
      `box=1:boxcolor=black@0.40:boxborderw=4:x=(w-tw)/2:y=58" ` +
      `-c:v libx264 -preset fast -crf 26 -pix_fmt yuv420p ` +
      `-af "apad=whole_dur=${TARGET_SEC}" ` +
      `-c:a aac -b:a 96k -t ${TARGET_SEC} "${outFp}" 2>&1`;

    exec(cmd, { timeout: 120000, maxBuffer: 1024 * 1024 * 200 }, (e) => {
      if (!e && fs.existsSync(outFp) && fs.statSync(outFp).size > 20000) {
        return resolve(outFp);
      }
      // Fallback: simple 59s static video
      const cmd2 =
        `ffmpeg -y -loop 1 -i "${imgFp}" -i "${voiceFp}" ` +
        `-c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p ` +
        `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ` +
        `-af "apad=whole_dur=${TARGET_SEC}" ` +
        `-c:a aac -b:a 64k -t ${TARGET_SEC} "${outFp}" 2>&1`;
      exec(cmd2, { timeout: 120000 }, (e2) => {
        if (e2 || !fs.existsSync(outFp) || fs.statSync(outFp).size < 10000) {
          return reject(new Error('ffmpeg failed'));
        }
        resolve(outFp);
      });
    });
  });
}

// ── Parse wttr.in JSON ────────────────────────────────────────────────────────
function parseWeather(data, fallbackLoc) {
  const cur  = data.current_condition?.[0] || {};
  const area = data.nearest_area?.[0];
  return {
    place:      area?.areaName?.[0]?.value || fallbackLoc,
    country:    area?.country?.[0]?.value  || '',
    tempC:      cur.temp_C       || '?',
    feelsC:     cur.FeelsLikeC  || '?',
    humidity:   cur.humidity    || '?',
    windKmph:   cur.windspeedKmph || '?',
    windDir:    cur.winddir16Point || '?',
    desc:       cur.weatherDesc?.[0]?.value || 'N/A',
    visibility: cur.visibility  || '?',
    pressure:   cur.pressure    || '?',
    uvIndex:    cur.uvIndex     || '?',
    maxC:       data.weather?.[0]?.maxtempC || '?',
    minC:       data.weather?.[0]?.mintempC || '?',
  };
}

// ── Build Tagalog weather speech script ───────────────────────────────────────
function buildTagalogWeatherScript(w, location, isPhil = false) {
  if (!w) {
    return `Magandang araw po! Ito ang weather update para sa ${location}. ` +
      `Pakitingnan ang larawan para sa kumpletong forecast. ` +
      `Manatiling ligtas ang lahat. Salamat po!`;
  }

  const condTagalog = tagalogCondition(w.desc);
  let script =
    `Magandang araw po sa inyong lahat! Ito ang inyong weather update para sa ${w.place}. ` +
    `Kasalukuyang temperatura ay ${w.tempC} degrees Celsius, ` +
    `at pakiramdam ay ${w.feelsC} degrees. ` +
    `Ang lagay ng panahon ay ${condTagalog}. ` +
    `Ang halumigmig ay ${w.humidity} porsyento. ` +
    `Hangin: ${w.windKmph} kilometro bawat oras patungong ${w.windDir}. ` +
    `Pinakamataas ngayong araw: ${w.maxC} degrees, pinakamababa: ${w.minC} degrees. `;

  if (isPhil) {
    script += `Para sa mga bagyo at storm signal, bisitahin ang pagasa punto dost punto gov punto ph. `;
  }

  script +=
    `Mag-ingat po kayo lagi at manatiling ligtas. ` +
    `Ang balita at weather na ito ay para sa inyo mula sa inyong bot. ` +
    `Salamat sa pakikinig. Mabuhay tayong lahat!`;

  return script;
}

function buildTagalogTyphoonScript(pg, w) {
  let script = `Magandang araw po! Ito ang weather at typhoon update para sa Pilipinas. `;
  if (pg.active) {
    script += `BABALA! May aktibong tropical weather system sa Pilipinas. `;
    if (pg.storms?.length) script += `${pg.storms.join(', ')}. `;
    if (pg.lpa) script += `May Low Pressure Area o LPA na aktibo. `;
    script += `Mangyaring subaybayan ang mga opisyal na abiso ng PAGASA para sa inyong kaligtasan. `;
  } else {
    script += `Wala pang aktibong bagyo sa Pilipinas sa kasalukuyan. Ang kalagayan ng panahon ay normal. `;
  }
  if (w) {
    script += `Sa Manila, ang temperatura ay ${w.tempC} degrees Celsius. `;
  }
  script += `Manatiling ligtas ang lahat. Salamat sa pakikinig mula sa inyong bot!`;
  return script;
}

function tagalogCondition(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('sunny') || d.includes('clear'))       return 'maliwanag at maaraw';
  if (d.includes('partly cloudy'))                       return 'bahagyang maulap';
  if (d.includes('cloudy') || d.includes('overcast'))   return 'maulap';
  if (d.includes('thunder') || d.includes('storm'))     return 'may kulog at kidlat';
  if (d.includes('heavy rain') || d.includes('pouring')) return 'malakas na ulan';
  if (d.includes('rain') || d.includes('drizzle'))      return 'makulimlim at may ulan';
  if (d.includes('fog') || d.includes('mist'))          return 'may ambon at ulap';
  if (d.includes('snow'))                               return 'may niyebe';
  if (d.includes('haze'))                               return 'maalikabok';
  return desc;
}

const PH_RE = /philippines|pilipinas|manila|cebu|davao|naga|quezon|makati|baguio|cagayan|zamboanga|batangas|pampanga|laguna|bicol|visayas|mindanao|luzon|iloilo|pasig|taguig|legazpi|tacloban|antipolo|caloocan|marikina|lucena|lipa|olongapo|dagupan|butuan|bacolod|general santos/i;

// ── Module exports ────────────────────────────────────────────────────────────
module.exports.config = {
  name:            'weather',
  version:         '2.0.0',
  hasPermssion:    0,
  credits:         'TEAM STARTCOPE BETA',
  description:     'Real-time weather — image, Tagalog voice, 59s video, Philippines typhoon tracker. FREE.',
  commandCategory: 'Utility',
  usages:          '[location] | video [location] | typhoon | bagyo | male/female [location]',
  cooldowns:       10,
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P = global.config?.PREFIX || '!';

  if (!args.length) {
    return api.sendMessage(
      `🌤️ ${bold('WEATHER COMMAND — TAGALOG VOICE + VIDEO!')}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Walang bayad! Gumagamit ng wttr.in!\n\n` +
      `📋 ${bold('MGA COMMAND:')}\n` +
      `${P}weather [lugar]         — Larawan + text + boses\n` +
      `${P}weather video [lugar]   — 59-segundo na video\n` +
      `${P}weather typhoon         — PH typhoon tracker\n` +
      `${P}weather female [lugar]  — Boses ng babae\n\n` +
      `📍 ${bold('MGA HALIMBAWA:')}\n` +
      `${P}weather Naga City\n` +
      `${P}weather Manila Philippines\n` +
      `${P}weather video Cebu\n` +
      `${P}weather female Baguio\n` +
      `${P}weather typhoon\n\n` +
      `🎙️ Nagse-send ng larawan + Tagalog voice!`,
      threadID, messageID
    );
  }

  const sub = args[0].toLowerCase();

  // ── Typhoon/Bagyo tracker ──────────────────────────────────────────────────
  if (sub === 'typhoon' || sub === 'bagyo') {
    api.setMessageReaction('🌀', messageID, () => {}, true);
    api.sendMessage(`⏳ ${bold('Sinusuri ang datos ng PAGASA...')} Sandali lang po.`, threadID);

    try {
      const [phJSON, imgFp, pagasa] = await Promise.allSettled([
        getWeatherJSON('Manila Philippines'),
        downloadWeatherImage('Manila Philippines'),
        checkPAGASA(),
      ]);

      const w   = phJSON.status === 'fulfilled' ? parseWeather(phJSON.value, 'Manila') : null;
      const img = imgFp.status === 'fulfilled' ? imgFp.value : null;
      const pg  = pagasa.status === 'fulfilled' ? pagasa.value : { active: false };
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
          `\n🌡️ ${bold('Kasalukuyang Panahon sa Manila:')}\n` +
          `  Temp: ${w.tempC}°C | Pakiramdam: ${w.feelsC}°C\n` +
          `  Langit: ${w.desc}\n` +
          `  Hangin: ${w.windKmph} km/h ${w.windDir}\n` +
          `  Halumigmig: ${w.humidity}%\n` +
          `  Presyon: ${w.pressure} hPa\n`;
      }

      body += `\n📡 ${bold('Pinagkukunan:')} PAGASA · wttr.in\n🔗 pagasa.dost.gov.ph`;

      const voiceText = buildTagalogTyphoonScript(pg, w);
      const rawVoice = await makeVoice(voiceText, 'male').catch(() => null);
      const voice    = rawVoice ? await mixVoiceWithBg(rawVoice).catch(() => rawVoice) : null;

      api.setMessageReaction('✅', messageID, () => {}, true);

      if (img) {
        await new Promise(r => api.sendMessage({ body, attachment: fs.createReadStream(img) }, threadID, r));
        cleanup(img);
      } else {
        await new Promise(r => api.sendMessage(body, threadID, r));
      }
      if (voice) {
        api.sendMessage({ body: '🎙️ Tagalog weather bulletin na may music:', attachment: fs.createReadStream(voice) }, threadID, () => cleanup(voice));
      }
      return;

    } catch (e) {
      api.setMessageReaction('❌', messageID, () => {}, true);
      return api.sendMessage(`❌ ${bold('Hindi nakuha ang typhoon data.')}\n${e.message}`, threadID, messageID);
    }
  }

  // ── Detect mode ────────────────────────────────────────────────────────────
  let isVideo  = false;
  let gender   = 'male';
  let locParts = [...args];

  if (sub === 'video')  { isVideo = true;  locParts = args.slice(1); }
  if (sub === 'male')   { gender  = 'male'; locParts = args.slice(1); }
  if (sub === 'female') { gender  = 'female'; locParts = args.slice(1); }

  const location = locParts.join(' ').trim();
  if (!location) {
    return api.sendMessage(
      `❌ Magbigay ng lugar.\nHalimbawa: ${P}weather ${isVideo ? 'video ' : ''}Naga City`,
      threadID, messageID
    );
  }

  api.setMessageReaction('🌤️', messageID, () => {}, true);
  api.sendMessage(
    isVideo
      ? `⏳ ${bold('Gumagawa ng 59-segundo na weather video para sa')} ${bold(location)}... (30–90 segundo)`
      : `⏳ ${bold('Kinukuha ang panahon para sa')} ${bold(location)}...`,
    threadID
  );

  try {
    const [jsonRes, imgRes] = await Promise.allSettled([
      getWeatherJSON(location),
      downloadWeatherImage(location),
    ]);

    if (jsonRes.status === 'rejected' && imgRes.status === 'rejected') {
      throw new Error('Hindi maabot ang weather service. Tingnan ang pangalan ng lugar.');
    }

    const wData  = jsonRes.status === 'fulfilled' ? jsonRes.value : null;
    const imgFp  = imgRes.status === 'fulfilled' ? imgRes.value : null;
    const w      = wData ? parseWeather(wData, location) : null;
    const isPhil = PH_RE.test(location);
    const now    = new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

    const hasTyphoon = w && /typhoon|tropical storm|depression|low pressure|LPA/i.test(w.desc);

    let body =
      `🌤️ ${bold('WEATHER UPDATE')} — ${bold(w ? `${w.place}${w.country ? ', ' + w.country : ''}` : location)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 ${now} (Oras ng PH)\n`;

    if (hasTyphoon) body += `\n⚠️ ${bold('MAY TROPICAL WEATHER SYSTEM NA NATUKOY!')}\n`;

    if (w) {
      body +=
        `\n🌡️ ${bold('Temperatura:')} ${w.tempC}°C  (Pakiramdam ${w.feelsC}°C)\n` +
        `🌤️ ${bold('Kalagayan:')}   ${w.desc}\n` +
        `💧 ${bold('Halumigmig:')}  ${w.humidity}%\n` +
        `💨 ${bold('Hangin:')}      ${w.windKmph} km/h ${w.windDir}\n` +
        `👁️ ${bold('Visibility:')} ${w.visibility} km\n` +
        `🌡️ ${bold('Presyon:')}    ${w.pressure} hPa\n` +
        `☀️ ${bold('UV Index:')}   ${w.uvIndex}\n` +
        `📈 ${bold('Pinakamataas:')} ${w.maxC}°C  |  ${bold('Pinakamababa:')} ${w.minC}°C\n`;
    }

    if (isPhil) {
      body += `\n🇵🇭 ${bold('PH Typhoon hotline:')} pagasa.dost.gov.ph`;
    }
    body += `\n\n📡 ${bold('Pinagkukunan:')} wttr.in — Libreng real-time na panahon`;

    const speechText = buildTagalogWeatherScript(w, location, isPhil);

    if (isVideo) {
      if (!imgFp) throw new Error('Walang weather image para sa video.');
      const rawVoice = await makeVoice(speechText, gender);
      const voiceFp  = await mixVoiceWithBg(rawVoice).catch(() => rawVoice);
      // Use the real location name for the video overlay
      const overlayLabel = w ? `${w.place}${w.country && !isPhil ? ', ' + w.country : ''}` : location;
      const videoFp  = await makeWeatherVideo(imgFp, voiceFp, overlayLabel);

      api.setMessageReaction('✅', messageID, () => {}, true);
      return api.sendMessage(
        { body: body + `\n\n🎬 ${bold('59-segundo na weather video na may Tagalog voice!')}`, attachment: fs.createReadStream(videoFp) },
        threadID,
        () => { cleanup(imgFp); cleanup(voiceFp); cleanup(videoFp); }
      );

    } else {
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
        api.sendMessage(
          { body: '🎙️ Tagalog weather bulletin na may background music:', attachment: fs.createReadStream(voiceFp) },
          threadID,
          () => cleanup(voiceFp)
        );
      }
      return;
    }

  } catch (e) {
    api.setMessageReaction('❌', messageID, () => {}, true);
    return api.sendMessage(
      `❌ ${bold('Nabigo ang weather.')}\n🔧 ${e.message}\n\n` +
      `💡 Subukan: ${P}weather Manila Philippines`,
      threadID, messageID
    );
  }
};
