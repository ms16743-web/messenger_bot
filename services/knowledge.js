const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

const FALLBACK_KNOWLEDGE = {
  programs: [],
  contact: {
    phone: "+976 75051055",
  },
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { data: null, expiresAt: 0 };
// Separate from `cache` — this only ever holds the last successfully loaded
// data (DB or file), and is never overwritten with an empty/fallback result.
// Used as a safety net so one bad load doesn't poison responses for the
// full TTL window.
let lastGoodData = null;

function isValidKnowledge(data) {
  return !!data && Array.isArray(data.programs) && data.programs.length > 0;
}

function readFromFile() {
  try {
    const filePath = path.join(__dirname, "..", "knowledge", "academy.json");
    const file = fs.readFileSync(filePath, "utf8");
    return JSON.parse(file);
  } catch (error) {
    console.log("❌ Knowledge file fallback error:", error.message);
    return null;
  }
}

async function getKnowledge() {
  const now = Date.now();

  if (cache.data && now < cache.expiresAt) {
    return cache.data;
  }

  try {
    const { rows } = await pool.query(
      "SELECT data FROM knowledge WHERE id = 1"
    );

    if (rows.length && isValidKnowledge(rows[0].data)) {
      cache = { data: rows[0].data, expiresAt: now + CACHE_TTL_MS };
      lastGoodData = rows[0].data;
      return cache.data;
    }

    console.log("⚠️ Knowledge row not found or empty in DB, trying file fallback.");
  } catch (error) {
    console.log("❌ Knowledge DB load error:", error.message);
  }

  const fileData = readFromFile();
  if (isValidKnowledge(fileData)) {
    cache = { data: fileData, expiresAt: now + CACHE_TTL_MS };
    lastGoodData = fileData;
    return fileData;
  }

  // Both DB and file failed (or returned no programs). If we have any
  // previously-successful data in memory, keep serving that instead of an
  // empty knowledge base — a stale program list is far better than a
  // broken reply to a real customer. Cache it briefly so we retry soon
  // rather than being stuck for the full TTL, but don't stay empty.
  if (lastGoodData) {
    console.log("⚠️ DB and file both failed — serving last known-good knowledge from memory.");
    cache = { data: lastGoodData, expiresAt: now + 30 * 1000 }; // retry in 30s, not 5min
    return lastGoodData;
  }

  console.log("❌ No knowledge available anywhere (DB, file, or memory) — serving empty fallback.");
  cache = { data: FALLBACK_KNOWLEDGE, expiresAt: now + 30 * 1000 }; // short TTL so it retries soon
  return FALLBACK_KNOWLEDGE;
}

module.exports = { getKnowledge };