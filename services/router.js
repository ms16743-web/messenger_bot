// services/router.js

const { detectIntent } = require("./intent");
const { getMemory, updateMemory } = require("./memory");

const greetingHandler = require("../intents/greeting");
const pricingHandler = require("../intents/pricing");
const { askAI } = require("./groq");

async function router(userId, text) {
  const memory = updateMemory(userId, text);
  const intent = detectIntent(text);

  memory.lastIntent = intent;

  if (intent === "greeting") {
    return greetingHandler(memory);
  }

  if (intent === "pricing") {
    return pricingHandler(memory);
  }

  return await askAI(
    "You are a friendly admissions assistant for AI Academy Asia. Keep replies short, helpful, and conversational. If the user writes Mongolian, reply in Mongolian.",
    text
  );
}

module.exports = { router };