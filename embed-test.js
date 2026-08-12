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

// Same INTENT_CONFIG as semantic.js — keep these two in sync manually.
const INTENT_CONFIG = {
  hours: ["ажиллах цагийн хуваарь хэд вэ", "tsagiin huviar hed ve", "office ajlin tsag hed ve"],
  location: ["таны оффис хаана байдаг вэ", "office haana bdg ve", "bairshil haana"],
  vague_request: [
    "таны сургалтуудын талаар мэдээлэл өгөөч",
    "ямар хөтөлбөрүүд байдаг вэ",
    "hutulbriin medeelel avii",
    "what programs do you offer",
    "мэдээлэл авъя",
    "medeelel avii",
  ],
  group_request: [
    "nasand huregchded yamr progrm bga ve",
    "huuuhedde surgalt sonirhoj bna",
    "ahmad nastanguud yamar surgaltand orj boloh ve",
    "baigulaga, company-d ajillah humuust yamar surgalt bga ve",
    "хүүхдэдээ сургалт хайж байна",
    "байгууллагадаа сургалт хайж байна",
  ],
  exact_request: [
    "summer bootcamp medeelel avii",
    "ai 101 online surgalt iluu medeelel aviy",
    "ai engineer program yamr ve",
    "corporate ai surgalt yamar ve",
    "энэ хөтөлбөрийн үнэ хэд вэ",
    "энэ сургалт хэзээ эхэлдэг вэ",
  ],
};

async function main() {
  console.log("Script started. API key present:", Boolean(API_KEY));

  const intentVectors = {};
  for (const [intentName, examples] of Object.entries(INTENT_CONFIG)) {
    intentVectors[intentName] = await Promise.all(examples.map(embedText));
  }
  console.log("All intent examples embedded.\n");

  const testMessages = [
    "tnaih haan bdg ve",
    "tnaih ymr huutlbruudte bnve",
    "junior ai medeelel aviya",
    "surgaltuudinha medelel heled uguch",
    "nasand huregchdiin surgaltuud bnu",
    "tnai program sonirhiiy",
  ];

  for (const msg of testMessages) {
    const msgVector = await embedText(msg);

    const results = Object.entries(intentVectors).map(([intentName, vectors]) => {
      const best = Math.max(...vectors.map((v) => cosineSimilarity(v, msgVector)));
      return { intentName, score: best };
    });

    results.sort((a, b) => b.score - a.score);

    console.log(`"${msg}"`);
    results.forEach((r, i) => {
      const marker = i === 0 ? " ← winner" : "";
      console.log(`   ${r.score.toFixed(3)}  ${r.intentName}${marker}`);
    });
    console.log("");
  }
}

main().catch((err) => {
  console.error("Script crashed:", err.message);
  process.exit(1);
});