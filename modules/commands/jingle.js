'use strict';
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const bold = require('../../utils/bold');

const VERSION = "4.0.0";
const TEAM = "TEAM STARTCOPE BETA";
const TEMP_DIR = path.join(process.cwd(), 'utils/data/jingle_temp');
fs.ensureDirSync(TEMP_DIR);

// ─── VOICE CHARACTERS ────────────────────────────────────────────────────────
const VOICES = {
  jasmine: { voice: 'en-US-JennyNeural',                   opts: { rate: '-8%',  pitch: '+12Hz' }, label: '🎙️ DJ Jasmine · Easy Rock 96.9', fx: 'radio'  },
  dj:      { voice: 'en-US-GuyNeural',                     opts: { rate: '+8%',  pitch: '+0Hz'  }, label: '📻 DJ Announcer (Male)',          fx: null     },
  smooth:  { voice: 'en-US-AriaNeural',                    opts: { rate: '-5%',  pitch: '+8Hz'  }, label: '🌟 Smooth Female',                fx: null     },
  jenny:   { voice: 'en-US-JennyNeural',                   opts: { rate: '+0%',  pitch: '+0Hz'  }, label: '👩 Jenny (US Female)',             fx: null     },
  emma:    { voice: 'en-US-EmmaNeural',                    opts: { rate: '+0%',  pitch: '+0Hz'  }, label: '💁 Emma (Natural)',                fx: null     },
  male:    { voice: 'en-US-ChristopherNeural',             opts: { rate: '-5%',  pitch: '-20Hz' }, label: '👨 Male (US)',                    fx: null     },
  sexy:    { voice: 'en-US-JennyNeural',                   opts: { rate: '-16%', pitch: '-20Hz' }, label: '🥰 Sexy / Smooth',               fx: null     },
  grandpa: { voice: 'en-US-ChristopherNeural',             opts: { rate: '-28%', pitch: '-80Hz' }, label: '👴 Grandpa',                     fx: null     },
  grandma: { voice: 'en-US-AriaNeural',                    opts: { rate: '-25%', pitch: '-50Hz' }, label: '👵 Grandma',                     fx: null     },
  kid:     { voice: 'en-US-AnaNeural',                     opts: { rate: '+10%', pitch: '+60Hz' }, label: '🧒 Kid',                         fx: null     },
  news:    { voice: 'en-US-SteffanNeural',                 opts: { rate: '-5%',  pitch: '+0Hz'  }, label: '📰 News Anchor',                 fx: null     },
  uk:      { voice: 'en-GB-RyanNeural',                    opts: { rate: '-5%',  pitch: '+0Hz'  }, label: '🇬🇧 British Male',                fx: null     },
  uklady:  { voice: 'en-GB-SoniaNeural',                   opts: { rate: '+0%',  pitch: '+0Hz'  }, label: '🇬🇧 British Female',              fx: null     },
  au:      { voice: 'en-AU-WilliamMultilingualNeural',     opts: { rate: '+0%',  pitch: '+0Hz'  }, label: '🦘 Australian',                  fx: null     },
  fil:     { voice: 'fil-PH-AngeloNeural',                 opts: { rate: '-5%',  pitch: '+0Hz'  }, label: '🇵🇭 Filipino Lalaki',             fx: null     },
  filgirl: { voice: 'fil-PH-BlessicaNeural',               opts: { rate: '-5%',  pitch: '+0Hz'  }, label: '🇵🇭 Filipino Babae',              fx: null     },
  indian:  { voice: 'en-IN-PrabhatNeural',                 opts: { rate: '+0%',  pitch: '+0Hz'  }, label: '🇮🇳 Indian',                     fx: null     },
  robot:   { voice: 'en-US-GuyNeural',                     opts: { rate: '-5%',  pitch: '+0Hz'  }, label: '🤖 Robot',                       fx: 'robot'  },
  brian:   { voice: 'en-US-BrianNeural',                   opts: { rate: '+0%',  pitch: '+0Hz'  }, label: '🎤 Brian',                       fx: null     },
  roger:   { voice: 'en-US-RogerNeural',                   opts: { rate: '+5%',  pitch: '+0Hz'  }, label: '📻 Roger (Radio)',                fx: null     },
  sg:      { voice: 'en-SG-WayneNeural',                   opts: { rate: '+0%',  pitch: '+0Hz'  }, label: '🇸🇬 Singaporean',                 fx: null     },
};
const VOICE_KEYS = Object.keys(VOICES);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function cleanup(...files) {
  setTimeout(() => files.forEach(f => fs.remove(f).catch(() => {})), 300000);
}

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50, timeout: 90000 }, (err, _, stderr) => {
      if (err) reject(new Error(stderr?.slice(0, 300) || err.message));
      else resolve();
    });
  });
}

