require("dotenv").config();

const API_KEY = process.env.GEMINI_API_KEY;

async function embedText(text) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify({ content: { parts: [{ text }] } }),
    }
  );
  const data = await response.json();
  if (!data.embedding) {
    console.error("Embedding failed for:", text, "-", JSON.stringify(data));
    throw new Error("Embedding failed");
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

async function main() {
  console.log("Script started. API key present:", Boolean(API_KEY));

  const locationExamples = [
    "таны оффис хаана байдаг вэ",
    "office haana bdg ve",
    "bairshil haana",
  ];
  const locationVectors = await Promise.all(locationExamples.map(embedText));
  console.log("Example phrases embedded successfully.");

  // Mix of real location questions AND non-location questions, to check for false positives
  const testMessages = [
    "tnaih haan bdg ve",              // location — should score HIGH
    "tnai bairshil haanve",           // location — should score HIGH
    "tsagiin huvira chin hze ve",     // hours, NOT location — should score LOW
    "zza tgul une ni hed ve",         // price, NOT location — should score LOW
    "summer bootcamp medeelel avii",  // vague program request — should score LOW
  ];

  for (const msg of testMessages) {
    const msgVector = await embedText(msg);
    const scores = locationVectors.map((v) => cosineSimilarity(v, msgVector));
    const bestScore = Math.max(...scores);
    console.log(`${bestScore.toFixed(3)}  —  "${msg}"`);
  }
}

main().catch((err) => {
  console.error("Script crashed:", err.message);
  process.exit(1);
});