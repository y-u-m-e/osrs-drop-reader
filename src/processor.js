import Tesseract from 'tesseract.js';
import { cropChatbox, prepareForOCR } from './preprocessor.js';
import { parseAllLines } from './parser.js';

// Tesseract config tuned for OSRS pixel font
const TESSERACT_CONFIG = '--psm 6 --oem 1 -c tessedit_char_whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 :.,\'()[]!-x@"';

async function runOCR(imageBuffer) {
  const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
    tessedit_pageseg_mode: '6',
    tessedit_ocr_engine_mode: '1',
    logger: () => {}, // silence progress logs
  });
  return text;
}

/**
 * Full pipeline: raw image buffer → structured drop events.
 */
export async function processImage(imageBuffer) {
  // Step 1: Crop chatbox
  const chatbox = await cropChatbox(imageBuffer);

  // Step 2: Prepare color-isolated versions
  const { red, white, cyan } = await prepareForOCR(chatbox);

  // Step 3: OCR all three color channels in parallel
  const [redText, whiteText, cyanText] = await Promise.all([
    runOCR(red),
    runOCR(white),
    runOCR(cyan),
  ]);

  // Step 4: Parse each channel
  const redEvents = parseAllLines(redText);
  const whiteEvents = parseAllLines(whiteText);
  const cyanEvents = parseAllLines(cyanText);

  // Step 5: Merge and deduplicate by item+type
  const allEvents = [...redEvents, ...whiteEvents, ...cyanEvents];
  const seen = new Set();
  const deduped = allEvents.filter(e => {
    const key = `${e.type}:${e.item ?? e.slot ?? ''}:${e.value ?? 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    events: deduped,
    debug: {
      red_ocr: redText,
      white_ocr: whiteText,
      cyan_ocr: cyanText,
    },
  };
}
