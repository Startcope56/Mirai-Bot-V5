/**
 * !vdai [prompt] — AI Image-to-Video Animator
 * Reply to an image + type !vdai [prompt describing motion]
 * Creates a 50-second animated MP4 using ffmpeg motion effects
 * FREE — no API key needed · TEAM STARTCOPE BETA · MIRAI BOT V6
 *
 * Examples:
 *   !vdai lumalakad sa daan
 *   !vdai sumayaw ng maayos
 *   !vdai lumipad sa langit
 *   !vdai tumatalon ng mataas
 *   !vdai shake at lindol
 *   !vdai zoom in slowly
 *   !vdai floating sa hangin
 */

'use strict';
const fs          = require('fs-extra');
const path        = require('path');
const axios       = require('axios');
const { exec }    = require('child_process');
const bold        = require('../../utils/bold');

const VERSION  = '1.0.0';
const TEAM     = 'TEAM STARTCOPE BETA';
const TEMP_DIR = path.join(process.cwd(), 'utils/data/vdai_temp');
const DURATION = 50; // seconds
const FPS      = 25;
const FRAMES   = DURATION * FPS; // 1250
const OUT_W    = 1280;
const OUT_H    = 720;
const UA       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

fs.ensureDirSync(TEMP_DIR);

// ── Cleanup helper ────────────────────────────────────────────────────────────
const cleanup = (...files) =>
  setTimeout(() => files.forEach(f => { try { fs.removeSync(f); } catch {} }), 5 * 60 * 1000);

// ── Download image attachment to temp file ────────────────────────────────────
async function downloadImage(url) {
  const fp = path.join(TEMP_DIR, `img_${Date.now()}.jpg`);
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': UA },
  });
  fs.writeFileSync(fp, Buffer.from(data));
  return fp;
}

// ── Detect motion type from prompt ───────────────────────────────────────────
function detectMotion(prompt) {
  const p = prompt.toLowerCase();
  if (p.match(/run|tumakbo|takbo|sprint|dash/))          return 'run';
  if (p.match(/walk|lakad|lumalakad|naglalakad/))        return 'walk';
  if (p.match(/dance|sayaw|sumasayaw|sumayaw/))           return 'dance';
  if (p.match(/fly|lipad|lumipad|lilipad|lumulipad/))    return 'fly';
  if (p.match(/shake|lindol|quake|ulog|linog|vibrate/))  return 'shake';
  if (p.match(/spin|paikot|ikot|rotate|whirl/))          return 'spin';
  if (p.match(/float|lutang|swing|ugoy|hover|wave/))     return 'float';
  if (p.match(/jump|talon|tumatalon|leap|bounce/))       return 'jump';
  if (p.match(/zoom|malapit|close.?up|closeup|lupit/))   return 'zoom';
  if (p.match(/explode|putok|sumabog|boom/))              return 'explode';
  if (p.match(/fall|bumagsak|bagsak|tumba/))             return 'fall';
  if (p.match(/slow|mabagal|dahan/))                     return 'slow';
  return 'kenburns';
}