// ─── MICROSOFT NEURAL TTS ─────────────────────────────────────────────────────
async function generateVoice(text, voiceKey, outPath) {
  const cfg = VOICES[voiceKey];
  const tts = new MsEdgeTTS();
  await tts.setMetadata(cfg.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, cfg.opts);
  return new Promise((resolve, reject) => {
    const chunks = [];
    audioStream.on('data', d => chunks.push(d));
    audioStream.on('end', async () => {
      const buf = Buffer.concat(chunks);
      if (buf.length < 100) return reject(new Error('Empty voice audio'));
      await fs.writeFile(outPath, buf);
      resolve();
    });
    audioStream.on('error', reject);
  });
}

// ─── SPECIAL FX ───────────────────────────────────────────────────────────────
async function applyRobotFx(inputPath, outPath) {
  await run(
    `ffmpeg -y -i "${inputPath}" ` +
    `-filter_complex "acrusher=level_in=4:level_out=4:bits=8:mode=log:aa=1,aecho=0.8:0.7:20|40:0.5|0.3" ` +
    `-b:a 128k "${outPath}"`
  );
}

// Radio FX — adds warmth, presence and gentle reverb like Easy Rock 96.9
async function applyRadioFx(inputPath, outPath) {
  await run(
    `ffmpeg -y -i "${inputPath}" ` +
    `-filter_complex "equalizer=f=200:width_type=o:width=2:g=3,equalizer=f=3000:width_type=o:width=2:g=2,equalizer=f=8000:width_type=o:width=2:g=-2,aecho=0.6:0.5:40|80:0.20|0.10,volume=1.15" ` +
    `-b:a 128k "${outPath}"`
  );
}

// ─── BEAUTIFUL RADIO JINGLE BACKGROUND MUSIC ─────────────────────────────────
// Structure: Radio sting (Cmaj→Am→Fmaj→Gsus4) + sustained chord + echo + reverb
// Sounds like a real Easy Rock / smooth radio station background
async function generateJingleBg(padDuration, outPath) {
  const cmd = [
    'ffmpeg -y',
    // Cmaj note: C5 (523 Hz) — crisp opening
    '-f lavfi -i "aevalsrc=0.55*sin(2*PI*523*t)*exp(-t*6):s=44100:d=0.22"',
    // E5 (659 Hz)
    '-f lavfi -i "aevalsrc=0.55*sin(2*PI*659*t)*exp(-t*6):s=44100:d=0.22"',
    // G5 (784 Hz)
    '-f lavfi -i "aevalsrc=0.50*sin(2*PI*784*t)*exp(-t*6):s=44100:d=0.22"',
    // C6 (1047 Hz)
    '-f lavfi -i "aevalsrc=0.45*sin(2*PI*1047*t)*exp(-t*6):s=44100:d=0.18"',
    // Am chord: A3+C4+E4 (220+261+329 Hz)
    '-f lavfi -i "aevalsrc=(0.28*sin(2*PI*220*t)+0.24*sin(2*PI*261.6*t)+0.22*sin(2*PI*329.6*t))*exp(-t*0.8):s=44100:d=0.70"',
    // Fmaj chord: F3+A3+C4+E4 (175+220+262+330 Hz)
    '-f lavfi -i "aevalsrc=(0.26*sin(2*PI*174.6*t)+0.24*sin(2*PI*220*t)+0.22*sin(2*PI*261.6*t)+0.18*sin(2*PI*329.6*t))*exp(-t*0.6):s=44100:d=0.80"',
    // Gsus4 resolve: G3+C4+D4+G4 (196+261+293+392 Hz)
    '-f lavfi -i "aevalsrc=(0.28*sin(2*PI*196*t)+0.22*sin(2*PI*261.6*t)+0.20*sin(2*PI*293.7*t)+0.18*sin(2*PI*392*t))*exp(-t*0.5):s=44100:d=0.90"',
    // Full Cmaj7 sustained chord: C4+E4+G4+B4 — warm, full, radio sound
    '-f lavfi -i "aevalsrc=(0.28*sin(2*PI*261.6*t)+0.26*sin(2*PI*329.6*t)+0.22*sin(2*PI*392*t)+0.18*sin(2*PI*493.9*t)+0.12*sin(2*PI*523*t))*exp(-t*0.30):s=44100:d=5.0"',
    // Silence pad
    `-f lavfi -i "aevalsrc=0:s=44100:d=${padDuration}"`,
    '-filter_complex ' +
      '"[0][1][2][3]concat=n=4:v=0:a=1[sting1];' +
      '[4][5][6]concat=n=3:v=0:a=1[chords];' +
      '[sting1][chords]concat=n=2:v=0:a=1[melody];' +
      '[melody][7]concat=n=2:v=0:a=1[withchord];' +
      '[withchord]aecho=0.88:0.72:80|160|240:0.45|0.28|0.14[echoed];' +
      '[echoed]equalizer=f=200:width_type=o:width=2:g=4[warm];' +
      '[warm]equalizer=f=3000:width_type=o:width=2:g=2[bright];' +
      '[bright][8:a]concat=n=2:v=0:a=1[padded];' +
      '[padded]volume=0.88,afade=t=out:st=' + (padDuration + 6) + ':d=2[out]"',
    '-map "[out]"',
    '-ar 44100 -ac 2 -b:a 128k',
    `"${outPath}"`,
  ].join(' ');
  await run(cmd);
}

