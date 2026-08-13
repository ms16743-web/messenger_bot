const fetchFn = typeof fetch === "function" ? fetch : require("node-fetch");

const API_KEY = process.env.GEMINI_API_KEY;
const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

const INTENT_CONFIG = {
  hours: {
    examples: [
      "ажиллах цагийн хуваарь хэд вэ",
      "tsagiin huviar hed ve",
      "office ajlin tsag hed ve",
    ],
    threshold: 0.75,
  },
  location: {
    examples: [
      "таны оффис хаана байдаг вэ",
      "office haana bdg ve",
      "bairshil haana",
    ],
    threshold: 0.72,
  },
  vague_request: {
    examples: [
      "таны сургалтуудын талаар мэдээлэл өгөөч",
      "ямар хөтөлбөрүүд байдаг вэ",
      "hutulbriin medeelel avii",
      "what programs do you offer",
      "мэдээлэл авъя",
      "medeelel avii",
    ],
    threshold: 0.72,
  },
  group_request: {
    examples: [
      "nasand huregchded yamr progrm bga ve",
      "huuuhedde surgalt sonirhoj bna",
      "ahmad nastanguud yamar surgaltand orj boloh ve",
      "baigulaga, company-d ajillah humuust yamar surgalt bga ve",
      "хүүхдэдээ сургалт хайж байна",
      "байгууллагадаа сургалт хайж байна",
    ],
    threshold: 0.72,
  },
  exact_request: {
    examples: [
      "summer bootcamp medeelel avii",
      "ai 101 online surgalt iluu medeelel aviy",
      "ai engineer program yamr ve",
      "corporate ai surgalt yamar ve",
      "энэ хөтөлбөрийн үнэ хэд вэ",
      "энэ сургалт хэзээ эхэлдэг вэ",
    ],
    threshold: 0.72,
  },
  // NEW — catches farewell/thanks messages the CLOSING_PATTERNS regex in
  // router.js misses (typo variants, casual slang etc). Only reached as a
  // fallback after the regex check already failed.
  closing: {
    examples: [
      "баярлалаа",
      "их баярлалаа",
      "за баярлалаа",
      "bayarlalaa",
      "bayrlla bro",
      "thanks a lot",
      "thank you so much",
      "za bolloo",
      "ойлголоо баярлалаа",
      "за за баярлаа",
    ],
    threshold: 0.78, // tighter than others — closing phrases are short and
                      // generic-sounding, avoid false-positiving on "za"/"ok"
  },
};

const DEFAULT_THRESHOLD = 0.72;

let exampleVectorCache = null;

async function embedText(text) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetchFn(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify({ content: { parts: [{ text }] } }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!data.embedding) {
      console.error("❌ Embedding failed for:", text, "-", JSON.stringify(data));
      return null;
    }
    return data.embedding.values;
  } catch (error) {
    console.error("❌ Embedding request failed/timed out for:", text, "-", error.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
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

async function initSemanticCache() {
  if (!API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY missing — semantic intent matching disabled.");
    return;
  }

  const cache = {};
  for (const [intentName, config] of Object.entries(INTENT_CONFIG)) {
    const vectors = await Promise.all(config.examples.map(embedText));
    const threshold = typeof config.threshold === "number" ? config.threshold : DEFAULT_THRESHOLD;
    if (typeof config.threshold !== "number") {
      console.warn(`⚠️ Intent "${intentName}" has no numeric threshold — using default ${DEFAULT_THRESHOLD}.`);
    }
    cache[intentName] = { vectors: vectors.filter(Boolean), threshold };
  }
  exampleVectorCache = cache;
  console.log("✅ Semantic intent cache initialized:", Object.keys(cache).join(", "));
}

async function classifySemanticIntent(msg) {
  if (!exampleVectorCache) return null;

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

  if (bestIntent) {
    console.log(`🔎 Semantic match: ${bestIntent} (score ${bestScore.toFixed(3)})`);
  }

  return bestIntent;
}

module.exports = { initSemanticCache, classifySemanticIntent };