// ── Build ffmpeg vf filter string ────────────────────────────────────────────
// Rules for filter expressions passed via exec inside single-quoted -vf string:
//   • NO bare commas inside function calls (use \, which ffmpeg interprets correctly)
//   • NO inner single quotes (we're already inside outer single quotes)
//   • ffmpeg auto-clamps out-of-bounds crop x/y — no need for explicit min/max on bounds
//
// Strategy:
//   1. Normalize: scale to fit 1280x720, pad black to exact size
//   2. Scale UP to 2048x1152 (1.6x) — gives 768px horiz + 432px vert pan room
//   3. Crop 1280x720 with animated x/y based on motion type
//   4. Zoom effects use zoompan filter
function buildFilter(motion, info) {
  const label = info.label; // e.g. "LUMALAKAD" — safe ASCII, no special chars

  // Text overlay at bottom — motion label (simple ASCII, no quoting issues)
  const txt = `drawtext=text=${label}:fontsize=36:fontcolor=white:` +
              `box=1:boxcolor=black@0.65:boxborderw=10:` +
              `x=(w-text_w)/2:y=h-th-25`;

  // Watermark top-right
  const wm  = `drawtext=text=VDAI AI:fontsize=22:fontcolor=white@0.75:` +
              `x=w-text_w-15:y=15`;

  const overlay = `${txt},${wm}`;

  // scale+pad+upscale base for crop-based motions
  // After this: 2048×1152 image — center crop anchor = x:384  y:216
  const base = `scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=decrease,` +
               `pad=${OUT_W}:${OUT_H}:(ow-iw)/2:(oh-ih)/2,` +
               `scale=2048:1152`;

  // zoompan base for zoom-based motions
  const zpBase = `scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=decrease,` +
                 `pad=${OUT_W}:${OUT_H}:(ow-iw)/2:(oh-ih)/2`;

  let vf;

  switch (motion) {
    case 'walk':
      // Pans right + gentle vertical bounce (ffmpeg auto-clamps at boundary)
      vf = `${base},crop=${OUT_W}:${OUT_H}:384+t*8:216+sin(t*4)*14,${overlay}`;
      break;

    case 'run':
      // Faster pan + bigger bounce
      vf = `${base},crop=${OUT_W}:${OUT_H}:384+t*20:216+sin(t*8)*20,${overlay}`;
      break;

    case 'dance':
      // Smooth left-right + up-down oscillation
      vf = `${base},crop=${OUT_W}:${OUT_H}:384+sin(t*1.5)*190:216+cos(t*1.8)*90,${overlay}`;
      break;

    case 'fly':
      // Moves upward + gentle horizontal wave (max() needed — use \, escape)
      vf = `${base},crop=${OUT_W}:${OUT_H}:384+sin(t*0.9)*100:max(0\\,216-t*4.2),${overlay}`;
      break;

    case 'shake':
      // Fast violent oscillation
      vf = `${base},crop=${OUT_W}:${OUT_H}:384+sin(t*22)*38:216+cos(t*24)*28,${overlay}`;
      break;

    case 'spin':
      // Circular motion (oscillates in both axes, same frequency)
      vf = `${base},crop=${OUT_W}:${OUT_H}:384+sin(t*1.3)*210:216+cos(t*1.3)*130,${overlay}`;
      break;

    case 'float':
      // Slow gentle float
      vf = `${base},crop=${OUT_W}:${OUT_H}:384+sin(t*0.5)*80:216+sin(t*0.7)*80,${overlay}`;
      break;

    case 'jump':
      // Periodic vertical jumps — abs() has no commas, safe
      vf = `${base},crop=${OUT_W}:${OUT_H}:384+sin(t*0.25)*20:max(0\\,216-abs(sin(t*2.5))*130),${overlay}`;
      break;

    case 'explode':
      // Zoom out rapidly + shake — zoompan with \, escaped commas
      vf = `${zpBase},zoompan=z=max(1\\,1.8-on*0.0008):` +
           `x=iw/2-(iw/zoom/2)+sin(on*0.8)*12:` +
           `y=ih/2-(ih/zoom/2)+cos(on*0.9)*10:` +
           `d=${FRAMES}:fps=${FPS}:s=${OUT_W}x${OUT_H},${overlay}`;
      break;

    case 'fall':
      // Pans down (y increases)
      vf = `${base},crop=${OUT_W}:${OUT_H}:384+sin(t*0.6)*30:216+t*8+sin(t*3)*15,${overlay}`;
      break;

    case 'slow':
      // Ultra-slow Ken Burns
      vf = `${zpBase},zoompan=z=min(1+on*0.0003\\,1.3):` +
           `x=iw/2-(iw/zoom/2)+(on*0.15):` +
           `y=ih/2-(ih/zoom/2)+(on*0.08):` +
           `d=${FRAMES}:fps=${FPS}:s=${OUT_W}x${OUT_H},${overlay}`;
      break;

    case 'zoom':
      // Dramatic zoom in
      vf = `${zpBase},zoompan=z=min(1+on*0.0008\\,2.0):` +
           `x=iw/2-(iw/zoom/2):` +
           `y=ih/2-(ih/zoom/2):` +
           `d=${FRAMES}:fps=${FPS}:s=${OUT_W}x${OUT_H},${overlay}`;
      break;

    case 'kenburns':
    default:
      // Slow zoom + gentle diagonal pan
      vf = `${zpBase},zoompan=z=min(1+on*0.0004\\,1.45):` +
           `x=(iw*(1-1/zoom)/2)+(on*0.25):` +
           `y=(ih*(1-1/zoom)/2)+(on*0.12):` +
           `d=${FRAMES}:fps=${FPS}:s=${OUT_W}x${OUT_H},${overlay}`;
      break;
  }

  return vf;
}

