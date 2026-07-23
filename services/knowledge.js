const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

const FALLBACK_KNOWLEDGE = {
  programs: [],
  contact: {
    phone: "+976 75051055",
  },
};

// The knowledge document changes rarely, so we cache it in memory and only
// re-query Postgres after the TTL expires. This keeps per-message latency low.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { data: null, expiresAt: 0 };

function readFromFile() {
  try {
    const filePath = path.join(__dirname, "..", "knowledge", "academy.json");
    const file = fs.readFileSync(filePath, "utf8");
    return JSON.parse(file);
  } catch (error) {
    console.log("❌ Knowledge file fallback error:", error.message);
    return FALLBACK_KNOWLEDGE;
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

    if (rows.length && rows[0].data) {
      cache = { data: rows[0].data, expiresAt: now + CACHE_TTL_MS };
      return cache.data;
    }

    console.log("⚠️ Knowledge row not found in DB, falling back to file.");
  } catch (error) {
    console.log("❌ Knowledge DB load error:", error.message);
  }

  // DB unavailable or empty — fall back to the bundled JSON file. Cache it
  // briefly too so we don't hammer a failing DB on every message.
  const fileData = readFromFile();
  cache = { data: fileData, expiresAt: now + CACHE_TTL_MS };
  return fileData;
}

module.exports = { getKnowledge };
