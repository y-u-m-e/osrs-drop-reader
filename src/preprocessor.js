import sharp from 'sharp';

// OSRS chatbox is always bottom-left of the screen.
// These ratios work across 1920x1080, 1440x900, 2560x1440 etc.
// Vanilla client and RuneLite both keep chatbox in bottom ~28% of screen, left ~55% of width.
const CHATBOX_REGION = {
  leftRatio: 0.0,
  topRatio: 0.70,
  widthRatio: 0.57,
  heightRatio: 0.28,
};

// Color ranges for OSRS chat text (in RGB).
// These are empirically tuned from the sample screenshots.
const COLOR_RANGES = {
  // "Valuable drop:" and "Untradeable drop:" - bright red/orange
  red: {
    r: [170, 255],
    g: [0, 80],
    b: [0, 60],
  },
  // White game messages (pet, collection log)
  white: {
    r: [200, 255],
    g: [200, 255],
    b: [200, 255],
  },
  // Cyan/teal - RuneLite clan broadcast lines
  cyan: {
    r: [0, 100],
    g: [180, 255],
    b: [180, 255],
  },
};

/**
 * Crop the chatbox region from a full screenshot buffer.
 */
export async function cropChatbox(imageBuffer) {
  const meta = await sharp(imageBuffer).metadata();
  const { width, height } = meta;

  const left = Math.floor(width * CHATBOX_REGION.leftRatio);
  const top = Math.floor(height * CHATBOX_REGION.topRatio);
  const cropWidth = Math.floor(width * CHATBOX_REGION.widthRatio);
  const cropHeight = Math.floor(height * CHATBOX_REGION.heightRatio);

  return sharp(imageBuffer)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .toBuffer();
}

/**
 * Isolate pixels matching a color range, turn everything else black,
 * matching pixels become white. Returns a high-contrast buffer for Tesseract.
 */
async function isolateColorRange(imageBuffer, colorRange) {
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const output = Buffer.alloc(width * height * 3);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];

    const match =
      r >= colorRange.r[0] && r <= colorRange.r[1] &&
      g >= colorRange.g[0] && g <= colorRange.g[1] &&
      b >= colorRange.b[0] && b <= colorRange.b[1];

    output[i * 3] = match ? 255 : 0;
    output[i * 3 + 1] = match ? 255 : 0;
    output[i * 3 + 2] = match ? 255 : 0;
  }

  return sharp(output, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

/**
 * Upscale buffer for better Tesseract accuracy on small pixel fonts.
 */
async function upscale(imageBuffer, factor = 3) {
  const meta = await sharp(imageBuffer).metadata();
  return sharp(imageBuffer)
    .resize(meta.width * factor, meta.height * factor, { kernel: 'nearest' })
    .toBuffer();
}

/**
 * Prepare all color-isolated, upscaled variants of the chatbox for OCR.
 * Returns { red, white, cyan } as Buffers.
 */
export async function prepareForOCR(chatboxBuffer) {
  const [redIso, whiteIso, cyanIso] = await Promise.all([
    isolateColorRange(chatboxBuffer, COLOR_RANGES.red),
    isolateColorRange(chatboxBuffer, COLOR_RANGES.white),
    isolateColorRange(chatboxBuffer, COLOR_RANGES.cyan),
  ]);

  const [redUp, whiteUp, cyanUp] = await Promise.all([
    upscale(redIso, 3),
    upscale(whiteIso, 3),
    upscale(cyanIso, 3),
  ]);

  return { red: redUp, white: whiteUp, cyan: cyanUp };
}
