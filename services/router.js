// services/router.js

const { detectIntent } = require("./intent");
const { updateMemory } = require("./memory");
const { getKnowledge } = require("./knowledge");
const { loadPrompt } = require("./prompt");

const greetingHandler = require("../intents/greeting");
const pricingHandler = require("../intents/pricing");
const programsHandler = require("../intents/programs");
const locationHandler = require("../intents/location");
const aiHandler = require("../intents/ai");

async function router(userId, text) {
  const memory = updateMemory(userId, text);
  const knowledge = getKnowledge();
  const prompt = loadPrompt();

  const intent = detectIntent(text);
  memory.lastIntent = intent;

  if (intent === "greeting") {
    return greetingHandler(memory, knowledge);
  }

  if (intent === "pricing") {
    return pricingHandler(memory, knowledge);
  }

  if (intent === "programs") {
    return programsHandler(memory, knowledge);
  }

  if (intent === "location") {
    return locationHandler(memory, knowledge);
  }

  // AI fallback
  return await aiHandler(text, memory, knowledge, prompt);
}

module.exports = { router };
module.exports = { router };