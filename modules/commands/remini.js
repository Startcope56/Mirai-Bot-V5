// Remini AI — Photo Enhancer — Power Inc
// Uses jimp v1 for local enhancement (sharpening convolution + contrast + brightness via scan)
const axios = require("axios");
const { Jimp, intToRGBA, rgbaToInt } = require("jimp");
const fs = require("fs");
const path = require("path");
const os = require("os");

async function downloadBuffer(url) {
  const r = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
  return Buffer.from(r.data);
}

// Unsharp mask 3×3 sharpening kernel
function applySharpen(img) {
  const kernel = [[-1,-1,-1],[-1,9,-1],[-1,-1,-1]];
  const w = img.bitmap.width, h = img.bitmap.height;
  const src = img.clone();
  img.scan(1, 1, w - 2, h - 2, (x, y) => {
    let r = 0, g = 0, b = 0;
    for (let ky = -1; ky <= 1; ky++) {
      for (let kx = -1; kx <= 1; kx++) {
        const px = intToRGBA(src.getPixelColor(x + kx, y + ky));
        const k = kernel[ky + 1][kx + 1];
        r += px.r * k; g += px.g * k; b += px.b * k;
      }
    }
    r = Math.min(255, Math.max(0, Math.round(r)));
    g = Math.min(255, Math.max(0, Math.round(g)));
    b = Math.min(255, Math.max(0, Math.round(b)));
    const a = intToRGBA(img.getPixelColor(x, y)).a;
    img.setPixelColor(rgbaToInt(r, g, b, a), x, y);
  });
}

// Contrast boost (amount 0–1)
function applyContrast(img, amount) {
  const factor = (259 * (255 * amount + 255)) / (255 * (259 - 255 * amount));
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y) => {
    const p = intToRGBA(img.getPixelColor(x, y));
    const r = Math.min(255, Math.max(0, Math.round(factor * (p.r - 128) + 128)));
    const g = Math.min(255, Math.max(0, Math.round(factor * (p.g - 128) + 128)));
    const b = Math.min(255, Math.max(0, Math.round(factor * (p.b - 128) + 128)));
    img.setPixelColor(rgbaToInt(r, g, b, p.a), x, y);
  });
}

// Brightness boost (amount -1 to 1)
function applyBrightness(img, amount) {
  const add = Math.round(255 * amount);
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y) => {
    const p = intToRGBA(img.getPixelColor(x, y));
    img.setPixelColor(
      rgbaToInt(
        Math.min(255, Math.max(0, p.r + add)),
        Math.min(255, Math.max(0, p.g + add)),
        Math.min(255, Math.max(0, p.b + add)),
        p.a
      ), x, y
    );
  });
}

// Saturation boost (amount 0–2, 1 = no change)
function applySaturation(img, amount) {
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y) => {
    const p = intToRGBA(img.getPixelColor(x, y));
    const avg = (p.r + p.g + p.b) / 3;
    img.setPixelColor(
      rgbaToInt(
        Math.min(255, Math.max(0, Math.round(avg + (p.r - avg) * amount))),
        Math.min(255, Math.max(0, Math.round(avg + (p.g - avg) * amount))),
        Math.min(255, Math.max(0, Math.round(avg + (p.b - avg) * amount))),
        p.a
      ), x, y
    );
  });
}

module.exports = {
  config: {
    name: "remini",
    aliases: ["enhance", "hd", "upscale"],
    version: "2.0.0",
    author: "Power Inc",
    cooldowns: 20,
    hasPermssion: 0,
    description: "Enhance and sharpen a photo — reply to an image",
    commandCategory: "ai",
    usages: "[reply to image] or attach image"
  },
  run: async ({ api, event }) => {
    const { senderID, threadID, messageID } = event;

    const getImgUrl = (ev) => {
      if (!ev?.attachments) return null;
      for (const att of ev.attachments) {
        if (att.type === "photo" || att.type === "image")
          return att.largePreviewUrl || att.previewUrl || att.url || att.playbackUrl;
      }
      return null;
    };

    const imgUrl = getImgUrl(event) || (event.messageReply ? getImgUrl(event.messageReply) : null);
    if (!imgUrl)
      return api.sendMessage(
        `📸 REMINI PHOTO ENHANCER\n───────────────────────\n` +
        `Reply to a photo or attach one, then type:\n!remini\n\n` +
        `✨ Applies: Sharpen · Contrast · Brightness · Saturation`,
        threadID, messageID
      );

    api.setMessageReaction("⏳", messageID, () => {}, true);

    try {
      const buf = await downloadBuffer(imgUrl);
      const tmpOut = path.join(os.tmpdir(), `remini_${Date.now()}.jpg`);

      const img = await Jimp.fromBuffer(buf);
      const w = img.bitmap.width, h = img.bitmap.height;

      // Apply enhancement pipeline
      applySharpen(img);
      applyContrast(img, 0.20);
      applyBrightness(img, 0.04);
      applySaturation(img, 1.25);

      // Save with high quality
      const outBuf = await img.getBuffer("image/jpeg");
      fs.writeFileSync(tmpOut, outBuf);

      api.sendMessage({
        body: `✨ REMINI PHOTO ENHANCER\n━━━━━━━━━━━━━━━━━━━━\n` +
              `📸 Enhanced photo ready!\n` +
              `🔍 Sharpened · Contrast · HD\n` +
              `📐 ${w}×${h}px\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `👑 Power Inc`,
        attachment: fs.createReadStream(tmpOut)
      }, threadID, () => {
        try { fs.unlinkSync(tmpOut); } catch {}
      }, messageID);
      api.setMessageReaction("✨", messageID, () => {}, true);
    } catch (e) {
      console.error("[Remini]", e.message);
      api.setMessageReaction("❌", messageID, () => {}, true);
      api.sendMessage(`❌ Enhancement failed: ${e.message}`, threadID, messageID);
    }
  }
};
