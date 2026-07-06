const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function aiHandler(text, memory, knowledge, prompt) {
  const systemPrompt = `
${prompt.system}

Tone:
${prompt.tone}

Sales rules:
${prompt.sales}

IMPORTANT:
You must answer ONLY using the academy knowledge below.
If the answer is not in the knowledge, say that the information is not available yet and suggest contacting AI Academy Asia.
Do not invent prices, schedules, addresses, certificates, or program details.

ACADEMY KNOWLEDGE:
${JSON.stringify(knowledge, null, 2)}

USER MEMORY:
${JSON.stringify(memory, null, 2)}
`;

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: text
      }
    ]
  });

  return response.choices[0].message.content;
}

module.exports = aiHandler;