// ── Run ffmpeg to create animated video (using exec for reliable filter passing) ─
function createVideo(inputImg, outputMp4, motion, info) {
  return new Promise((resolve, reject) => {
    const vf  = buildFilter(motion, info);
    // Use single-quoted vf string — shell exec preserves it correctly
    const cmd = [
      'ffmpeg -y',
      `-loop 1 -framerate 1 -i "${inputImg}"`,
      `-vf '${vf}'`,
      `-t ${DURATION}`,
      '-c:v libx264',
      '-pix_fmt yuv420p',
      `-r ${FPS}`,
      '-crf 23',
      '-preset fast',
      '-movflags +faststart',
      `"${outputMp4}"`,
    ].join(' ');

    console.log(`[VDAI] Starting ffmpeg — motion: ${motion}`);

    exec(cmd, { maxBuffer: 1024 * 1024 * 50, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('[VDAI] ffmpeg error:', err.message?.slice(0, 200));
        console.error('[VDAI] stderr:', stderr?.slice(0, 400));
        return reject(new Error(err.message || 'ffmpeg failed'));
      }
      console.log(`[VDAI] ✅ Video created: ${path.basename(outputMp4)}`);
      resolve();
    });
  });
}

// ── Motion emoji & label map ─────────────────────────────────────────────────
const MOTION_INFO = {
  walk:     { emoji: '🚶', label: 'LUMALAKAD' },
  run:      { emoji: '🏃', label: 'TUMATAKBO' },
  dance:    { emoji: '💃', label: 'SUMASAYAW' },
  fly:      { emoji: '🦋', label: 'LUMIPAD' },
  shake:    { emoji: '💥', label: 'KUMAKABOG' },
  spin:     { emoji: '🌀', label: 'UMIIKOT' },
  float:    { emoji: '🌊', label: 'LUMULUTANG' },
  jump:     { emoji: '🦘', label: 'TUMATALON' },
  zoom:     { emoji: '🔍', label: 'ZOOM IN' },
  explode:  { emoji: '💣', label: 'SUMABOG' },
  fall:     { emoji: '⬇️', label: 'BUMABAGSAK' },
  slow:     { emoji: '🎞️', label: 'SLOW MOTION' },
  kenburns: { emoji: '🎬', label: 'CINEMATIC' },
};