// ─── MIX VOICE + BACKGROUND ───────────────────────────────────────────────────
async function mixAudio(voicePath, bgPath, outPath) {
  await run([
    'ffmpeg -y',
    `-i "${voicePath}"`,
    `-i "${bgPath}"`,
    '-filter_complex "[0:a]volume=2.1,afade=t=in:st=0:d=0.1[v];[1:a]volume=0.34[b];[v][b]amix=inputs=2:duration=first[out]"',
    '-map "[out]"',
    '-ar 44100 -ac 2 -b:a 128k',
    `"${outPath}"`,
  ].join(' '));
}

// ─── HELP TEXT ────────────────────────────────────────────────────────────────
function buildHelp(prefix) {
  const col1 = VOICE_KEYS.slice(0, 11).map(k => `  ${bold(k.padEnd(8))} ${VOICES[k].label}`).join('\n');
  const col2 = VOICE_KEYS.slice(11).map(k  => `  ${bold(k.padEnd(8))} ${VOICES[k].label}`).join('\n');
  return (
    `╔════════════════════════════════════╗\n` +
    `║  📻 ${bold('RADIO JINGLE v' + VERSION)}            ║\n` +
    `║  🎙️  ${bold('DJ JASMINE · EASY ROCK 96.9')}  ║\n` +
    `║  🏷️  ${bold(TEAM)}        ║\n` +
    `╚════════════════════════════════════╝\n\n` +
    `🎙️ ${bold('Microsoft Neural TTS — FREE!')}\n` +
    `🎵 ${bold('BAGONG! Richer radio jingle music!')}\n` +
    `📻 ${bold('NEW: jasmine voice = DJ Jasmine style!')}\n\n` +
    `📋 ${bold('PAANO GAMITIN:')}\n${'─'.repeat(36)}\n` +
    `${prefix}jingle [text]\n` +
    `${prefix}jingle [voice] [text]\n\n` +
    `🎤 ${bold('LAHAT NG VOICE CHARACTERS:')}\n${'─'.repeat(36)}\n` +
    col1 + '\n' + col2 + '\n\n' +
    `${'─'.repeat(36)}\n` +
    `📌 ${bold('HALIMBAWA:')}\n` +
    `• ${prefix}jingle jasmine 96.9 Easy Rock Manila your number one station!\n` +
    `• ${prefix}jingle smooth Good morning beautiful listeners!\n` +
    `• ${prefix}jingle grandpa Welcome to 96.9 Easy Rock!\n` +
    `• ${prefix}jingle robot Initializing broadcast sequence!\n` +
    `• ${prefix}jingle fil Magandang umaga sa lahat!\n` +
    `• ${prefix}jingle kid This is my favorite radio station!\n` +
    `• ${prefix}jingle uk This is 96.9 Easy Rock Manila!\n\n` +
    `✅ ${bold('YOU write the script — real human prompt!')}\n` +
    `📥 ${bold('Pwedeng i-download ang audio!')}`
  );
}

