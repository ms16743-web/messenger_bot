const fetchFn = typeof fetch === "function" ? fetch : require("node-fetch");

const API_KEY = process.env.GEMINI_API_KEY;
const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

// Example phrases per intent, validated against real customer messages
// from production logs. Thresholds below were picked from that testing —
// see the margin note next to each.
const INTENT_CONFIG = {
  hours: {
    examples: [
      "ажиллах цагийн хуваарь хэд вэ",
      "tsagiin huviar hed ve",
      "office ajlin tsag hed ve",
    ],
    threshold: 0.75, // margin was tight (~0.07) in testing — revisit if false positives show up
  },
  location: {
    examples: [
      "таны оффис хаана байдаг вэ",
      "office haana bdg ve",
      "bairshil haana",
    ],
    threshold: 0.72, // margin was comfortable (~0.15) in testing
  },
};

let exampleVectorCache = null; // populated once at startup, not per-request

async function embedText(text) {
  const response = await fetchFn(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  const data = await response.json();
  if (!data.embedding) {
    console.error("❌ Embedding failed for:", text, "-", JSON.stringify(data));
    return null;
  }
  return data.embedding.values;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Call this once at server startup — embeds all example phrases and caches
// the vectors in memory, so runtime classification never re-embeds them.
async function initSemanticCache() {
  if (!API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY missing — semantic intent matching disabled.");
    return;
  }

  const cache = {};
  for (const [intentName, config] of Object.entries(INTENT_CONFIG)) {
    const vectors = await Promise.all(config.examples.map(embedText));
    cache[intentName] = { vectors: vectors.filter(Boolean), threshold: config.threshold };
  }
  exampleVectorCache = cache;
  console.log("✅ Semantic intent cache initialized:", Object.keys(cache).join(", "));
}

// Returns the matched intent name ("hours" | "location") or null.
// Only called as a fallback when regex already found nothing — see intent.js.
async function classifySemanticIntent(msg) {
  if (!exampleVectorCache) return null; // cache not ready — fail safe, fall through to AI

  const msgVector = await embedText(msg);
  if (!msgVector) return null;

  let bestIntent = null;
  let bestScore = 0;

  for (const [intentName, { vectors, threshold }] of Object.entries(exampleVectorCache)) {
    for (const vec of vectors) {
      const score = cosineSimilarity(vec, msgVector);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestIntent = intentName;
      }
    }
  }

  return bestIntent;
}

module.exports = { initSemanticCache, classifySemanticIntent };