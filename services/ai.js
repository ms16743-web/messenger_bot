const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function askAI(systemPrompt, userMessage) {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userMessage
      }
    ]
  });

  return response.choices[0].message.content;
}

module.exports = { askAI };