// ── Command config ────────────────────────────────────────────────────────────
module.exports.config = {
  name:            'vdai',
  version:         VERSION,
  hasPermssion:    0,
  credits:         TEAM,
  description:     'AI Image → 50-sec Animated Video! Reply to image + !vdai [prompt]',
  commandCategory: 'AI',
  usages:          '[prompt] — reply to a photo',
  cooldowns:       30,
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P      = global.config?.PREFIX || '!';
  const prompt = args.join(' ').trim();

  // ── Collect image attachment ────────────────────────────────────────────────
  const attachments =
    event.messageReply?.attachments?.filter(a => ['photo', 'sticker', 'animated_image'].includes(a.type)) ||
    event.attachments?.filter(a => ['photo', 'sticker', 'animated_image'].includes(a.type)) ||
    [];

  if (!attachments.length) {
    return api.sendMessage(
      `╔══════════════════════════════════╗\n` +
      `║  🎬 ${bold('VDAI — AI IMAGE TO VIDEO')}   ║\n` +
      `║  🏷️  ${bold(TEAM)}   ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `🤖 ${bold('I-animate ang kahit anong larawan!')}\n` +
      `🎥 ${bold('50 segundo · MP4 · AI Motion Effects')}\n\n` +
      `📋 ${bold('PAANO GAMITIN:')}\n${'─'.repeat(34)}\n` +
      `1️⃣ Mag-upload ng larawan\n` +
      `2️⃣ I-reply doon at i-type:\n` +
      `   ${bold(P + 'vdai [galaw na gusto mo')}\n\n` +
      `✨ ${bold('MGA HALIMBAWA:')}\n` +
      `  ${P}vdai lumalakad sa daan\n` +
      `  ${P}vdai sumayaw ng maayos\n` +
      `  ${P}vdai lumipad sa langit\n` +
      `  ${P}vdai tumatalon ng mataas\n` +
      `  ${P}vdai shake at kumakabog\n` +
      `  ${P}vdai zoom in dahan-dahan\n` +
      `  ${P}vdai floating sa hangin\n` +
      `  ${P}vdai tumatakbo nang mabilis\n` +
      `  ${P}vdai sumabog at explode\n\n` +
      `🎬 ${bold('LAHAT NG MOTION EFFECTS:')}\n` +
      `  🚶 walk/lakad   🏃 run/takbo\n` +
      `  💃 dance/sayaw  🦋 fly/lipad\n` +
      `  💥 shake/lindol 🌀 spin/ikot\n` +
      `  🌊 float/lutang 🦘 jump/talon\n` +
      `  🔍 zoom         💣 explode\n` +
      `  ⬇️ fall/bagsak  🎞️ slow\n` +
      `  🎬 (walang prompt = cinematic)\n\n` +
      `⏱️ ${bold('Processing time: ~30-60 segundo')}\n` +
      `🏷️ ${bold(TEAM)} · v${VERSION}`,
      threadID, messageID
    );
  }

  // ── If no prompt, use cinematic Ken Burns ──────────────────────────────────
  const finalPrompt = prompt || 'cinematic motion';
  const motion      = detectMotion(finalPrompt);
  const info        = MOTION_INFO[motion] || MOTION_INFO.kenburns;

  // Send loading message
  api.sendMessage(
    `🎬 ${bold('VDAI — PROCESSING...')}\n\n` +
    `${info.emoji} ${bold('Motion:')} ${info.label}\n` +
    `📝 ${bold('Prompt:')} ${finalPrompt.slice(0, 80)}\n` +
    `⏱️ ${bold('Duration:')} ${DURATION} segundo\n` +
    `📐 ${bold('Resolution:')} ${OUT_W}×${OUT_H}\n\n` +
    `⏳ ${bold('Sandali lang... ~30-60 segundo...')}\n` +
    `🔄 Sine-set up ang AI animation...`,
    threadID, messageID
  );

  const imgUrl = attachments[0]?.url || attachments[0]?.playable_url;
  if (!imgUrl) {
    return api.sendMessage(
      `❌ ${bold('Hindi ma-download ang larawan.')}\n` +
      `Subukan muli — i-upload ulit ang photo.`,
      threadID, messageID
    );
  }

  const ts      = Date.now();
  const imgPath = path.join(TEMP_DIR, `input_${ts}.jpg`);
  const vidPath = path.join(TEMP_DIR, `output_${ts}.mp4`);

  try {
    // Download image
    console.log(`[VDAI] Downloading image from: ${imgUrl.slice(0, 60)}...`);
    await downloadImage(imgUrl).then(fp => fs.copySync(fp, imgPath));

    // Verify image was downloaded
    if (!fs.existsSync(imgPath) || fs.statSync(imgPath).size < 500) {
      throw new Error('Image download failed or file too small');
    }
    console.log(`[VDAI] Image downloaded: ${fs.statSync(imgPath).size} bytes`);

    // Create video
    await createVideo(imgPath, vidPath, motion, info);

    // Verify output
    if (!fs.existsSync(vidPath) || fs.statSync(vidPath).size < 10000) {
      throw new Error('Video generation failed — output file too small or missing');
    }

    const sizeMB = (fs.statSync(vidPath).size / 1048576).toFixed(1);
    console.log(`[VDAI] Video ready: ${sizeMB}MB — sending...`);

    // Send the video
    await api.sendMessage(
      {
        body:
          `✅ ${bold('VDAI — TAPOS NA!')} 🎬\n\n` +
          `${info.emoji} ${bold('Motion:')} ${info.label}\n` +
          `📝 ${bold('Prompt:')} ${finalPrompt.slice(0, 80)}\n` +
          `⏱️ ${bold('Duration:')} ${DURATION} segundo\n` +
          `📁 ${bold('Size:')} ${sizeMB}MB\n` +
          `📐 ${bold('Resolution:')} ${OUT_W}×${OUT_H} HD\n\n` +
          `🏷️ ${bold(TEAM)} · MIRAI BOT V6`,
        attachment: fs.createReadStream(vidPath),
      },
      threadID, messageID
    );

    cleanup(imgPath, vidPath);
    console.log(`[VDAI] ✅ Done — sent ${sizeMB}MB video`);

  } catch (e) {
    console.error('[VDAI] ❌ Error:', e.message);
    try { fs.removeSync(imgPath); } catch {}
    try { fs.removeSync(vidPath); } catch {}

    return api.sendMessage(
      `❌ ${bold('VDAI Error:')}\n${e.message?.slice(0, 200)}\n\n` +
      `💡 ${bold('Tips:')}\n` +
      `• Tiyaking may nakalakip na larawan\n` +
      `• I-reply sa photo tapos type: ${P}vdai [prompt]\n` +
      `• Subukan muli — minsan busy ang server`,
      threadID, messageID
    );
  }
};