// ─── COMMAND ──────────────────────────────────────────────────────────────────
module.exports.config = {
  name: 'jingle',
  version: VERSION,
  hasPermssion: 0,
  credits: TEAM,
  description: 'Generate a real radio jingle — 21 character voices + beautiful Easy Rock musical background (FREE)',
  commandCategory: 'Entertainment',
  usages: '[voice?] [your jingle text]',
  cooldowns: 15
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P = global.config?.PREFIX || '!';

  if (!args.length) return api.sendMessage(buildHelp(P), threadID, messageID);

  let voiceKey = 'jasmine';
  let scriptArgs = args;
  if (VOICE_KEYS.includes(args[0]?.toLowerCase())) {
    voiceKey   = args[0].toLowerCase();
    scriptArgs = args.slice(1);
  }

  if (!scriptArgs.length) {
    return api.sendMessage(
      `❌ Lagyan ng jingle text!\n` +
      `💡 Halimbawa: ${P}jingle ${voiceKey} 96.9 Easy Rock Manila your number one station!`,
      threadID, messageID
    );
  }

  const jingleText = scriptArgs.join(' ').trim();
  const vcfg = VOICES[voiceKey];

  api.setMessageReaction('📻', messageID, () => {}, true);
  api.sendMessage(
    `⏳ ${bold('Ginagawa ang iyong radio jingle...')}\n` +
    `🎤 ${bold('Voice:')} ${vcfg.label}\n` +
    `📝 ${bold('Script:')} "${jingleText.slice(0, 80)}${jingleText.length > 80 ? '...' : ''}"\n` +
    `🎵 ${bold('Generating voice + Easy Rock radio music...')}\n` +
    `⚡ ${bold('Please wait (~15-25 seconds)...')}`,
    threadID
  );

  const ts         = Date.now();
  const voiceRaw   = path.join(TEMP_DIR, `vr_${ts}.mp3`);
  const voiceFx    = path.join(TEMP_DIR, `vf_${ts}.mp3`);
  const bgPath     = path.join(TEMP_DIR, `bg_${ts}.mp3`);
  const outputPath = path.join(TEMP_DIR, `out_${ts}.mp3`);

  try {
    await generateVoice(jingleText, voiceKey, voiceRaw);

    let finalVoicePath = voiceRaw;
    if (vcfg.fx === 'robot') {
      await applyRobotFx(voiceRaw, voiceFx);
      finalVoicePath = voiceFx;
    } else if (vcfg.fx === 'radio') {
      await applyRadioFx(voiceRaw, voiceFx);
      finalVoicePath = voiceFx;
    }

    await generateJingleBg(18, bgPath);
    await mixAudio(finalVoicePath, bgPath, outputPath);

    cleanup(voiceRaw, voiceFx, bgPath);

    api.setMessageReaction('✅', messageID, () => {}, true);

    await api.sendMessage(
      `📻 ${bold('RADIO JINGLE — Ready!')}\n` +
      `🏷️ ${bold(TEAM)}\n` +
      `${'─'.repeat(34)}\n` +
      `🎤 ${bold('Voice:')} ${vcfg.label}\n` +
      `🎵 ${bold('Music:')} Easy Rock Radio Bed (Cmaj7→Am→Fmaj→Gsus4)\n` +
      `📝 ${bold('Script:')}\n"${jingleText}"\n` +
      `${'─'.repeat(34)}\n` +
      `🔊 ${bold('Sending audio...')} 👇\n` +
      `📥 ${bold('Pwedeng i-download!')}`,
      threadID
    );

    return api.sendMessage({
      body: `🎙️ ${bold('RADIO JINGLE')} 📻\n🎤 ${vcfg.label}\n🏷️ ${bold(TEAM)}\n📥 Hold & save to download!`,
      attachment: fs.createReadStream(outputPath)
    }, threadID, () => cleanup(outputPath));

  } catch (e) {
    cleanup(voiceRaw, voiceFx, bgPath, outputPath);
    api.setMessageReaction('❌', messageID, () => {}, true);
    console.error('[Jingle Error]', e.message);
    return api.sendMessage(
      `❌ ${bold('May error sa Jingle Generator.')}\n` +
      `🔧 ${e.message?.slice(0, 200)}\n` +
      `💡 Subukan ulit mamaya.`,
      threadID, messageID
    );
  }
};
