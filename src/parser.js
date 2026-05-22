/**
 * Parses OSRS chat lines into structured drop events.
 *
 * Handles:
 *   - Valuable drop:
 *   - Untradeable drop:
 *   - Pet (follower slot)
 *   - Pet (backpack)
 *   - Collection log
 *   - RuneLite clan broadcast
 */

// [20:47] Valuable drop: Superior dragon bones (21,855 coins)
// [20:47] Valuable drop: 45 x Dragon arrowtips (84,510 coins)
const VALUABLE_DROP = /valuable drop:\s*(?:(\d[\d,]*)\s*x\s*)?(.+?)\s*\(([0-9,]+)\s*coins?\)/i;

// [20:47] Untradeable drop: Vorkath's head
// Untradeable drop: 100 x Sun-kissed bones
const UNTRADEABLE_DROP = /untradeable drop:\s*(?:(\d[\d,]*)\s*x\s*)?(.+)/i;

// You have a funny feeling like you're being followed.
const PET_FOLLOWER = /funny feeling like you.re being followed/i;

// You feel something weird sneaking into your backpack.
const PET_BACKPACK = /sneaking into your backpack/i;

// New item added to your collection log: Hueycoatl hide
const COLLECTION_LOG = /new item added to your collection log:\s*(.+)/i;

// [Iron Forged] 🔱 stworzyciel received a drop: Oathplate helm (100,089,170 coins) from Yama.
// Also handles without clan tag emoji and with [14:31] timestamp prefix
const CLAN_BROADCAST = /received a drop:\s*(?:(\d[\d,]*)\s*x\s*)?(.+?)\s*\(([0-9,]+)\s*coins?\)(?:\s*from\s*(.+?))?\.?$/i;

// Strip leading timestamps like [20:47] or [14:31]
const TIMESTAMP_PREFIX = /^\s*\[?\d{1,2}:\d{2}\]?\s*/;

// Strip RuneLite clan tag prefix like "[Iron Forged] 🔱 PlayerName: " or "[Iron Forged] ◆ PlayerName "
// \p{Emoji} requires unicode flag - use a broad non-word/non-space char class instead
const CLAN_TAG_PREFIX = /^\[.+?\]\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}◆🔱✦★☆♦]?\s*/u;

// [Iron Forged] Nuzlocke received a new collection log item: Dragonbone necklace (990/1892)
const CLAN_COLLECTION_LOG = /received a new collection log item:\s*(.+?)(?:\s*\(\d+\/\d+\))?$/i;

function cleanLine(line) {
  return line.replace(TIMESTAMP_PREFIX, '').trim();
}

function parseCoins(str) {
  return parseInt(str.replace(/,/g, ''), 10);
}

function parseQuantity(str) {
  if (!str) return 1;
  return parseInt(str.replace(/,/g, ''), 10);
}

/**
 * Parse a single cleaned chat line into a structured event, or null if no match.
 */
export function parseLine(rawLine) {
  const line = cleanLine(rawLine);

  // Valuable drop
  const valMatch = line.match(VALUABLE_DROP);
  if (valMatch) {
    return {
      type: 'valuable_drop',
      quantity: parseQuantity(valMatch[1]),
      item: valMatch[2].trim(),
      value: parseCoins(valMatch[3]),
      raw: rawLine.trim(),
    };
  }

  // Untradeable drop
  const untradeMatch = line.match(UNTRADEABLE_DROP);
  if (untradeMatch) {
    return {
      type: 'untradeable_drop',
      quantity: parseQuantity(untradeMatch[1]),
      item: untradeMatch[2].trim(),
      value: 0,
      raw: rawLine.trim(),
    };
  }

  // Pet - follower slot
  if (PET_FOLLOWER.test(line)) {
    return {
      type: 'pet',
      slot: 'follower',
      raw: rawLine.trim(),
    };
  }

  // Pet - backpack
  if (PET_BACKPACK.test(line)) {
    return {
      type: 'pet',
      slot: 'backpack',
      raw: rawLine.trim(),
    };
  }

  // Collection log
  const colMatch = line.match(COLLECTION_LOG);
  if (colMatch) {
    return {
      type: 'collection_log',
      item: colMatch[1].trim(),
      raw: rawLine.trim(),
    };
  }

  // RuneLite clan broadcast - strip clan tag first
  const strippedForClan = line.replace(CLAN_TAG_PREFIX, '');

  // Clan collection log broadcast
  const clanColMatch = strippedForClan.match(CLAN_COLLECTION_LOG);
  if (clanColMatch) {
    const playerMatch = strippedForClan.match(/^(.+?)\s+received a new collection log item:/i);
    return {
      type: 'clan_collection_log',
      player: playerMatch ? playerMatch[1].trim() : null,
      item: clanColMatch[1].trim(),
      raw: rawLine.trim(),
    };
  }

  const clanMatch = strippedForClan.match(CLAN_BROADCAST);
  if (clanMatch) {
    // Extract player name - it's before "received a drop"
    const playerMatch = strippedForClan.match(/^(.+?)\s+received a drop:/i);
    return {
      type: 'clan_broadcast',
      player: playerMatch ? playerMatch[1].trim() : null,
      quantity: parseQuantity(clanMatch[1]),
      item: clanMatch[2].trim(),
      value: parseCoins(clanMatch[3]),
      npc: clanMatch[4] ? clanMatch[4].trim() : null,
      raw: rawLine.trim(),
    };
  }

  return null;
}

/**
 * Parse all lines from OCR output, return only matched events.
 */
export function parseAllLines(ocrText) {
  const lines = ocrText.split('\n').filter(l => l.trim().length > 0);
  const events = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) events.push(parsed);
  }

  return events;
}
