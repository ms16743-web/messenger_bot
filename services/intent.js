const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function detectIntent(text) {
  const systemPrompt = `
You are an intent classifier for AI Academy Asia Messenger chatbot.

Classify the customer message into exactly ONE intent.

Allowed intents:
greeting
pricing
programs
schedule
location
certificate
registration
faq
unknown

Understand:
- Mongolian Cyrillic
- Monglish / Latin Mongolian
- English
- abbreviations and typos

Examples:
"sn bnu" -> greeting
"sain baina uu" -> greeting
"сайн байна уу" -> greeting
"hi" -> greeting
"une hed ve" -> pricing
"үнэ хэд вэ" -> pricing
"tolbor" -> pricing
"huuhdiin surgalt bnu" -> programs
"10 nastai huuhed" -> programs
"hayag haana ve" -> location
"хаана байдаг вэ" -> location
"certificate ugdug uu" -> certificate
"schedule ymar ve" -> schedule
"хуваарь" -> schedule

Return only the intent word.
No explanation.
`;

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text }
    ],
    temperature: 0
  });

  const intent = response.choices[0].message.content.trim().toLowerCase();

  const allowed = [
    "greeting",
    "pricing",
    "programs",
    "schedule",
    "location",
    "certificate",
    "registration",
    "faq",
    "unknown"
  ];

  return allowed.includes(intent) ? intent : "unknown";
}

module.exports = { detectIntent };