const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function detectIntent(text) {
  const msg = text.toLowerCase();

  // 1. Manual safety rules first
  if (
    msg.includes("sn") ||
    msg.includes("sain") ||
    msg.includes("hi") ||
    msg.includes("hello") ||
    msg.includes("сайн")
  ) {
    return "greeting";
  }

  if (
    msg.includes("une") ||
    msg.includes("tolbor") ||
    msg.includes("price") ||
    msg.includes("cost") ||
    msg.includes("үнэ") ||
    msg.includes("төлбөр")
  ) {
    return "pricing";
  }

  if (
    msg.includes("medeelel") ||
    msg.includes("мэдээлэл") ||
    msg.includes("surgalt") ||
    msg.includes("surgaltiin") ||
    msg.includes("course") ||
    msg.includes("program") ||
    msg.includes("хөтөлбөр") ||
    msg.includes("сургалт")
  ) {
    return "programs";
  }

  if (
    msg.includes("hayag") ||
    msg.includes("haana") ||
    msg.includes("location") ||
    msg.includes("address") ||
    msg.includes("хаяг") ||
    msg.includes("хаана")
  ) {
    return "location";
  }

  if (
    msg.includes("certificate") ||
    msg.includes("sertifikat") ||
    msg.includes("сертификат")
  ) {
    return "certificate";
  }

  if (
    msg.includes("schedule") ||
    msg.includes("huvaari") ||
    msg.includes("хуваарь") ||
    msg.includes("tsag") ||
    msg.includes("цаг")
  ) {
    return "schedule";
  }

  // 2. If manual rules don't catch it, ask Groq
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
unknown

Understand Mongolian Cyrillic, Monglish, English, abbreviations, and typos.

Examples:
"sn bnu" -> greeting
"sain baina uu" -> greeting
"hi" -> greeting
"medeelel avii" -> programs
"surgaltiin medeelel avii" -> programs
"une hed ve" -> pricing
"hayag haana ve" -> location
"certificate ugdug uu" -> certificate
"schedule ymar ve" -> schedule

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
    "unknown"
  ];

  return allowed.includes(intent) ? intent : "unknown";
}

module.exports = { detectIntent };