const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function detectIntent(text) {
  const prompt = `
Classify the user's message into ONE intent.

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

Rules:
- Return only one word.
- Understand Mongolian Cyrillic, Monglish, and English.
- Do not explain.

User message:
"${text}"
`;

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: prompt }
    ],
    temperature: 0
  });

  return response.choices[0].message.content.trim().toLowerCase();
}

module.exports = { detectIntent };